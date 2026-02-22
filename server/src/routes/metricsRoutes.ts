/**
 * Metrics REST Routes
 * KPI and baseline evaluation endpoints.
 */

import { Router, Request, Response } from 'express';
import { getMetricsSnapshot } from '../services/metricsService';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: getMetricsSnapshot()
  });
});

router.get('/baseline-eval', (_req: Request, res: Response) => {
  const snapshot = getMetricsSnapshot();
  const score = snapshot.tasksSubmitted === 0
    ? 100
    : Math.round((snapshot.tasksCompleted / snapshot.tasksSubmitted) * 100);

  return res.status(200).json({
    success: true,
    data: {
      snapshot,
      score,
      status: score >= 80 ? 'healthy' : 'needs-improvement',
      generatedAt: new Date()
    }
  });
});

export default router;
