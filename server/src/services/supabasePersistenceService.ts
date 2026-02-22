/**
 * SupabasePersistenceService
 * Feature-flagged data persistence bridge for agents and tasks.
 */

import { Agent, Task } from '../../types';
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from '../lib/supabaseClient';
import {
  SupabaseAgentRepository,
  SupabaseTaskRepository
} from '../repositories/supabase';

function isFeatureEnabled(): boolean {
  return process.env.FEATURE_SUPABASE_PERSISTENCE === 'true';
}

function getWorkspaceId(): string {
  return process.env.DEFAULT_WORKSPACE_ID ?? '';
}

function canUseSupabasePersistence(): boolean {
  return isFeatureEnabled() && hasSupabaseAdminConfig() && getWorkspaceId().length > 0;
}

function getAgentRepository(): SupabaseAgentRepository | null {
  const client = getSupabaseAdminClient();
  return client ? new SupabaseAgentRepository(client) : null;
}

function getTaskRepository(): SupabaseTaskRepository | null {
  const client = getSupabaseAdminClient();
  return client ? new SupabaseTaskRepository(client) : null;
}

export function isSupabasePersistenceEnabled(): boolean {
  return canUseSupabasePersistence();
}

export async function saveAgentToSupabase(agent: Agent): Promise<void> {
  if (!canUseSupabasePersistence()) {
    return;
  }

  const repository = getAgentRepository();
  if (!repository) {
    return;
  }

  await repository.createAgent({
    id: agent.id,
    workspaceId: getWorkspaceId(),
    name: agent.name,
    type: agent.type,
    config: agent.config,
    status: agent.status,
    metadata: {},
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  });
}

export async function loadAgentsFromSupabase(): Promise<Agent[]> {
  if (!canUseSupabasePersistence()) {
    return [];
  }

  const repository = getAgentRepository();
  if (!repository) {
    return [];
  }

  const agents = await repository.listAgents({
    workspaceId: getWorkspaceId()
  });

  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    type: agent.type,
    config: agent.config,
    status: agent.status,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  }));
}

export async function deleteAgentFromSupabase(agentId: string): Promise<void> {
  if (!canUseSupabasePersistence()) {
    return;
  }

  const repository = getAgentRepository();
  if (!repository) {
    return;
  }

  await repository.deleteAgent(agentId);
}

export async function saveTaskToSupabase(task: Task): Promise<void> {
  if (!canUseSupabasePersistence()) {
    return;
  }

  const repository = getTaskRepository();
  if (!repository) {
    return;
  }

  await repository.createTask({
    id: task.id,
    workspaceId: getWorkspaceId(),
    agentId: task.agentId,
    type: task.type,
    data: task.data,
    executionMode: task.executionMode,
    status: task.status,
    priority: task.priority,
    parentTaskId: task.parentTaskId,
    planId: task.planId,
    stepId: task.stepId,
    dependsOnTaskIds: task.dependsOnTaskIds,
    childTaskIds: task.childTaskIds,
    idempotencyKey: task.idempotencyKey,
    retryCount: task.retryCount,
    metadata: task.metadata,
    conversationId: task.conversationId,
    runId: task.runId,
    result: task.result,
    error: task.error,
    errorType: task.errorType,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  });
}

export async function loadTasksFromSupabase(): Promise<Task[]> {
  if (!canUseSupabasePersistence()) {
    return [];
  }

  const repository = getTaskRepository();
  if (!repository) {
    return [];
  }

  const tasks = await repository.listTasks({
    workspaceId: getWorkspaceId()
  });

  return tasks.map((task) => ({
    id: task.id,
    agentId: task.agentId,
    type: task.type,
    data: task.data,
    executionMode: task.executionMode,
    status: task.status,
    priority: task.priority,
    parentTaskId: task.parentTaskId,
    planId: task.planId,
    stepId: task.stepId,
    dependsOnTaskIds: task.dependsOnTaskIds,
    childTaskIds: task.childTaskIds,
    idempotencyKey: task.idempotencyKey,
    retryCount: task.retryCount,
    metadata: task.metadata,
    conversationId: task.conversationId,
    runId: task.runId,
    result: task.result,
    error: task.error,
    errorType: task.errorType,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }));
}

export async function deleteTaskFromSupabase(taskId: string): Promise<void> {
  if (!canUseSupabasePersistence()) {
    return;
  }

  const repository = getTaskRepository();
  if (!repository) {
    return;
  }

  await repository.deleteTask(taskId);
}

export async function getTaskIdByIdempotencyKeyFromSupabase(
  idempotencyKey: string
): Promise<string | null> {
  if (!canUseSupabasePersistence()) {
    return null;
  }

  const repository = getTaskRepository();
  if (!repository) {
    return null;
  }

  const task = await repository.getTaskByIdempotencyKey(getWorkspaceId(), idempotencyKey);
  return task?.id ?? null;
}
