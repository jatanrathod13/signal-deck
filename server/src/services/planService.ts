/**
 * PlanService
 * Provides plan and step lifecycle management.
 */

import { Plan, PlanStatus, PlanStep, PlanStepStatus } from '../../types';
import { redis } from '../../config/redis';
import { incrementMetric } from './metricsService';
import { emitPlanCreated, emitPlanStepStatus, emitPlanUpdated } from './socketService';
import { appendRunEvent } from './conversationService';
import { getCurrentWorkspaceId, getCurrentWorkspaceIdOrDefault, isWorkspaceMatch } from './workspaceContextService';

const PLAN_KEY_PREFIX = 'plan:';
const PLAN_INDEX_KEY = 'plans:index';

const plans = new Map<string, Plan>();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializePlan(plan: Plan): string {
  return JSON.stringify(plan);
}

function deserializePlan(raw: string): Plan {
  const parsed = JSON.parse(raw) as Plan;
  parsed.workspaceId = parsed.workspaceId ?? 'workspace-default';
  parsed.createdAt = new Date(parsed.createdAt);
  parsed.updatedAt = new Date(parsed.updatedAt);
  parsed.steps = parsed.steps.map((step) => ({
    ...step,
    createdAt: new Date(step.createdAt),
    updatedAt: new Date(step.updatedAt)
  }));
  return parsed;
}

async function savePlan(plan: Plan): Promise<void> {
  try {
    const pipeline = redis.pipeline();
    pipeline.set(`${PLAN_KEY_PREFIX}${plan.id}`, serializePlan(plan));
    pipeline.sadd(PLAN_INDEX_KEY, plan.id);
    await pipeline.exec();
  } catch (error) {
    console.warn('[PlanService] Failed to persist plan:', error);
  }
}

export async function initializePlans(): Promise<void> {
  try {
    const ids = await redis.smembers(PLAN_INDEX_KEY);
    if (ids.length === 0) {
      return;
    }

    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.get(`${PLAN_KEY_PREFIX}${id}`);
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
        const plan = deserializePlan(raw as string);
        plans.set(plan.id, plan);
      } catch (parseError) {
        console.warn('[PlanService] Failed to parse plan payload:', parseError);
      }
    }
  } catch (error) {
    console.warn('[PlanService] Failed to initialize plans from Redis:', error);
  }
}

export function listPlans(): Plan[] {
  return Array.from(plans.values())
    .filter((plan) => isWorkspaceMatch(plan.workspaceId, getCurrentWorkspaceId()));
}

export function getPlan(planId: string): Plan | undefined {
  const plan = plans.get(planId);
  if (!plan) {
    return undefined;
  }

  if (!isWorkspaceMatch(plan.workspaceId, getCurrentWorkspaceId())) {
    return undefined;
  }

  return plan;
}

export async function createPlan(input: {
  objective: string;
  createdByTaskId?: string;
  metadata?: Record<string, unknown>;
  steps: Array<{
    id?: string;
    title: string;
    description?: string;
    agentId: string;
    taskType: string;
    taskData: Record<string, unknown>;
    dependsOnStepIds?: string[];
  }>;
}): Promise<Plan> {
  const now = new Date();
  const planId = generateId('plan');

  const steps: PlanStep[] = [];
  for (let index = 0; index < input.steps.length; index += 1) {
    const stepInput = input.steps[index];
    const previousStep = steps[index - 1];

    const stepId = stepInput.id ?? generateId('step');

    steps.push({
      id: stepId,
      planId,
      title: stepInput.title,
      description: stepInput.description,
      agentId: stepInput.agentId,
      taskType: stepInput.taskType,
      taskData: stepInput.taskData,
      dependsOnStepIds: stepInput.dependsOnStepIds ?? (previousStep ? [previousStep.id] : []),
      status: 'pending',
      createdAt: now,
      updatedAt: now
    });
  }

  const plan: Plan = {
    id: planId,
    workspaceId: typeof input.metadata?.workspaceId === 'string'
      ? input.metadata.workspaceId
      : getCurrentWorkspaceIdOrDefault() ?? 'workspace-default',
    objective: input.objective,
    status: 'active',
    createdByTaskId: input.createdByTaskId,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata,
    steps
  };

  plans.set(plan.id, plan);
  incrementMetric('plansCreated');
  emitPlanCreated(plan.id);
  emitPlanUpdated(plan.id, plan.status);
  await savePlan(plan);

  const conversationId = typeof input.metadata?.conversationId === 'string'
    ? input.metadata.conversationId
    : undefined;
  const runId = typeof input.metadata?.runId === 'string'
    ? input.metadata.runId
    : undefined;

  if (conversationId && runId) {
    appendRunEvent({
      runId,
      conversationId,
      type: 'plan.created',
      payload: {
        planId: plan.id,
        objective: plan.objective,
        totalSteps: plan.steps.length
      }
    });
  }

  return plan;
}

export async function updatePlanStatus(planId: string, status: PlanStatus): Promise<Plan | undefined> {
  const plan = plans.get(planId);
  if (!plan) {
    return undefined;
  }

  plan.status = status;
  plan.updatedAt = new Date();
  emitPlanUpdated(plan.id, status);
  await savePlan(plan);
  return plan;
}

export async function updateStepStatus(
  planId: string,
  stepId: string,
  status: PlanStepStatus,
  updates?: Partial<PlanStep>
): Promise<PlanStep | undefined> {
  const plan = plans.get(planId);
  if (!plan) {
    return undefined;
  }

  const step = plan.steps.find((candidate) => candidate.id === stepId);
  if (!step) {
    return undefined;
  }

  step.status = status;
  step.updatedAt = new Date();
  emitPlanStepStatus(planId, stepId, status);
  if (updates) {
    Object.assign(step, updates);
  }

  if (status === 'completed') {
    incrementMetric('planStepsCompleted');
  }

  if (status === 'failed') {
    incrementMetric('planStepsFailed');
  }

  if (plan.steps.every((candidate) => candidate.status === 'completed' || candidate.status === 'skipped')) {
    plan.status = 'completed';
  } else if (plan.steps.some((candidate) => candidate.status === 'failed')) {
    plan.status = 'failed';
  }

  emitPlanUpdated(plan.id, plan.status);

  const conversationId = typeof plan.metadata?.conversationId === 'string'
    ? plan.metadata.conversationId
    : undefined;
  const runId = typeof plan.metadata?.runId === 'string'
    ? plan.metadata.runId
    : undefined;

  if (conversationId && runId) {
    appendRunEvent({
      runId,
      conversationId,
      type: 'plan.step.status',
      payload: {
        planId,
        stepId,
        status
      }
    });
  }

  plan.updatedAt = new Date();
  await savePlan(plan);

  return step;
}

export function getReadySteps(planId: string): PlanStep[] {
  const plan = plans.get(planId);
  if (!plan) {
    return [];
  }

  const stepMap = new Map(plan.steps.map((step) => [step.id, step]));

  return plan.steps.filter((step) => {
    if (step.status !== 'pending' && step.status !== 'blocked') {
      return false;
    }

    return step.dependsOnStepIds.every((dependencyId) => {
      const dependency = stepMap.get(dependencyId);
      return dependency?.status === 'completed' || dependency?.status === 'skipped';
    });
  });
}
