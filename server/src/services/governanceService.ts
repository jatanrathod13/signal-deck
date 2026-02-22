/**
 * GovernanceService - Approval gates for risky tool actions.
 * Implements WP-09: Governance approvals lifecycle.
 */

import {
  ApprovalRequest,
  ApprovalStatus,
  GovernancePolicy
} from '../../types';
import { appendRunEvent, getRun } from './conversationService';

// In-memory approval store (keyed by approval ID)
const approvals = new Map<string, ApprovalRequest>();

// Pending approval callbacks (approval ID -> resolve function)
const pendingApprovalCallbacks = new Map<string, (approved: boolean) => void>();

function generateId(): string {
  return `approval-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
    runId: context.runId,
    toolName,
    reason: context.reason || `Tool ${toolName} requires approval`,
    input,
    status: 'pending',
    requestedAt: new Date()
  };

  approvals.set(approvalId, approval);

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
  return approvals.get(approvalId);
}

/**
 * List all approvals for a run.
 */
export function listRunApprovals(runId: string): ApprovalRequest[] {
  return Array.from(approvals.values())
    .filter((a) => a.runId === runId)
    .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
}

/**
 * List pending approvals for a run.
 */
export function listPendingApprovals(runId: string): ApprovalRequest[] {
  return listRunApprovals(runId).filter((a) => a.status === 'pending');
}
