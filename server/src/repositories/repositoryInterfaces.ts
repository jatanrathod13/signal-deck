/**
 * Repository Interfaces
 * Data-access contracts for Supabase-backed persistence in M1.
 */

import {
  AgentListFilters,
  AuditEventListFilters,
  AuditEventRecord,
  NewAuditEventRecord,
  NewPersistedAgent,
  NewPersistedPlan,
  NewPersistedPlanStep,
  NewPersistedRun,
  NewPersistedRunEvent,
  NewPersistedTask,
  PlanListFilters,
  PlanStepListFilters,
  NewScheduleRecord,
  NewWebhookDeliveryRecord,
  NewWorkspaceMemberRecord,
  NewWorkspaceRecord,
  PersistedAgent,
  PersistedPlan,
  PersistedPlanStep,
  PersistedRun,
  PersistedRunEvent,
  PersistedTask,
  RepositoryRequestContext,
  RunEventListFilters,
  RunListFilters,
  ScheduleListFilters,
  ScheduleRecord,
  TaskListFilters,
  WebhookDeliveryRecord,
  WebhookListFilters,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from './repositoryModels';

export interface WorkspaceRepository {
  createWorkspace(
    input: NewWorkspaceRecord,
    ctx?: RepositoryRequestContext
  ): Promise<WorkspaceRecord>;
  getWorkspaceById(id: string, ctx?: RepositoryRequestContext): Promise<WorkspaceRecord | null>;
  getWorkspaceBySlug(slug: string, ctx?: RepositoryRequestContext): Promise<WorkspaceRecord | null>;
  listWorkspacesForUser(userId: string, ctx?: RepositoryRequestContext): Promise<WorkspaceRecord[]>;
  updateWorkspace(
    id: string,
    updates: Partial<Omit<WorkspaceRecord, 'id' | 'createdAt' | 'updatedAt'>>,
    ctx?: RepositoryRequestContext
  ): Promise<WorkspaceRecord | null>;
}

export interface WorkspaceMemberRepository {
  upsertWorkspaceMember(
    input: NewWorkspaceMemberRecord,
    ctx?: RepositoryRequestContext
  ): Promise<WorkspaceMemberRecord>;
  getWorkspaceMember(
    workspaceId: string,
    userId: string,
    ctx?: RepositoryRequestContext
  ): Promise<WorkspaceMemberRecord | null>;
  listWorkspaceMembers(
    workspaceId: string,
    ctx?: RepositoryRequestContext
  ): Promise<WorkspaceMemberRecord[]>;
  listUserWorkspaceMemberships(
    userId: string,
    ctx?: RepositoryRequestContext
  ): Promise<WorkspaceMemberRecord[]>;
  deleteWorkspaceMember(
    workspaceId: string,
    userId: string,
    ctx?: RepositoryRequestContext
  ): Promise<boolean>;
}

export interface AgentRepository {
  createAgent(input: NewPersistedAgent, ctx?: RepositoryRequestContext): Promise<PersistedAgent>;
  getAgentById(id: string, ctx?: RepositoryRequestContext): Promise<PersistedAgent | null>;
  listAgents(filters: AgentListFilters, ctx?: RepositoryRequestContext): Promise<PersistedAgent[]>;
  updateAgent(
    id: string,
    updates: Partial<Omit<PersistedAgent, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedAgent | null>;
  deleteAgent(id: string, ctx?: RepositoryRequestContext): Promise<boolean>;
}

export interface TaskRepository {
  createTask(input: NewPersistedTask, ctx?: RepositoryRequestContext): Promise<PersistedTask>;
  getTaskById(id: string, ctx?: RepositoryRequestContext): Promise<PersistedTask | null>;
  getTaskByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedTask | null>;
  listTasks(filters: TaskListFilters, ctx?: RepositoryRequestContext): Promise<PersistedTask[]>;
  updateTask(
    id: string,
    updates: Partial<Omit<PersistedTask, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedTask | null>;
  deleteTask(id: string, ctx?: RepositoryRequestContext): Promise<boolean>;
}

export interface PlanRepository {
  createPlan(input: NewPersistedPlan, ctx?: RepositoryRequestContext): Promise<PersistedPlan>;
  getPlanById(id: string, ctx?: RepositoryRequestContext): Promise<PersistedPlan | null>;
  listPlans(
    filters: PlanListFilters,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedPlan[]>;
  upsertPlanStep(
    input: NewPersistedPlanStep,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedPlanStep>;
  listPlanSteps(
    filters: PlanStepListFilters,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedPlanStep[]>;
  updatePlan(
    id: string,
    updates: Partial<Omit<PersistedPlan, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedPlan | null>;
}

export interface RunRepository {
  createRun(input: NewPersistedRun, ctx?: RepositoryRequestContext): Promise<PersistedRun>;
  getRunById(id: string, ctx?: RepositoryRequestContext): Promise<PersistedRun | null>;
  listRuns(filters: RunListFilters, ctx?: RepositoryRequestContext): Promise<PersistedRun[]>;
  updateRun(
    id: string,
    updates: Partial<Omit<PersistedRun, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedRun | null>;
  appendRunEvent(
    input: NewPersistedRunEvent,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedRunEvent>;
  listRunEvents(
    filters: RunEventListFilters,
    ctx?: RepositoryRequestContext
  ): Promise<PersistedRunEvent[]>;
}

export interface WebhookRepository {
  createWebhookDelivery(
    input: NewWebhookDeliveryRecord,
    ctx?: RepositoryRequestContext
  ): Promise<WebhookDeliveryRecord>;
  getWebhookDeliveryById(
    id: string,
    ctx?: RepositoryRequestContext
  ): Promise<WebhookDeliveryRecord | null>;
  listWebhookDeliveries(
    filters: WebhookListFilters,
    ctx?: RepositoryRequestContext
  ): Promise<WebhookDeliveryRecord[]>;
  updateWebhookDelivery(
    id: string,
    updates: Partial<Omit<WebhookDeliveryRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    ctx?: RepositoryRequestContext
  ): Promise<WebhookDeliveryRecord | null>;
  deleteWebhookDelivery(id: string, ctx?: RepositoryRequestContext): Promise<boolean>;
}

export interface ScheduleRepository {
  createSchedule(input: NewScheduleRecord, ctx?: RepositoryRequestContext): Promise<ScheduleRecord>;
  getScheduleById(id: string, ctx?: RepositoryRequestContext): Promise<ScheduleRecord | null>;
  listSchedules(filters: ScheduleListFilters, ctx?: RepositoryRequestContext): Promise<ScheduleRecord[]>;
  updateSchedule(
    id: string,
    updates: Partial<Omit<ScheduleRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    ctx?: RepositoryRequestContext
  ): Promise<ScheduleRecord | null>;
  deleteSchedule(id: string, ctx?: RepositoryRequestContext): Promise<boolean>;
}

export interface AuditEventRepository {
  appendAuditEvent(
    input: NewAuditEventRecord,
    ctx?: RepositoryRequestContext
  ): Promise<AuditEventRecord>;
  listAuditEvents(
    filters: AuditEventListFilters,
    ctx?: RepositoryRequestContext
  ): Promise<AuditEventRecord[]>;
}

export interface RepositoryRegistry {
  workspaceRepository: WorkspaceRepository;
  workspaceMemberRepository: WorkspaceMemberRepository;
  agentRepository: AgentRepository;
  taskRepository: TaskRepository;
  planRepository: PlanRepository;
  runRepository: RunRepository;
  webhookRepository: WebhookRepository;
  scheduleRepository: ScheduleRepository;
  auditEventRepository: AuditEventRepository;
}
