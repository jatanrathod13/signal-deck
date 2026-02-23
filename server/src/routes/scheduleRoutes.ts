/**
 * Schedule Routes
 * CRUD + trigger endpoints for scheduler subsystem.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  triggerScheduleNow,
  updateSchedule
} from '../services/scheduleService';
import { QuotaExceededError } from '../services/quotaService';

const router = Router();

const schedulePayloadSchema = z.object({
  agentId: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  executionMode: z.enum(['tool_loop', 'claude_cli']).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).partial();

const createScheduleSchema = z.object({
  name: z.string().min(1).max(120),
  cronExpression: z.string().min(5),
  timezone: z.string().min(1).optional(),
  payload: schedulePayloadSchema.optional(),
  enabled: z.boolean().optional(),
  retryLimit: z.number().int().min(1).max(20).optional(),
  retryBackoffSeconds: z.number().int().min(1).max(3600).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  cronExpression: z.string().min(5).optional(),
  timezone: z.string().min(1).optional(),
  payload: schedulePayloadSchema.optional(),
  enabled: z.boolean().optional(),
  retryLimit: z.number().int().min(1).max(20).optional(),
  retryBackoffSeconds: z.number().int().min(1).max(3600).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createScheduleSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid schedule payload',
      details: parsed.error.flatten()
    });
  }

  try {
    const schedule = await createSchedule(parsed.data);
    return res.status(201).json({
      success: true,
      data: schedule
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

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create schedule'
    });
  }
});

router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: listSchedules()
  });
});

router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  const schedule = getSchedule(req.params.id);
  if (!schedule) {
    return res.status(404).json({
      success: false,
      error: 'Schedule not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: schedule
  });
});

router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const parsed = updateScheduleSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid schedule update payload',
      details: parsed.error.flatten()
    });
  }

  try {
    const updated = await updateSchedule(req.params.id, parsed.data);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update schedule'
    });
  }
});

router.post('/:id/trigger', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const result = await triggerScheduleNow(req.params.id);
    return res.status(200).json({
      success: true,
      data: result
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

    if (error instanceof Error && error.message === 'Schedule not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger schedule'
    });
  }
});

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const deleted = await deleteSchedule(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete schedule'
    });
  }
});

export default router;
