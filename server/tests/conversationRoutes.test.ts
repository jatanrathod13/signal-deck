import express from 'express';
import request from 'supertest';

const addConversationMessageMock = jest.fn();
const appendRunEventMock = jest.fn();
const createRunMock = jest.fn();
const getConversationMock = jest.fn();
const listConversationEventsMock = jest.fn();
const listConversationMessagesMock = jest.fn();
const listConversationsMock = jest.fn();
const updateRunMock = jest.fn();
const createConversationMock = jest.fn();

const listAgentsMock = jest.fn();
const submitTaskMock = jest.fn();
const enforceRunStartQuotaMock = jest.fn();
const getCurrentWorkspaceIdMock = jest.fn();

jest.mock('../src/services/conversationService', () => ({
  addConversationMessage: (...args: unknown[]) => addConversationMessageMock(...args),
  appendRunEvent: (...args: unknown[]) => appendRunEventMock(...args),
  createConversation: (...args: unknown[]) => createConversationMock(...args),
  createRun: (...args: unknown[]) => createRunMock(...args),
  getConversation: (...args: unknown[]) => getConversationMock(...args),
  listConversationEvents: (...args: unknown[]) => listConversationEventsMock(...args),
  listConversationMessages: (...args: unknown[]) => listConversationMessagesMock(...args),
  listConversations: (...args: unknown[]) => listConversationsMock(...args),
  updateRun: (...args: unknown[]) => updateRunMock(...args)
}));

jest.mock('../src/services/agentService', () => ({
  listAgents: (...args: unknown[]) => listAgentsMock(...args)
}));

jest.mock('../src/services/taskQueueService', () => ({
  submitTask: (...args: unknown[]) => submitTaskMock(...args)
}));

jest.mock('../src/services/quotaService', () => ({
  enforceRunStartQuota: (...args: unknown[]) => enforceRunStartQuotaMock(...args),
  QuotaExceededError: class QuotaExceededError extends Error {
    metric = 'runs_per_day';
    limit = 1;
    current = 1;
    workspaceId = 'workspace-default';
  }
}));

jest.mock('../src/services/workspaceContextService', () => ({
  getCurrentWorkspaceId: (...args: unknown[]) => getCurrentWorkspaceIdMock(...args)
}));

jest.mock('../types', () => ({
  getFeatureFlags: () => ({
    FEATURE_DEEP_RESEARCH: false
  })
}));

import conversationRoutes from '../src/routes/conversationRoutes';

describe('conversationRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getConversationMock.mockReturnValue({
      id: 'conv-1',
      title: 'Test Conversation'
    });
    listAgentsMock.mockReturnValue([
      { id: 'agent-1', status: 'idle' }
    ]);
    addConversationMessageMock.mockReturnValue({
      id: 'msg-1',
      content: 'Ship this feature'
    });
    createRunMock.mockReturnValue({
      id: 'run-1',
      conversationId: 'conv-1',
      status: 'pending'
    });
    submitTaskMock.mockResolvedValue('task-1');
    updateRunMock.mockReturnValue({
      id: 'run-1',
      conversationId: 'conv-1',
      status: 'running',
      rootTaskId: 'task-1'
    });
    enforceRunStartQuotaMock.mockResolvedValue(undefined);
    getCurrentWorkspaceIdMock.mockReturnValue('workspace-default');
  });

  function buildApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use('/api/conversations', conversationRoutes);
    return app;
  }

  it('defaults conversation objectives to orchestration tasks', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/conversations/conv-1/messages')
      .send({
        content: 'Plan and execute release checklist'
      });

    expect(response.status).toBe(201);
    expect(submitTaskMock).toHaveBeenCalledTimes(1);

    const submittedTask = submitTaskMock.mock.calls[0][0] as {
      type: string;
      data: Record<string, unknown>;
    };

    expect(submittedTask.type).toBe('orchestrate');
    expect(submittedTask.data.objective).toBe('Plan and execute release checklist');
    expect(submittedTask.data.executionStrategy).toBe('sequential');
    expect(submittedTask.data.defaultAgentId).toBe('agent-1');
  });

  it('honors explicit taskType override when provided', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/conversations/conv-1/messages')
      .send({
        content: 'Use existing task type',
        taskType: 'conversation-message'
      });

    expect(response.status).toBe(201);
    const submittedTask = submitTaskMock.mock.calls[0][0] as { type: string };
    expect(submittedTask.type).toBe('conversation-message');
  });
});

