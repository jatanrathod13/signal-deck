/**
 * OrchestratorService Tests
 * Verifies auto-generated plans and orchestration startup behavior.
 */

const createPlanMock = jest.fn();
const getPlanMock = jest.fn();
const getReadyStepsMock = jest.fn();
const updatePlanStatusMock = jest.fn();
const updateStepStatusMock = jest.fn();

const submitTaskMock = jest.fn();
const getTaskMock = jest.fn();
const linkChildTaskMock = jest.fn();

jest.mock('../src/services/planService', () => ({
  createPlan: (...args: unknown[]) => createPlanMock(...args),
  getPlan: (...args: unknown[]) => getPlanMock(...args),
  getReadySteps: (...args: unknown[]) => getReadyStepsMock(...args),
  updatePlanStatus: (...args: unknown[]) => updatePlanStatusMock(...args),
  updateStepStatus: (...args: unknown[]) => updateStepStatusMock(...args)
}));

jest.mock('../src/services/taskQueueService', () => ({
  submitTask: (...args: unknown[]) => submitTaskMock(...args),
  getTask: (...args: unknown[]) => getTaskMock(...args),
  linkChildTask: (...args: unknown[]) => linkChildTaskMock(...args)
}));

import { createAndStartPlan, generateStepPromptsFromObjective } from '../src/services/orchestratorService';

describe('OrchestratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates multiple step prompts from a compound objective', () => {
    const prompts = generateStepPromptsFromObjective('Collect requirements and implement feature; validate output', 4);

    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts[0]).toContain('Complete part 1:');
  });

  it('creates and starts an auto-generated plan when stepPrompts are omitted', async () => {
    const planId = 'plan-1';
    const stepId = 'step-1';

    createPlanMock.mockResolvedValue({
      id: planId,
      steps: [{ id: stepId }]
    });

    getReadyStepsMock.mockReturnValue([
      {
        id: stepId,
        agentId: 'agent-1',
        taskType: 'orchestration-step',
        taskData: { prompt: 'Do work' }
      }
    ]);

    submitTaskMock.mockResolvedValue('task-1');
    updateStepStatusMock.mockResolvedValue(undefined);

    const summary = await createAndStartPlan({
      objective: 'Build and verify release artifact',
      defaultAgentId: 'agent-1',
      maxSteps: 3
    });

    expect(createPlanMock).toHaveBeenCalledWith(expect.objectContaining({
      objective: 'Build and verify release artifact'
    }));

    const firstCreatePlanArg = createPlanMock.mock.calls[0][0] as {
      steps: Array<{ taskData: { prompt: string } }>;
    };

    expect(firstCreatePlanArg.steps.length).toBeGreaterThan(0);
    expect(firstCreatePlanArg.steps[0].taskData.prompt).toEqual(expect.any(String));

    expect(submitTaskMock).toHaveBeenCalledTimes(1);
    expect(updateStepStatusMock).toHaveBeenCalledWith(planId, stepId, 'running', { taskId: 'task-1' });

    expect(summary).toEqual(expect.objectContaining({
      planId,
      totalSteps: 1,
      readySteps: 1,
      executionStrategy: 'sequential',
      teamAgentIds: ['agent-1']
    }));
  });

  it('creates parallel team plans with round-robin agent assignment', async () => {
    createPlanMock.mockResolvedValue({
      id: 'plan-team-1',
      steps: [{ id: 'step-a' }, { id: 'step-b' }, { id: 'step-c' }]
    });

    getReadyStepsMock.mockReturnValue([]);

    await createAndStartPlan({
      objective: 'Ship feature in parallel',
      defaultAgentId: 'agent-1',
      teamAgentIds: ['agent-1', 'agent-2'],
      executionStrategy: 'parallel',
      stepPrompts: ['Research', 'Implement', 'Validate']
    });

    const firstCreatePlanArg = createPlanMock.mock.calls[0][0] as {
      steps: Array<{ agentId: string; dependsOnStepIds?: string[] }>;
      metadata: { executionStrategy: string; teamAgentIds: string[] };
    };

    expect(firstCreatePlanArg.metadata.executionStrategy).toBe('parallel');
    expect(firstCreatePlanArg.metadata.teamAgentIds).toEqual(['agent-1', 'agent-2']);
    expect(firstCreatePlanArg.steps.map((step) => step.agentId)).toEqual(['agent-1', 'agent-2', 'agent-1']);
    expect(firstCreatePlanArg.steps.every((step) => Array.isArray(step.dependsOnStepIds) && step.dependsOnStepIds.length === 0))
      .toBe(true);
  });
});
