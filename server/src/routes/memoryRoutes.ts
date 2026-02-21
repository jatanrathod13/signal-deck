/**
 * Shared Memory REST Routes
 * Express router for shared memory management endpoints
 */

import { Router, Request, Response } from 'express';
import { setValue, getValue, deleteValue, listKeys } from '../services/sharedMemoryService';

const router = Router();

// Request body interface for setting a memory value
interface SetMemoryBody {
  key: string;
  value: string;
  ttl?: number;
}

// POST /api/memory - Set value
router.post('/', async (req: Request<{}, {}, SetMemoryBody>, res: Response) => {
  try {
    const { key, value, ttl } = req.body;

    // Validate required fields
    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Key and value are required'
      });
    }

    await setValue(key, value, ttl);

    return res.status(201).json({
      success: true,
      data: { key, value }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set memory value'
    });
  }
});

// GET /api/memory - List keys
router.get('/', async (_req: Request, res: Response) => {
  try {
    const keys = await listKeys();

    return res.status(200).json({
      success: true,
      data: keys
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list memory keys'
    });
  }
});

// GET /api/memory/:key - Get value
router.get('/:key', async (req: Request<{ key: string }>, res: Response) => {
  try {
    const { key } = req.params;
    const value = await getValue(key);

    if (value === null) {
      return res.status(404).json({
        success: false,
        error: 'Key not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: { key, value }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get memory value'
    });
  }
});

// DELETE /api/memory/:key - Delete value
router.delete('/:key', async (req: Request<{ key: string }>, res: Response) => {
  try {
    const { key } = req.params;
    const deleted = await deleteValue(key);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Key not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: { key }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete memory value'
    });
  }
});

export default router;
