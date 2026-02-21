/**
 * Agent REST Routes
 * Express router for agent management endpoints
 */

import { Router, Request, Response } from 'express';
import { agentService } from '../services/agentService';

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

export default router;
