/**
 * OrchestratorService
 * Coordinates sequential/parallel/DAG plan execution and parent-child task flow.
 */

import {
  OrchestrationExecutionStrategy,
  OrchestrationSummary,
  Plan,
  Task,
  TaskExecutionMode,
  getFeatureFlags
} from '../../types';
import { createPlan, getPlan, getReadySteps, updatePlanStatus, updateStepStatus } from './planService';
import { getAllTasks, getTask, linkChildTask, submitTask } from './taskQueueService';
import { getCurrentWorkspaceIdOrDefault } from './workspaceContextService';

const DEFAULT_AUTO_PLAN_MAX_STEPS = 5;
const MIN_AUTO_PLAN_STEPS = 2;
const MAX_AUTO_PLAN_STEPS = 10;

export type AssignmentStrategy = 'round_robin' | 'least_loaded';

export interface DagStepDefinition {
  id?: string;
  title: string;
  description?: string;
  agentId?: string;
  taskType?: string;
  taskData?: Record<string, unknown>;
  dependsOnStepIds?: string[];
}

interface PlanStepInput {
  id?: string;
  title: string;
  description: string;
  agentId: string;
  taskType: string;
  taskData: Record<string, unknown>;
  dependsOnStepIds?: string[];
}

function clampStepCount(maxSteps?: number): number {
  if (typeof maxSteps !== 'number' || Number.isNaN(maxSteps)) {
    return DEFAULT_AUTO_PLAN_MAX_STEPS;
  }

  return Math.max(MIN_AUTO_PLAN_STEPS, Math.min(MAX_AUTO_PLAN_STEPS, Math.floor(maxSteps)));
}

function normalizePrompt(prompt: string): string {
  return prompt
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeExecutionStrategy(value?: string): OrchestrationExecutionStrategy {
  if (value === 'parallel' || value === 'dag') {
    return value;
  }

  return 'sequential';
}

function normalizeAssignmentStrategy(value?: string): AssignmentStrategy {
  if (value === 'least_loaded') {
    return 'least_loaded';
  }

  return 'round_robin';
}

function resolveTeamAgentIds(defaultAgentId: string, teamAgentIds?: string[]): string[] {
  const candidates = (teamAgentIds ?? [])
    .map((agentId) => agentId.trim())
    .filter((agentId) => agentId.length > 0);

  if (candidates.length === 0) {
    return [defaultAgentId];
  }

  return Array.from(new Set(candidates));
}

function getLoadAwareAssignments(stepCount: number, teamAgentIds: string[]): string[] {
  const loadByAgent = new Map<string, number>();
  const queuedTasks = getAllTasks().filter((task) => (
    task.status === 'pending' || task.status === 'processing' || task.status === 'blocked'
  ));

  for (const agentId of teamAgentIds) {
    loadByAgent.set(agentId, 0);
  }

  for (const task of queuedTasks) {
    if (loadByAgent.has(task.agentId)) {
      loadByAgent.set(task.agentId, (loadByAgent.get(task.agentId) ?? 0) + 1);
    }
  }

  const assignments: string[] = [];

  for (let index = 0; index < stepCount; index += 1) {
    let selectedAgentId = teamAgentIds[0];
    let selectedLoad = loadByAgent.get(selectedAgentId) ?? 0;

    for (const agentId of teamAgentIds) {
      const load = loadByAgent.get(agentId) ?? 0;
      if (load < selectedLoad) {
        selectedAgentId = agentId;
        selectedLoad = load;
      }
    }

    assignments.push(selectedAgentId);
    loadByAgent.set(selectedAgentId, (loadByAgent.get(selectedAgentId) ?? 0) + 1);
  }

  return assignments;
}

function assignAgentsToSteps(
  stepCount: number,
  teamAgentIds: string[],
  assignmentStrategy: AssignmentStrategy
): string[] {
  if (stepCount <= 0) {
    return [];
  }

  const flags = getFeatureFlags();
  if (assignmentStrategy === 'least_loaded' && flags.FEATURE_DYNAMIC_AGENT_POOLS) {
    return getLoadAwareAssignments(stepCount, teamAgentIds);
  }

  return Array.from({ length: stepCount }).map((_, index) => teamAgentIds[index % teamAgentIds.length]);
}

function generateDagStepId(index: number): string {
  return `dag-step-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function validateDagDependencies(steps: PlanStepInput[]): void {
  const stepIds = new Set(steps.map((step) => step.id));

  for (const step of steps) {
    for (const dependencyId of step.dependsOnStepIds ?? []) {
      if (!dependencyId || !stepIds.has(dependencyId)) {
        throw new Error(`DAG step ${step.id} depends on unknown step ${dependencyId}`);
      }

      if (dependencyId === step.id) {
        throw new Error(`DAG step ${step.id} cannot depend on itself`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const adjacency = new Map<string, string[]>();

  for (const step of steps) {
    adjacency.set(step.id!, step.dependsOnStepIds ?? []);
  }

  const visit = (stepId: string): void => {
    if (visited.has(stepId)) {
      return;
    }

    if (visiting.has(stepId)) {
      throw new Error(`DAG dependency cycle detected at ${stepId}`);
    }

    visiting.add(stepId);
    for (const depId of adjacency.get(stepId) ?? []) {
      visit(depId);
    }
    visiting.delete(stepId);
    visited.add(stepId);
  };

  for (const stepId of adjacency.keys()) {
    visit(stepId);
  }
}

function createSimpleStepPlan(
  objective: string,
  agentIds: string[],
  stepPrompts: string[],
  executionStrategy: OrchestrationExecutionStrategy,
  assignmentStrategy: AssignmentStrategy
): PlanStepInput[] {
  const hasParallelExecution = executionStrategy === 'parallel';
  const assignments = assignAgentsToSteps(stepPrompts.length, agentIds, assignmentStrategy);

  return stepPrompts.map((prompt, index) => ({
    title: `Step ${index + 1}`,
    description: prompt,
    agentId: assignments[index],
    taskType: 'orchestration-step',
    taskData: {
      prompt,
      objective,
      stepNumber: index + 1
    },
    dependsOnStepIds: hasParallelExecution ? [] : undefined
  }));
}

function createDagStepPlan(
  objective: string,
  defaultAgentId: string,
  teamAgentIds: string[],
  steps: DagStepDefinition[],
  assignmentStrategy: AssignmentStrategy
): PlanStepInput[] {
  if (steps.length === 0) {
    throw new Error('DAG plans require at least one step');
  }

  const assignments = assignAgentsToSteps(steps.length, teamAgentIds, assignmentStrategy);

  const planSteps: PlanStepInput[] = steps.map((step, index) => {
    const normalizedTitle = normalizePrompt(step.title || `Step ${index + 1}`);
    if (!normalizedTitle) {
      throw new Error(`DAG step ${index + 1} has an empty title`);
    }

    const normalizedAgentId = typeof step.agentId === 'string' && step.agentId.trim().length > 0
      ? step.agentId.trim()
      : assignments[index] ?? defaultAgentId;

    const taskType = typeof step.taskType === 'string' && step.taskType.trim().length > 0
      ? step.taskType.trim()
      : 'orchestration-step';

    const taskData = typeof step.taskData === 'object' && step.taskData !== null
      ? step.taskData
      : { prompt: normalizedTitle, objective, stepNumber: index + 1 };

    return {
      id: typeof step.id === 'string' && step.id.trim().length > 0
        ? step.id.trim()
        : generateDagStepId(index + 1),
      title: normalizedTitle,
      description: step.description ? normalizePrompt(step.description) : normalizedTitle,
      agentId: normalizedAgentId,
      taskType,
      taskData,
      dependsOnStepIds: Array.isArray(step.dependsOnStepIds)
        ? Array.from(new Set(step.dependsOnStepIds.filter((value) => typeof value === 'string' && value.trim().length > 0)))
        : []
    };
  });

  validateDagDependencies(planSteps);
  return planSteps;
}

async function startReadySteps(
  planId: string,
  readySteps: Array<{
    id: string;
    agentId: string;
    taskType: string;
    taskData: Record<string, unknown>;
  }>,
  executionMode: TaskExecutionMode | undefined,
  workspaceId: string,
  context: {
    parentTaskId?: string;
    conversationId?: string;
    runId?: string;
  }
): Promise<void> {
  for (const step of readySteps) {
    const task: Task = {
      id: '',
      workspaceId,
      agentId: step.agentId,
      type: step.taskType,
      data: step.taskData,
      executionMode,
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentTaskId: context.parentTaskId,
      planId,
      stepId: step.id,
      metadata: {
        orchestration: true,
        workspaceId
      },
      conversationId: context.conversationId,
      runId: context.runId
    };

    const taskId = await submitTask(task);
    await updateStepStatus(planId, step.id, 'running', { taskId });
  }
}

/**
 * Build practical step prompts from a natural-language objective.
 */
export function generateStepPromptsFromObjective(objective: string, maxSteps?: number): string[] {
  const sanitizedObjective = objective.trim();
  const targetSteps = clampStepCount(maxSteps);

  if (!sanitizedObjective) {
    return [
      'Clarify and restate the objective in concrete terms.',
      'Define and execute the smallest set of actions to complete the objective.'
    ];
  }

  const splitCandidates = sanitizedObjective
    .split(/[.;\n]|(?:\s+and\s+)|(?:\s+then\s+)/i)
    .map((value) => normalizePrompt(value))
    .filter((value) => value.length > 0);

  const uniqueCandidates = Array.from(new Set(splitCandidates));

  if (uniqueCandidates.length >= MIN_AUTO_PLAN_STEPS) {
    return uniqueCandidates
      .slice(0, targetSteps)
      .map((candidate, index) => `Complete part ${index + 1}: ${candidate}`);
  }

  const genericPlan = [
    `Analyze the objective and constraints: ${sanitizedObjective}`,
    `Design an execution approach for: ${sanitizedObjective}`,
    `Implement the core work needed to achieve: ${sanitizedObjective}`,
    `Validate outputs and quality against the objective: ${sanitizedObjective}`,
    `Summarize results, risks, and any follow-up actions for: ${sanitizedObjective}`
  ];

  return genericPlan.slice(0, targetSteps);
}

export async function createAndStartPlan(input: {
  objective: string;
  defaultAgentId: string;
  stepPrompts?: string[];
  maxSteps?: number;
  teamAgentIds?: string[];
  executionStrategy?: OrchestrationExecutionStrategy;
  executionMode?: TaskExecutionMode;
  assignmentStrategy?: AssignmentStrategy;
  conversationId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<OrchestrationSummary> {
  const executionStrategy = normalizeExecutionStrategy(input.executionStrategy);
  const assignmentStrategy = normalizeAssignmentStrategy(input.assignmentStrategy);
  const teamAgentIds = resolveTeamAgentIds(input.defaultAgentId, input.teamAgentIds);
  const parentTaskId = typeof input.metadata?.parentTaskId === 'string'
    ? input.metadata.parentTaskId
    : undefined;
  const workspaceId = typeof input.metadata?.workspaceId === 'string'
    ? input.metadata.workspaceId
    : (getCurrentWorkspaceIdOrDefault() ?? 'workspace-default');

  const prompts = input.stepPrompts && input.stepPrompts.length > 0
    ? input.stepPrompts
      .map((stepPrompt) => normalizePrompt(stepPrompt))
      .filter((stepPrompt) => stepPrompt.length > 0)
    : generateStepPromptsFromObjective(input.objective, input.maxSteps);

  if (prompts.length === 0) {
    throw new Error('Unable to create a plan without at least one valid step prompt');
  }

  const steps = createSimpleStepPlan(
    input.objective,
    teamAgentIds,
    prompts,
    executionStrategy,
    assignmentStrategy
  );

  const plan = await createPlan({
    objective: input.objective,
    metadata: {
      ...(input.metadata ?? {}),
      conversationId: input.conversationId,
      runId: input.runId,
      teamAgentIds,
      executionStrategy,
      assignmentStrategy
    },
    steps
  });

  const readySteps = getReadySteps(plan.id);
  await startReadySteps(plan.id, readySteps, input.executionMode, workspaceId, {
    parentTaskId,
    conversationId: input.conversationId,
    runId: input.runId
  });

  return {
    planId: plan.id,
    ...(parentTaskId ? { rootTaskId: parentTaskId } : {}),
    totalSteps: plan.steps.length,
    readySteps: readySteps.length,
    executionStrategy,
    teamAgentIds,
    assignmentStrategy
  };
}

export async function createAndStartDagPlan(input: {
  objective: string;
  defaultAgentId: string;
  steps: DagStepDefinition[];
  teamAgentIds?: string[];
  executionMode?: TaskExecutionMode;
  assignmentStrategy?: AssignmentStrategy;
  conversationId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<OrchestrationSummary> {
  const flags = getFeatureFlags();
  if (!flags.FEATURE_ADVANCED_DAG) {
    throw new Error('DAG orchestration is disabled. Enable FEATURE_ADVANCED_DAG=true to use this endpoint.');
  }

  const assignmentStrategy = normalizeAssignmentStrategy(input.assignmentStrategy);
  const teamAgentIds = resolveTeamAgentIds(input.defaultAgentId, input.teamAgentIds);
  const parentTaskId = typeof input.metadata?.parentTaskId === 'string'
    ? input.metadata.parentTaskId
    : undefined;
  const workspaceId = typeof input.metadata?.workspaceId === 'string'
    ? input.metadata.workspaceId
    : (getCurrentWorkspaceIdOrDefault() ?? 'workspace-default');

  const steps = createDagStepPlan(
    input.objective,
    input.defaultAgentId,
    teamAgentIds,
    input.steps,
    assignmentStrategy
  );

  const plan = await createPlan({
    objective: input.objective,
    metadata: {
      ...(input.metadata ?? {}),
      conversationId: input.conversationId,
      runId: input.runId,
      teamAgentIds,
      executionStrategy: 'dag',
      assignmentStrategy,
      advancedDag: true
    },
    steps
  });

  const readySteps = getReadySteps(plan.id);
  await startReadySteps(plan.id, readySteps, input.executionMode, workspaceId, {
    parentTaskId,
    conversationId: input.conversationId,
    runId: input.runId
  });

  return {
    planId: plan.id,
    ...(parentTaskId ? { rootTaskId: parentTaskId } : {}),
    totalSteps: plan.steps.length,
    readySteps: readySteps.length,
    executionStrategy: 'dag',
    teamAgentIds,
    assignmentStrategy
  };
}

export async function handleTaskCompletion(task: Task): Promise<void> {
  if (!task.planId || !task.stepId) {
    return;
  }

  await updateStepStatus(task.planId, task.stepId, 'completed', {
    output: task.result
  });

  const readySteps = getReadySteps(task.planId);
  for (const step of readySteps) {
    if (step.taskId) {
      continue;
    }

    const childTask: Task = {
      id: '',
      agentId: step.agentId,
      type: step.taskType,
      data: step.taskData,
      executionMode: task.executionMode,
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      planId: task.planId,
      stepId: step.id,
      parentTaskId: task.id,
      metadata: {
        orchestration: true,
        workspaceId: task.workspaceId
      },
      workspaceId: task.workspaceId,
      conversationId: task.conversationId,
      runId: task.runId
    };

    const childTaskId = await submitTask(childTask);
    await updateStepStatus(task.planId, step.id, 'running', { taskId: childTaskId });
    linkChildTask(task.id, childTaskId);
  }

  const plan = getPlan(task.planId);
  if (plan && plan.steps.every((step) => step.status === 'completed' || step.status === 'skipped')) {
    await updatePlanStatus(task.planId, 'completed');
  }
}

export async function handleTaskFailure(task: Task): Promise<void> {
  if (!task.planId || !task.stepId) {
    return;
  }

  await updateStepStatus(task.planId, task.stepId, 'failed', {
    error: task.error
  });

  await updatePlanStatus(task.planId, 'failed');
}

export function getPlanById(planId: string): Plan | undefined {
  return getPlan(planId);
}

export function getTaskById(taskId: string): Task | undefined {
  return getTask(taskId);
}
