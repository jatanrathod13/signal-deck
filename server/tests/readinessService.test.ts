import { getReadinessSnapshot } from '../src/services/readinessService';

jest.mock('../config/redis', () => ({
  redis: {
    ping: jest.fn()
  }
}));

jest.mock('../src/lib/supabaseClient', () => ({
  checkSupabaseReadiness: jest.fn()
}));

jest.mock('../src/services/taskQueueService', () => ({
  getTaskQueueHealth: jest.fn()
}));

import { redis } from '../config/redis';
import { checkSupabaseReadiness } from '../src/lib/supabaseClient';
import { getTaskQueueHealth } from '../src/services/taskQueueService';

const redisPingMock = redis.ping as jest.MockedFunction<typeof redis.ping>;
const checkSupabaseReadinessMock = checkSupabaseReadiness as jest.MockedFunction<typeof checkSupabaseReadiness>;
const getTaskQueueHealthMock = getTaskQueueHealth as jest.MockedFunction<typeof getTaskQueueHealth>;

describe('readinessService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ok when all dependencies are healthy', async () => {
    redisPingMock.mockResolvedValue('PONG');
    checkSupabaseReadinessMock.mockResolvedValue({ ok: true, detail: 'reachable' });
    getTaskQueueHealthMock.mockResolvedValue({
      ok: true,
      detail: 'reachable',
      waiting: 0,
      active: 0,
      failed: 0
    });

    const snapshot = await getReadinessSnapshot();

    expect(snapshot.status).toBe('ok');
    expect(snapshot.checks.redis.ok).toBe(true);
    expect(snapshot.checks.database.ok).toBe(true);
    expect(snapshot.checks.queue.ok).toBe(true);
  });

  it('returns degraded when any dependency fails', async () => {
    redisPingMock.mockRejectedValue(new Error('redis down'));
    checkSupabaseReadinessMock.mockResolvedValue({ ok: true, detail: 'reachable' });
    getTaskQueueHealthMock.mockResolvedValue({
      ok: true,
      detail: 'reachable',
      waiting: 1,
      active: 0,
      failed: 0
    });

    const snapshot = await getReadinessSnapshot();

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.checks.redis.ok).toBe(false);
    expect(snapshot.checks.redis.detail).toContain('redis down');
  });
});
