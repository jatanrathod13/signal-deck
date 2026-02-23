/**
 * Conversation Routes
 * Chat-first API for conversation threads and run timeline events.
 * Updated with executionProfile + research config support (WP-03/WP-05).
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
import { Task, getFeatureFlags } from '../../types';
import { enforceRunStartQuota, QuotaExceededError } from '../services/quotaService';
import { getCurrentWorkspaceId } from '../services/workspaceContextService';

const router = Router();

const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const createMessageSchema = z.object({
  content: z.string().min(1),
  agentId: z.string().min(1).optional(),
  taskType: z.string().min(1).optional(),
  executionStrategy: z.enum(['sequential', 'parallel', 'dag']).optional(),
  maxSteps: z.number().int().min(2).max(10).optional(),
  teamAgentIds: z.array(z.string().min(1)).optional(),
  assignmentStrategy: z.enum(['round_robin', 'least_loaded']).optional(),
  stepPrompts: z.array(z.string().min(1)).optional(),
  // New: execution profile support
  executionProfile: z.enum(['standard', 'deep_research']).optional(),
  // New: research configuration
  research: z.object({
    depth: z.enum(['quick', 'standard', 'deep']),
    parallelism: z.number().int().min(1).max(10).optional(),
    requireCitations: z.boolean().optional(),
    maxSources: z.number().int().min(1).max(50).optional()
  }).optional(),
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

  // Check feature flags for deep research
  const flags = getFeatureFlags();
  const executionProfile = parsed.data.executionProfile ?? 'standard';
  if (executionProfile === 'deep_research' && !flags.FEATURE_DEEP_RESEARCH) {
    return res.status(400).json({
      success: false,
      error: 'Deep research mode is not enabled. Set FEATURE_DEEP_RESEARCH=true to enable.'
    });
  }

  try {
    const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId() ?? 'workspace-default';
    await enforceRunStartQuota(workspaceId);

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
        executionProfile,
        research: parsed.data.research,
        ...(parsed.data.metadata ?? {})
      }
    });

    appendRunEvent({
      runId: run.id,
      conversationId: conversation.id,
      type: 'run.started',
      payload: {
        messageId: userMessage.id,
        agentId: defaultAgentId,
        executionProfile
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
    const normalizedTaskType = parsed.data.taskType?.trim();
    const taskType = normalizedTaskType && normalizedTaskType.length > 0
      ? normalizedTaskType
      : 'orchestrate';

    const task: Task = {
      id: '',
      workspaceId,
      agentId: defaultAgentId,
      type: taskType,
      data: {
        prompt: parsed.data.content,
        objective: parsed.data.content,
        defaultAgentId: defaultAgentId,
        executionStrategy: parsed.data.executionStrategy ?? 'sequential',
        maxSteps: parsed.data.maxSteps,
        teamAgentIds: parsed.data.teamAgentIds,
        assignmentStrategy: parsed.data.assignmentStrategy,
        stepPrompts: parsed.data.stepPrompts,
        conversationId: conversation.id,
        runId: run.id,
        // Pass execution profile and research config through task data
        executionProfile,
        research: parsed.data.research
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
        executionProfile,
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
        taskId,
        executionProfile
      }
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return res.status(429).json({
        success: false,
        error: error.message,
        details: {
          metric: error.metric,
          limit: error.limit,
          current: error.current,
          workspaceId: error.workspaceId
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit conversation message'
    });
  }
});

export default router;
