import { createHmac } from 'crypto';
import {
  createWebhook,
  enqueueWebhookNotification,
  getWebhook,
  initializeWebhookService,
  resetWebhookStateForTests,
  stopWebhookService,
  triggerInboundWebhook,
  updateWebhook
} from '../src/services/webhookService';

jest.mock('../src/services/taskQueueService', () => ({
  submitTask: jest.fn().mockResolvedValue('task-webhook-1')
}));

import { submitTask } from '../src/services/taskQueueService';

const submitTaskMock = submitTask as jest.MockedFunction<typeof submitTask>;

describe('webhookService', () => {
  beforeEach(async () => {
    process.env.DEFAULT_WORKSPACE_ID = 'workspace-test';
    process.env.WEBHOOK_RETRY_TICK_MS = '20';
    process.env.WEBHOOK_RETRY_BASE_SECONDS = '1';
    process.env.WEBHOOK_REQUEST_TIMEOUT_MS = '1000';
    delete process.env.ALLOW_UNREGISTERED_INBOUND_WEBHOOKS;
    jest.clearAllMocks();
    resetWebhookStateForTests();
  });

  afterEach(async () => {
    await stopWebhookService();
    resetWebhookStateForTests();
    jest.useRealTimers();
    delete process.env.ALLOW_UNREGISTERED_INBOUND_WEBHOOKS;
  });

  it('accepts signed inbound webhooks and submits a task', async () => {
    await createWebhook({
      direction: 'inbound',
      eventName: 'agent.triggered',
      metadata: {
        secret: 'test-secret'
      }
    });

    const payload = {
      task: {
        agentId: 'agent-1',
        type: 'webhook-task',
        data: { source: 'test' }
      }
    };

    const signature = createHmac('sha256', 'test-secret')
      .update(JSON.stringify(payload))
      .digest('hex');

    const result = await triggerInboundWebhook('agent.triggered', payload, signature);

    expect(result.taskId).toBe('task-webhook-1');
    expect(submitTaskMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unregistered inbound webhook without authenticated workspace context', async () => {
    process.env.ALLOW_UNREGISTERED_INBOUND_WEBHOOKS = 'true';

    await expect(triggerInboundWebhook(
      'agent.triggered',
      {
        task: {
          agentId: 'agent-1',
          type: 'webhook-task'
        }
      },
      undefined
    )).rejects.toThrow('authenticated workspace context');
  });

  it('retries outbound webhook delivery after failure', async () => {
    jest.useFakeTimers();
    await initializeWebhookService();

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        status: 500,
        text: async () => 'upstream error'
      })
      .mockResolvedValueOnce({
        status: 200,
        text: async () => 'ok'
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const webhook = await createWebhook({
      direction: 'outbound',
      eventName: 'task.completed',
      targetUrl: 'https://example.com/hooks/task-completed',
      status: 'failed',
      maxAttempts: 3
    });

    await updateWebhook(webhook.id, { status: 'pending' });
    await enqueueWebhookNotification('task.completed', {
      taskId: 'task-123',
      status: 'completed'
    });

    await jest.advanceTimersByTimeAsync(2500);

    const updated = getWebhook(webhook.id);
    expect(updated?.status).toBe('delivered');
    expect(updated?.responseStatus).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resets outbound attemptCount when a new event is queued', async () => {
    jest.useFakeTimers();
    await initializeWebhookService();

    const fetchMock = jest.fn().mockResolvedValue({
      status: 500,
      text: async () => 'upstream error'
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const webhook = await createWebhook({
      direction: 'outbound',
      eventName: 'task.completed',
      targetUrl: 'https://example.com/hooks/task-completed',
      maxAttempts: 3,
      status: 'failed'
    });

    await updateWebhook(webhook.id, { status: 'pending' });
    await enqueueWebhookNotification('task.completed', {
      taskId: 'task-111',
      status: 'completed'
    });
    await jest.advanceTimersByTimeAsync(50);

    await enqueueWebhookNotification('task.completed', {
      taskId: 'task-456',
      status: 'completed'
    });

    const updated = getWebhook(webhook.id);
    expect(updated?.status).toBe('pending');
    expect(updated?.attemptCount).toBe(0);
  });
});
