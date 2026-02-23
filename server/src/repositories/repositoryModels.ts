/**
 * Repository Models
 * Canonical persistence contracts for workspace-scoped Supabase repositories.
 */

import {
  Agent,
  AgentStatus,
  Plan,
  PlanStatus,
  PlanStep,
  PlanStepStatus,
  Run,
  RunEvent,
  RunStatus,
  Task,
  TaskStatus,
} from '../../types';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ScheduleRunStatus = 'never' | 'running' | 'succeeded' | 'failed';
export type WebhookDirection = 'inbound' | 'outbound';
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'disabled';

export interface RepositoryRequestContext {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
}

export interface PageRequest {
  cursor?: string;
  limit?: number;
}

export interface TimeRange {
  from?: Date;
  to?: Date;
}

export interface WorkspaceRecord {
  id: string;
  slug: string;
  name: string;
  createdByUserId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberRecord {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
  invitedByUserId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedAgent extends Agent {
  workspaceId: string;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface PersistedTask extends Task {
  workspaceId: string;
  createdByUserId?: string;
}

export interface PersistedPlan extends Omit<Plan, 'steps'> {
  workspaceId: string;
}

export interface PersistedPlanStep extends PlanStep {
  workspaceId: string;
}

export interface PersistedRun extends Run {
  workspaceId: string;
  createdByUserId?: string;
}

export interface PersistedRunEvent extends RunEvent {
  workspaceId: string;
  sequenceId: number;
}

export interface WebhookDeliveryRecord {
  id: string;
  workspaceId: string;
  direction: WebhookDirection;
  eventName: string;
  targetUrl?: string;
  status: WebhookDeliveryStatus;
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
  signature?: string;
  responseStatus?: number;
  responseBody?: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: Date;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleRecord {
  id: string;
  workspaceId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  payload?: Record<string, unknown>;
  enabled: boolean;
  retryLimit: number;
  retryBackoffSeconds: number;
  lastRunAt?: Date;
  nextRunAt?: Date;
  lastRunStatus: ScheduleRunStatus;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEventRecord {
  id: string;
  workspaceId: string;
  actorUserId?: string;
  actorType: 'user' | 'service' | 'system';
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

export interface AgentListFilters extends PageRequest {
  workspaceId: string;
  statuses?: AgentStatus[];
  types?: string[];
}

export interface TaskListFilters extends PageRequest {
  workspaceId: string;
  statuses?: TaskStatus[];
  agentId?: string;
  runId?: string;
  planId?: string;
  createdAt?: TimeRange;
}

export interface PlanListFilters extends PageRequest {
  workspaceId: string;
  statuses?: PlanStatus[];
}

export interface PlanStepListFilters extends PageRequest {
  workspaceId: string;
  planId: string;
  statuses?: PlanStepStatus[];
}

export interface RunListFilters extends PageRequest {
  workspaceId: string;
  statuses?: RunStatus[];
  conversationId?: string;
  createdAt?: TimeRange;
}

export interface RunEventListFilters extends PageRequest {
  workspaceId: string;
  runId: string;
}

export interface WebhookListFilters extends PageRequest {
  workspaceId: string;
  statuses?: WebhookDeliveryStatus[];
  directions?: WebhookDirection[];
  dueBefore?: Date;
}

export interface ScheduleListFilters extends PageRequest {
  workspaceId: string;
  enabled?: boolean;
  dueBefore?: Date;
}

export interface AuditEventListFilters extends PageRequest {
  workspaceId: string;
  actions?: string[];
  resources?: string[];
  occurredAt?: TimeRange;
}

export type NewWorkspaceRecord = Omit<WorkspaceRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type NewWorkspaceMemberRecord = Omit<WorkspaceMemberRecord, 'joinedAt' | 'createdAt' | 'updatedAt'>;
export type NewPersistedAgent = Omit<PersistedAgent, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date;
  updatedAt?: Date;
};
export type NewPersistedTask = Omit<PersistedTask, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date;
  updatedAt?: Date;
};
export type NewPersistedPlan = Omit<PersistedPlan, 'id' | 'createdAt' | 'updatedAt'>;
export type NewPersistedPlanStep = Omit<PersistedPlanStep, 'id' | 'createdAt' | 'updatedAt'>;
export type NewPersistedRun = Omit<PersistedRun, 'id' | 'startedAt'> & { startedAt?: Date };
export type NewPersistedRunEvent = Omit<PersistedRunEvent, 'id' | 'sequenceId' | 'timestamp'> & {
  timestamp?: Date;
};
export type NewWebhookDeliveryRecord = Omit<WebhookDeliveryRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type NewScheduleRecord = Omit<ScheduleRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type NewAuditEventRecord = Omit<AuditEventRecord, 'id' | 'occurredAt'> & { occurredAt?: Date };
