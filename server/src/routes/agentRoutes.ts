/**
 * Agent REST Routes
 * Express router for agent management endpoints
 */

import { Router, Request, Response } from 'express';
import { agentService } from '../services/agentService';
import { streamAgentTask } from '../services/executionService';
import { Task } from '../../types';

const router = Router();

// Request body interface for creating an agent
interface CreateAgentBody {
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

// POST /api/agents - Deploy new agent
router.post('/', (req: Request<{}, {}, CreateAgentBody>, res: Response) => {
  try {
    const { name, type, config = {} } = req.body;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name and type are required'
      });
    }

    const agent = agentService.deployAgent(name, type, config);

    return res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create agent'
    });
  }
});

// GET /api/agents - List all agents
router.get('/', (_req: Request, res: Response) => {
  try {
    const agents = agentService.listAgents();

    return res.status(200).json({
      success: true,
      data: agents
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list agents'
    });
  }
});

// GET /api/agents/:id - Get single agent by ID
router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const agent = agentService.getAgent(id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get agent'
    });
  }
});

// POST /api/agents/:id/start - Start agent
router.post('/:id/start', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const agent = agentService.startAgent(id);

    return res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Agent not found') {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start agent'
    });
  }
});

// POST /api/agents/:id/stop - Stop agent
router.post('/:id/stop', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const agent = agentService.stopAgent(id);

    return res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Agent not found') {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop agent'
    });
  }
});

// POST /api/agents/:id/restart - Restart agent
router.post('/:id/restart', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const agent = agentService.restartAgent(id);

    return res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Agent not found') {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restart agent'
    });
  }
});

// DELETE /api/agents/:id - Delete agent
router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = agentService.deleteAgent(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete agent'
    });
  }
});

// SSE streaming endpoint for agent execution
// GET /api/agents/:agentId/execute/stream?prompt=...&taskId=...
interface StreamQueryParams {
  prompt?: string;
  taskId?: string;
}

router.get('/:agentId/execute/stream', async (req: Request<{ agentId: string }, {}, {}, StreamQueryParams>, res: Response) => {
  const { agentId } = req.params;
  const { prompt, taskId } = req.query;

  // Validate required prompt parameter
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Prompt parameter is required'
    });
  }

  // Prevent duplicate execution of queued tasks by disallowing taskId reuse.
  // Streaming endpoint always creates a separate ephemeral execution.
  if (taskId) {
    return res.status(409).json({
      success: false,
      error: 'Streaming an existing taskId is disabled to prevent duplicate execution. Start a new stream run instead.'
    });
  }

  // Verify agent exists
  const agent = agentService.getAgent(agentId);
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Helper to send SSE message
  const sendSSE = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Helper to handle errors and close connection
  const handleError = (error: Error) => {
    console.error('Streaming error:', error.message);
    sendSSE({ error: error.message, done: true });
    res.end();
  };

  try {
    // Create a temporary task for streaming
    const task: Task = {
      id: `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      type: 'stream-execution',
      data: { prompt },
      status: 'processing',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Send initial event
    sendSSE({ taskId: task.id, status: 'started' });

    // Stream the agent task execution
    const streamResult = await streamAgentTask(task);

    // Handle the stream - ToolLoopAgent.stream() returns different format
    // text can be string, AsyncIterable, or undefined
    try {
      if (streamResult.text) {
        // Check if it's an async iterable or a regular string
        if (typeof streamResult.text === 'string') {
          // Send the entire text as one chunk if it's a string
          sendSSE({ token: streamResult.text });
        } else if (streamResult.text[Symbol.asyncIterator]) {
          // It's an async iterable
          for await (const chunk of streamResult.text) {
            sendSSE({ token: chunk });
          }
        }
      }

      // Also check steps for any text outputs from tool executions
      if (streamResult.steps && streamResult.steps.length > 0) {
        for (const step of streamResult.steps) {
          if (step.result && step.result.text) {
            sendSSE({ token: step.result.text });
          }
        }
      }
    } catch (streamError) {
      console.error('Streaming error:', streamError);
      // Continue to send completion even if streaming fails
    }

    // Send completion event
    sendSSE({
      done: true,
      taskId: task.id,
      finishReason: streamResult.finishReason,
      steps: streamResult.steps?.length || 0,
      toolCalls: streamResult.toolCalls?.length || 0
    });

    res.end();
  } catch (error) {
    handleError(error instanceof Error ? error : new Error('Unknown streaming error'));
  }
});

// Heartbeat/ping endpoint to keep SSE connections alive
// POST /api/agents/:id/ping
router.post('/:id/ping', (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  // Verify agent exists
  const agent = agentService.getAgent(id);
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }

  // Respond to keep connection alive
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.status(200).json({
    success: true,
    data: { status: 'alive', agentId: id, timestamp: new Date().toISOString() }
  });
});

export default router;
