/**
 * Tool Routes
 * Exposes configured tool catalog and policy visibility.
 */

import { Router, Request, Response } from 'express';
import { getToolCatalog } from '../services/executionService';

const router = Router();

router.get('/catalog', async (req: Request<{}, {}, {}, { agentId?: string }>, res: Response) => {
  try {
    const catalog = await getToolCatalog(req.query.agentId);

    return res.status(200).json({
      success: true,
      data: catalog
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load tool catalog'
    });
  }
});

export default router;
