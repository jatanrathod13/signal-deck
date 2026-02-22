import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  resetScheduleStateForTests,
  triggerScheduleNow,
  updateSchedule
} from '../src/services/scheduleService';

jest.mock('../src/services/taskQueueService', () => ({
  submitTask: jest.fn().mockResolvedValue('task-scheduled-1')
}));

import { submitTask } from '../src/services/taskQueueService';

const submitTaskMock = submitTask as jest.MockedFunction<typeof submitTask>;

describe('scheduleService', () => {
  beforeEach(() => {
    process.env.DEFAULT_WORKSPACE_ID = 'workspace-test';
    resetScheduleStateForTests();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    resetScheduleStateForTests();
  });

  it('creates a schedule and computes next run', async () => {
    const schedule = await createSchedule({
      name: 'Quarter Hourly',
      cronExpression: '*/15 * * * *',
      timezone: 'UTC',
      payload: {
        agentId: 'agent-1',
        type: 'scheduled-task',
        data: { prompt: 'hello' }
      }
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.nextRunAt).toBeDefined();
    expect(schedule.lastRunStatus).toBe('never');
    expect(getSchedule(schedule.id)?.name).toBe('Quarter Hourly');
  });

  it('triggers a schedule and queues a task', async () => {
    const schedule = await createSchedule({
      name: 'Triggerable',
      cronExpression: '*/10 * * * *',
      timezone: 'UTC',
      payload: {
        agentId: 'agent-1',
        type: 'scheduled-task',
        data: { x: 1 }
      }
    });

    await triggerScheduleNow(schedule.id);

    expect(submitTaskMock).toHaveBeenCalledTimes(1);
    expect(getSchedule(schedule.id)?.lastRunStatus).toBe('succeeded');
  });

  it('updates and deletes a schedule', async () => {
    const schedule = await createSchedule({
      name: 'Mutable',
      cronExpression: '*/5 * * * *',
      timezone: 'UTC',
      payload: {
        agentId: 'agent-1',
        type: 'scheduled-task'
      }
    });

    const updated = await updateSchedule(schedule.id, {
      enabled: false,
      name: 'Mutable-Updated'
    });

    expect(updated?.enabled).toBe(false);
    expect(updated?.name).toBe('Mutable-Updated');

    const deleted = await deleteSchedule(schedule.id);
    expect(deleted).toBe(true);
    expect(getSchedule(schedule.id)).toBeUndefined();
  });
});
