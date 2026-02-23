/**
 * QuotaService tests
 * Verifies workspace-scoped quota metering and enforcement.
 */

jest.mock('../config/redis', () => ({
  redis: {}
}));

import {
  enforceRunStartQuota,
  enforceTaskSubmissionQuota,
  getQuotaUsage,
  QuotaExceededError,
  resetQuotaStateForTests
} from '../src/services/quotaService';

describe('QuotaService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      FEATURE_QUOTA_ENFORCEMENT: 'true',
      QUOTA_MAX_TASKS_PER_HOUR: '2',
      QUOTA_MAX_RUNS_PER_DAY: '1'
    };
    resetQuotaStateForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('meters task submissions per workspace and throws on limit exceed', async () => {
    await enforceTaskSubmissionQuota('workspace-a');
    await enforceTaskSubmissionQuota('workspace-a');

    await expect(enforceTaskSubmissionQuota('workspace-a')).rejects.toBeInstanceOf(QuotaExceededError);

    const usage = await getQuotaUsage('workspace-a');
    expect(usage.tasksSubmittedInWindow).toBe(2);
  });

  it('tracks task quota independently across workspaces', async () => {
    await enforceTaskSubmissionQuota('workspace-a');
    await enforceTaskSubmissionQuota('workspace-b');

    const usageA = await getQuotaUsage('workspace-a');
    const usageB = await getQuotaUsage('workspace-b');

    expect(usageA.tasksSubmittedInWindow).toBe(1);
    expect(usageB.tasksSubmittedInWindow).toBe(1);
  });

  it('enforces run quota per day', async () => {
    await enforceRunStartQuota('workspace-a');

    await expect(enforceRunStartQuota('workspace-a')).rejects.toBeInstanceOf(QuotaExceededError);

    const usage = await getQuotaUsage('workspace-a');
    expect(usage.runsStartedInWindow).toBe(1);
  });
});
