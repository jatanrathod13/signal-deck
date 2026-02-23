/**
 * GovernanceService - Approval gates for risky tool actions.
 * Implements WP-09: Governance approvals lifecycle.
 */

import {
  ApprovalRequest,
  ApprovalStatus,
  GovernancePolicy
} from '../../types';
import { redis } from '../../config/redis';
import { appendRunEvent, getRun } from './conversationService';
import { appendAuditEvent } from './auditService';
import { getCurrentWorkspaceId, getCurrentWorkspaceIdOrDefault, isWorkspaceMatch } from './workspaceContextService';

// In-memory approval store (keyed by approval ID)
const approvals = new Map<string, ApprovalRequest>();

// Pending approval callbacks (approval ID -> resolve function)
const pendingApprovalCallbacks = new Map<string, (approved: boolean) => void>();
const APPROVAL_KEY_PREFIX = 'approval:';
const APPROVAL_INDEX_KEY = 'approvals:index';

function generateId(): string {
  return `approval-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializeApproval(approval: ApprovalRequest): string {
  return JSON.stringify(approval);
}

function deserializeApproval(raw: string): ApprovalRequest {
  const parsed = JSON.parse(raw) as ApprovalRequest;
  return {
    ...parsed,
    requestedAt: new Date(parsed.requestedAt),
    resolvedAt: parsed.resolvedAt ? new Date(parsed.resolvedAt) : undefined
  };
}

async function persistApproval(approval: ApprovalRequest): Promise<void> {
  try {
    const pipeline = redis.pipeline();
    pipeline.set(`${APPROVAL_KEY_PREFIX}${approval.id}`, serializeApproval(approval));
    pipeline.sadd(APPROVAL_INDEX_KEY, approval.id);
    await pipeline.exec();
  } catch (error) {
    console.warn('[GovernanceService] Failed to persist approval:', error);
  }
}

function persistApprovalAsync(approval: ApprovalRequest): void {
  persistApproval(approval).catch((error) => {
    console.warn('[GovernanceService] Async approval persistence failed:', error);
  });
}

/**
 * Initialize approvals from Redis on startup.
 */
export async function initializeApprovalStore(): Promise<void> {
  try {
    approvals.clear();
    const ids = await redis.smembers(APPROVAL_INDEX_KEY);
    if (ids.length === 0) {
      return;
    }

    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.get(`${APPROVAL_KEY_PREFIX}${id}`);
    }

    const results = await pipeline.exec();
    if (!results) {
      return;
    }

    for (const [err, raw] of results) {
      if (err || !raw) {
        continue;
      }

      try {
        const approval = deserializeApproval(raw as string);
        approvals.set(approval.id, approval);
      } catch (parseError) {
        console.warn('[GovernanceService] Failed to parse approval payload:', parseError);
      }
    }
  } catch (error) {
    console.warn('[GovernanceService] Failed to initialize approvals from Redis:', error);
  }
}

/**
 * Check if a tool action requires approval based on governance policy.
 */
export function requiresApproval(
  toolName: string,
  policy?: GovernancePolicy
): boolean {
  if (!policy || !policy.enabled) {
    return false;
  }

  if (policy.requireApprovalTools && policy.requireApprovalTools.includes(toolName)) {
    return true;
  }

  return false;
}

/**
 * Check if an action type requires approval.
 */
export function actionRequiresApproval(
  actionType: string,
  policy?: GovernancePolicy
): boolean {
  if (!policy || !policy.enabled) {
    return false;
  }

  if (policy.requireApprovalActions && policy.requireApprovalActions.includes(actionType)) {
    return true;
  }

  return false;
}

/**
 * Request approval for a tool action.
 * Returns a promise that resolves when approval is granted or denied.
 */
export async function requestApproval(
  toolName: string,
  input: Record<string, unknown>,
  context: {
    runId: string;
    conversationId: string;
    reason?: string;
    policy?: GovernancePolicy;
  }
): Promise<{ approved: boolean; approvalId: string }> {
  const approvalId = generateId();
  const timeoutMs = context.policy?.autoApproveTimeout ?? 60_000;

  const approval: ApprovalRequest = {
    id: approvalId,
    workspaceId: getCurrentWorkspaceIdOrDefault() ?? 'workspace-default',
    runId: context.runId,
    toolName,
    reason: context.reason || `Tool ${toolName} requires approval`,
    input,
    status: 'pending',
    requestedAt: new Date()
  };

  approvals.set(approvalId, approval);
  persistApprovalAsync(approval);
  appendAuditEvent({
    workspaceId: approval.workspaceId,
    action: 'governance.approval.requested',
    resourceType: 'approval',
    resourceId: approvalId,
    metadata: {
      runId: context.runId,
      toolName,
      reason: approval.reason
    }
  }).catch(() => undefined);

  // Emit approval request event
  appendRunEvent({
    runId: context.runId,
    conversationId: context.conversationId,
    type: 'approval.requested',
    payload: {
      approvalId,
      toolName,
      reason: approval.reason,
      input
    }
  });

  // Create a promise that resolves on approve/deny/timeout
  return new Promise<{ approved: boolean; approvalId: string }>((resolve) => {
    // Set up timeout for auto-deny
    const timer = setTimeout(() => {
      const pending = approvals.get(approvalId);
      if (pending && pending.status === 'pending') {
        pending.status = 'timed_out';
        pending.resolvedAt = new Date();
        pendingApprovalCallbacks.delete(approvalId);
        persistApprovalAsync(pending);

        appendRunEvent({
          runId: context.runId,
          conversationId: context.conversationId,
          type: 'approval.resolved',
          payload: {
            approvalId,
            status: 'timed_out',
            toolName
          }
        });
        appendAuditEvent({
          workspaceId: pending.workspaceId,
          action: 'governance.approval.timed_out',
          resourceType: 'approval',
          resourceId: approvalId,
          metadata: {
            runId: pending.runId,
            toolName: pending.toolName
          }
        }).catch(() => undefined);

        resolve({ approved: false, approvalId });
      }
    }, timeoutMs);

    // Register the resolve callback
    pendingApprovalCallbacks.set(approvalId, (approved: boolean) => {
      clearTimeout(timer);
      resolve({ approved, approvalId });
    });
  });
}

/**
 * Resolve an approval request (approve or deny).
 */
export function resolveApproval(
  approvalId: string,
  decision: 'approved' | 'denied',
  resolvedBy?: string
): ApprovalRequest | undefined {
  const approval = approvals.get(approvalId);
  if (!approval || approval.status !== 'pending') {
    return undefined;
  }

  approval.status = decision;
  approval.resolvedAt = new Date();
  approval.resolvedBy = resolvedBy;
  persistApprovalAsync(approval);

  const run = getRun(approval.runId);
  if (run) {
    appendRunEvent({
      runId: approval.runId,
      conversationId: run.conversationId,
      type: 'approval.resolved',
      payload: {
        approvalId,
        status: decision,
        toolName: approval.toolName,
        resolvedBy
      }
    });
  }

  appendAuditEvent({
    workspaceId: approval.workspaceId,
    action: 'governance.approval.resolved',
    resourceType: 'approval',
    resourceId: approval.id,
    metadata: {
      runId: approval.runId,
      status: decision,
      resolvedBy
    }
  }).catch(() => undefined);

  // Notify the waiting callback
  const callback = pendingApprovalCallbacks.get(approvalId);
  if (callback) {
    callback(decision === 'approved');
    pendingApprovalCallbacks.delete(approvalId);
  }

  return approval;
}

/**
 * Get an approval by ID.
 */
export function getApproval(approvalId: string): ApprovalRequest | undefined {
  const approval = approvals.get(approvalId);
  if (!approval) {
    return undefined;
  }

  if (!isWorkspaceMatch(approval.workspaceId, getCurrentWorkspaceId())) {
    return undefined;
  }

  return approval;
}

/**
 * List all approvals for a run.
 */
export function listRunApprovals(runId: string): ApprovalRequest[] {
  return Array.from(approvals.values())
    .filter((a) => a.runId === runId)
    .filter((a) => isWorkspaceMatch(a.workspaceId, getCurrentWorkspaceId()))
    .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
}

/**
 * List pending approvals for a run.
 */
export function listPendingApprovals(runId: string): ApprovalRequest[] {
  return listRunApprovals(runId).filter((a) => a.status === 'pending');
}

export function listApprovals(filters?: { status?: ApprovalStatus; runId?: string }): ApprovalRequest[] {
  return Array.from(approvals.values())
    .filter((approval) => isWorkspaceMatch(approval.workspaceId, getCurrentWorkspaceId()))
    .filter((approval) => !filters?.status || approval.status === filters.status)
    .filter((approval) => !filters?.runId || approval.runId === filters.runId)
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
}
