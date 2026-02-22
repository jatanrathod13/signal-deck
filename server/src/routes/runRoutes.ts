/**
 * Run Routes
 * Query run status and timeline details.
 */

import { Router, Request, Response } from 'express';
import { getRun, listRunEvents } from '../services/conversationService';

const router = Router();

router.get('/:runId', (req: Request<{ runId: string }>, res: Response) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      run,
      events: listRunEvents(run.id)
    }
  });
});

export default router;
