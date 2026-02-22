/**
 * Conversation Routes
 * Chat-first API for conversation threads and run timeline events.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  addConversationMessage,
  appendRunEvent,
  createConversation,
  createRun,
  getConversation,
  listConversationEvents,
  listConversationMessages,
  listConversations,
  updateRun
} from '../services/conversationService';
import { listAgents } from '../services/agentService';
import { submitTask } from '../services/taskQueueService';
import { Task } from '../../types';

const router = Router();

const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const createMessageSchema = z.object({
  content: z.string().min(1),
  agentId: z.string().min(1).optional(),
  taskType: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

function resolveDefaultAgentId(): string | null {
  const agents = listAgents();
  const active = agents.find((agent) => agent.status === 'running' || agent.status === 'idle');
  if (active) {
    return active.id;
  }

  return agents[0]?.id ?? null;
}

router.post('/', (req: Request, res: Response) => {
  const parsed = createConversationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid conversation payload',
      details: parsed.error.flatten()
    });
  }

  const conversation = createConversation(parsed.data);

  return res.status(201).json({
    success: true,
    data: conversation
  });
});

router.get('/', (_req: Request, res: Response) => {
  const conversations = listConversations().map((conversation) => {
    const messages = listConversationMessages(conversation.id);
    return {
      ...conversation,
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]?.content
    };
  });

  return res.status(200).json({
    success: true,
    data: conversations
  });
});

router.get('/:conversationId', (req: Request<{ conversationId: string }>, res: Response) => {
  const conversation = getConversation(req.params.conversationId);
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      conversation,
      messages: listConversationMessages(conversation.id)
    }
  });
});

router.get('/:conversationId/events', (req: Request<{ conversationId: string }, {}, {}, { after?: string }>, res: Response) => {
  const conversation = getConversation(req.params.conversationId);
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: listConversationEvents(conversation.id, req.query.after)
  });
});

router.post('/:conversationId/messages', async (req: Request<{ conversationId: string }>, res: Response) => {
  const conversation = getConversation(req.params.conversationId);
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  const parsed = createMessageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid message payload',
      details: parsed.error.flatten()
    });
  }

  const defaultAgentId = parsed.data.agentId ?? resolveDefaultAgentId();
  if (!defaultAgentId) {
    return res.status(400).json({
      success: false,
      error: 'No agent available. Deploy at least one agent first.'
    });
  }

  try {
    const userMessage = addConversationMessage({
      conversationId: conversation.id,
      role: 'user',
      content: parsed.data.content,
      metadata: parsed.data.metadata
    });

    const run = createRun({
      conversationId: conversation.id,
      metadata: {
        source: 'conversation-message',
        ...(parsed.data.metadata ?? {})
      }
    });

    appendRunEvent({
      runId: run.id,
      conversationId: conversation.id,
      type: 'run.started',
      payload: {
        messageId: userMessage.id,
        agentId: defaultAgentId
      }
    });

    appendRunEvent({
      runId: run.id,
      conversationId: conversation.id,
      type: 'message.created',
      payload: {
        role: 'user',
        content: userMessage.content,
        messageId: userMessage.id
      }
    });

    const now = new Date();
    const task: Task = {
      id: '',
      agentId: defaultAgentId,
      type: parsed.data.taskType || 'conversation-message',
      data: {
        prompt: parsed.data.content,
        conversationId: conversation.id,
        runId: run.id
      },
      status: 'pending',
      priority: 1,
      createdAt: now,
      updatedAt: now,
      conversationId: conversation.id,
      runId: run.id,
      metadata: {
        source: 'conversation',
        messageId: userMessage.id,
        ...(parsed.data.metadata ?? {})
      }
    };

    const taskId = await submitTask(task);

    const updatedRun = updateRun(run.id, 'running', {
      rootTaskId: taskId
    });

    return res.status(201).json({
      success: true,
      data: {
        message: userMessage,
        run: updatedRun,
        taskId
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit conversation message'
    });
  }
});

export default router;
