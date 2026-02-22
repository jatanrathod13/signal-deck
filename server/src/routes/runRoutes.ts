/**
 * Run Routes
 * Query run status, timeline details, intelligence, artifacts, and approvals.
 * Implements WP-10 run intelligence + WP-09 approval endpoints.
 */

import { Router, Request, Response } from 'express';
import { getRun, listRunEvents } from '../services/conversationService';
import { buildRunIntelligence } from '../services/runIntelligenceService';
import { listRunApprovals, resolveApproval, getApproval } from '../services/governanceService';

const router = Router();

/**
 * GET /api/runs/:runId - Get run status and events
 */
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

/**
 * GET /api/runs/:runId/intelligence - Get grouped phase timeline with insights
 */
router.get('/:runId/intelligence', (req: Request<{ runId: string }>, res: Response) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    });
  }

  const intelligence = buildRunIntelligence(req.params.runId);
  if (!intelligence) {
    return res.status(404).json({
      success: false,
      error: 'Run intelligence not available'
    });
  }

  return res.status(200).json({
    success: true,
    data: intelligence
  });
});

/**
 * GET /api/runs/:runId/artifacts - Get sources, evaluator scorecard, approvals, citation map
 */
router.get('/:runId/artifacts', (req: Request<{ runId: string }>, res: Response) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    });
  }

  const approvals = listRunApprovals(req.params.runId);
  const artifacts = run.artifacts ?? {};

  return res.status(200).json({
    success: true,
    data: {
      ...artifacts,
      approvals
    }
  });
});

/**
 * POST /api/runs/:runId/approvals/:approvalId - Approve or deny a pending checkpoint
 */
router.post(
  '/:runId/approvals/:approvalId',
  (req: Request<{ runId: string; approvalId: string }>, res: Response) => {
    const run = getRun(req.params.runId);
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      });
    }

    const approval = getApproval(req.params.approvalId);
    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found'
      });
    }

    if (approval.runId !== req.params.runId) {
      return res.status(400).json({
        success: false,
        error: 'Approval does not belong to this run'
      });
    }

    if (approval.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: `Approval already resolved with status: ${approval.status}`
      });
    }

    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'denied') {
      return res.status(400).json({
        success: false,
        error: 'Invalid decision. Must be "approved" or "denied"'
      });
    }

    const resolvedBy = typeof req.body?.resolvedBy === 'string' ? req.body.resolvedBy : undefined;
    const result = resolveApproval(req.params.approvalId, decision, resolvedBy);

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve approval'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  }
);

export default router;
