import {
  clearDeadLetters,
  enqueueDeadLetter,
  getDeadLetter,
  getDeadLetterSnapshot,
  listDeadLetters,
  markDeadLetterStatus
} from '../src/services/deadLetterQueueService';
import { Task } from '../types';

describe('deadLetterQueueService', () => {
  const baseTask: Task = {
    id: 'task-1',
    workspaceId: 'workspace-1',
    agentId: 'agent-1',
    type: 'test-task',
    data: { prompt: 'hello' },
    status: 'failed',
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    retryCount: 0
  };

  beforeEach(() => {
    clearDeadLetters();
    delete process.env.FEATURE_DEAD_LETTER_QUEUE;
  });

  it('captures dead letter entries with pending status', () => {
    const entry = enqueueDeadLetter(baseTask, 'boom', 'tool_error');

    expect(entry.status).toBe('pending');
    expect(entry.taskId).toBe(baseTask.id);
    expect(getDeadLetter(entry.id)).toBeDefined();
    expect(listDeadLetters('workspace-1')).toHaveLength(1);
  });

  it('updates dead letter status and metadata', () => {
    const entry = enqueueDeadLetter(baseTask, 'failure', 'unknown_error');
    const updated = markDeadLetterStatus(entry.id, 'requeued', {
      requeuedTaskId: 'task-2'
    });

    expect(updated?.status).toBe('requeued');
    expect(updated?.metadata?.requeuedTaskId).toBe('task-2');
  });

  it('reports snapshot including enabled flag and pending counts', () => {
    process.env.FEATURE_DEAD_LETTER_QUEUE = 'true';
    enqueueDeadLetter(baseTask, 'failure-1', 'unknown_error');
    const second = enqueueDeadLetter({
      ...baseTask,
      id: 'task-2',
      retryCount: 1
    }, 'failure-2', 'timeout');
    markDeadLetterStatus(second.id, 'discarded');

    const snapshot = getDeadLetterSnapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.entries).toBe(2);
    expect(snapshot.pending).toBe(1);
  });
});
