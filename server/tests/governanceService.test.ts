/**
 * GovernanceService Tests
 * Verifies approval persistence and startup hydration.
 */

const mockPipeline = {
  set: jest.fn().mockReturnThis(),
  sadd: jest.fn().mockReturnThis(),
  get: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([])
};

jest.mock('../config/redis', () => ({
  redis: {
    pipeline: jest.fn(() => mockPipeline),
    smembers: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../src/services/conversationService', () => ({
  appendRunEvent: jest.fn(),
  getRun: jest.fn().mockReturnValue({
    id: 'run-1',
    conversationId: 'conv-1',
    status: 'running',
    startedAt: new Date('2026-02-22T10:00:00.000Z')
  })
}));

import { redis } from '../config/redis';
import { appendRunEvent } from '../src/services/conversationService';
import {
  getApproval,
  initializeApprovalStore,
  listPendingApprovals,
  requestApproval,
  resolveApproval
} from '../src/services/governanceService';

describe('GovernanceService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (redis.smembers as jest.Mock).mockResolvedValue([]);
    mockPipeline.exec.mockResolvedValue([]);
    await initializeApprovalStore();
  });

  it('persists approvals and resolves pending callbacks', async () => {
    const pendingPromise = requestApproval(
      'dangerousTool',
      { id: '123' },
      {
        runId: 'run-1',
        conversationId: 'conv-1',
        policy: {
          enabled: true,
          autoApproveTimeout: 5000
        }
      }
    );

    const pending = listPendingApprovals('run-1')[0];
    expect(pending).toBeDefined();
    if (!pending) {
      throw new Error('Expected pending approval to exist');
    }
    expect(mockPipeline.set).toHaveBeenCalledWith(
      expect.stringContaining('approval:'),
      expect.any(String)
    );

    const resolved = resolveApproval(pending.id, 'approved', 'reviewer-1');
    expect(resolved?.status).toBe('approved');

    await expect(pendingPromise).resolves.toEqual({
      approved: true,
      approvalId: pending.id
    });

    expect(appendRunEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.requested'
    }));
    expect(appendRunEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.resolved'
    }));
  });

  it('hydrates persisted approvals from Redis on startup', async () => {
    const persistedId = 'approval-persisted-1';
    (redis.smembers as jest.Mock).mockResolvedValue([persistedId]);
    mockPipeline.exec.mockResolvedValue([
      [
        null,
        JSON.stringify({
          id: persistedId,
          runId: 'run-99',
          toolName: 'writeSharedMemory',
          reason: 'Requires approval',
          input: { key: 'x' },
          status: 'denied',
          requestedAt: '2026-02-22T10:00:00.000Z',
          resolvedAt: '2026-02-22T10:01:00.000Z',
          resolvedBy: 'admin'
        })
      ]
    ]);

    await initializeApprovalStore();

    const loaded = getApproval(persistedId);
    expect(loaded).toBeDefined();
    expect(loaded?.status).toBe('denied');
    expect(loaded?.requestedAt instanceof Date).toBe(true);
    expect(loaded?.resolvedAt instanceof Date).toBe(true);
  });
});
