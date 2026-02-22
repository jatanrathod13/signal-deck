/**
 * OrchestratorService
 * Coordinates plan execution and parent-child task flow.
 */

import { Plan, OrchestrationSummary, Task } from '../../types';
import { createPlan, getPlan, getReadySteps, updatePlanStatus, updateStepStatus } from './planService';
import { submitTask, getTask, linkChildTask } from './taskQueueService';

function createSimpleStepPlan(
  objective: string,
  defaultAgentId: string,
  stepPrompts: string[]
): Array<{
  title: string;
  description: string;
  agentId: string;
  taskType: string;
  taskData: Record<string, unknown>;
  dependsOnStepIds?: string[];
}> {
  return stepPrompts.map((prompt, index) => ({
    title: `Step ${index + 1}`,
    description: prompt,
    agentId: defaultAgentId,
    taskType: 'orchestration-step',
    taskData: {
      prompt,
      objective,
      stepNumber: index + 1
    }
  }));
}

export async function createAndStartPlan(input: {
  objective: string;
  defaultAgentId: string;
  stepPrompts: string[];
  metadata?: Record<string, unknown>;
}): Promise<OrchestrationSummary> {
  const steps = createSimpleStepPlan(input.objective, input.defaultAgentId, input.stepPrompts);
  const plan = await createPlan({
    objective: input.objective,
    metadata: input.metadata,
    steps
  });

  const readySteps = getReadySteps(plan.id);
  for (const step of readySteps) {
    const task: Task = {
      id: '',
      agentId: step.agentId,
      type: step.taskType,
      data: step.taskData,
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      planId: plan.id,
      stepId: step.id,
      metadata: {
        orchestration: true
      }
    };

    const taskId = await submitTask(task);
    await updateStepStatus(plan.id, step.id, 'running', { taskId });
  }

  return {
    planId: plan.id,
    totalSteps: plan.steps.length,
    readySteps: readySteps.length
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
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      planId: task.planId,
      stepId: step.id,
      parentTaskId: task.id,
      metadata: {
        orchestration: true
      }
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
