/**
 * OrchestratorService
 * Coordinates plan execution and parent-child task flow.
 */

import {
  OrchestrationExecutionStrategy,
  OrchestrationSummary,
  Plan,
  Task,
  TaskExecutionMode
} from '../../types';
import { createPlan, getPlan, getReadySteps, updatePlanStatus, updateStepStatus } from './planService';
import { submitTask, getTask, linkChildTask } from './taskQueueService';

const DEFAULT_AUTO_PLAN_MAX_STEPS = 5;
const MIN_AUTO_PLAN_STEPS = 2;
const MAX_AUTO_PLAN_STEPS = 10;

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

/**
 * Build practical step prompts from a natural-language objective.
 * This keeps orchestration available even when callers do not provide explicit steps.
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

function createSimpleStepPlan(
  objective: string,
  agentIds: string[],
  stepPrompts: string[],
  executionStrategy: OrchestrationExecutionStrategy
): Array<{
  title: string;
  description: string;
  agentId: string;
  taskType: string;
  taskData: Record<string, unknown>;
  dependsOnStepIds?: string[];
}> {
  const hasParallelExecution = executionStrategy === 'parallel';

  return stepPrompts.map((prompt, index) => ({
    title: `Step ${index + 1}`,
    description: prompt,
    agentId: agentIds[index % agentIds.length],
    taskType: 'orchestration-step',
    taskData: {
      prompt,
      objective,
      stepNumber: index + 1
    },
    dependsOnStepIds: hasParallelExecution ? [] : undefined
  }));
}

function normalizeExecutionStrategy(value?: string): OrchestrationExecutionStrategy {
  return value === 'parallel' ? 'parallel' : 'sequential';
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

export async function createAndStartPlan(input: {
  objective: string;
  defaultAgentId: string;
  stepPrompts?: string[];
  maxSteps?: number;
  teamAgentIds?: string[];
  executionStrategy?: OrchestrationExecutionStrategy;
  executionMode?: TaskExecutionMode;
  conversationId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<OrchestrationSummary> {
  const executionStrategy = normalizeExecutionStrategy(input.executionStrategy);
  const teamAgentIds = resolveTeamAgentIds(input.defaultAgentId, input.teamAgentIds);
  const parentTaskId = typeof input.metadata?.parentTaskId === 'string'
    ? input.metadata.parentTaskId
    : undefined;

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
    executionStrategy
  );
  const plan = await createPlan({
    objective: input.objective,
    metadata: {
      ...(input.metadata ?? {}),
      conversationId: input.conversationId,
      runId: input.runId,
      teamAgentIds,
      executionStrategy
    },
    steps
  });

  const readySteps = getReadySteps(plan.id);
  for (const step of readySteps) {
    const task: Task = {
      id: '',
      agentId: step.agentId,
      type: step.taskType,
      data: step.taskData,
      executionMode: input.executionMode,
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentTaskId,
      planId: plan.id,
      stepId: step.id,
      metadata: {
        orchestration: true
      },
      conversationId: input.conversationId,
      runId: input.runId
    };

    const taskId = await submitTask(task);
    await updateStepStatus(plan.id, step.id, 'running', { taskId });
  }

  return {
    planId: plan.id,
    ...(parentTaskId ? { rootTaskId: parentTaskId } : {}),
    totalSteps: plan.steps.length,
    readySteps: readySteps.length,
    executionStrategy,
    teamAgentIds
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
        orchestration: true
      },
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
