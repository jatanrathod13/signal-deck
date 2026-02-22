/**
 * PlanService Tests
 * Verifies plan lifecycle and dependency-driven step readiness.
 */

// Mock ioredis with pipeline support for plan persistence.
const mockPipeline = {
  set: jest.fn().mockReturnThis(),
  sadd: jest.fn().mockReturnThis(),
  get: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([])
};

const mockRedis = {
  pipeline: jest.fn(() => mockPipeline),
  smembers: jest.fn().mockResolvedValue([]),
  ping: jest.fn().mockResolvedValue('PONG')
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

import { createPlan, getReadySteps, getPlan, updateStepStatus } from '../src/services/planService';

describe('PlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates sequential dependencies and exposes first step as ready', async () => {
    const plan = await createPlan({
      objective: 'Deliver feature in stages',
      steps: [
        {
          title: 'Analyze',
          agentId: 'agent-a',
          taskType: 'analyze',
          taskData: { prompt: 'Analyze requirements' }
        },
        {
          title: 'Implement',
          agentId: 'agent-b',
          taskType: 'implement',
          taskData: { prompt: 'Implement changes' }
        },
        {
          title: 'Validate',
          agentId: 'agent-c',
          taskType: 'validate',
          taskData: { prompt: 'Run validation' }
        }
      ]
    });

    expect(plan.status).toBe('active');
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0].dependsOnStepIds).toEqual([]);
    expect(plan.steps[1].dependsOnStepIds).toEqual([plan.steps[0].id]);
    expect(plan.steps[2].dependsOnStepIds).toEqual([plan.steps[1].id]);

    const readySteps = getReadySteps(plan.id);
    expect(readySteps).toHaveLength(1);
    expect(readySteps[0].id).toBe(plan.steps[0].id);
  });

  it('unblocks dependent steps when prior step is completed', async () => {
    const plan = await createPlan({
      objective: 'Multi-step execution',
      steps: [
        {
          title: 'Step 1',
          agentId: 'agent-a',
          taskType: 's1',
          taskData: { prompt: 'S1' }
        },
        {
          title: 'Step 2',
          agentId: 'agent-a',
          taskType: 's2',
          taskData: { prompt: 'S2' }
        }
      ]
    });

    await updateStepStatus(plan.id, plan.steps[0].id, 'completed');

    const readySteps = getReadySteps(plan.id);
    expect(readySteps).toHaveLength(1);
    expect(readySteps[0].id).toBe(plan.steps[1].id);
  });

  it('marks plan as failed when any step fails', async () => {
    const plan = await createPlan({
      objective: 'Failure handling',
      steps: [
        {
          title: 'Only Step',
          agentId: 'agent-a',
          taskType: 'single',
          taskData: { prompt: 'Do work' }
        }
      ]
    });

    await updateStepStatus(plan.id, plan.steps[0].id, 'failed', { error: 'boom' });
    const updatedPlan = getPlan(plan.id);

    expect(updatedPlan?.status).toBe('failed');
    expect(updatedPlan?.steps[0].error).toBe('boom');
  });
});
