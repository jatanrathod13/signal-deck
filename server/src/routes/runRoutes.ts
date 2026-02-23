/**
 * Run Routes
 * Query run status, timeline details, intelligence, artifacts, and approvals.
 * Implements WP-10 run intelligence + WP-09 approval endpoints.
 */

import { Router, Request, Response } from 'express';
import { getRun, listRunEvents, listRuns } from '../services/conversationService';
import { buildRunIntelligence } from '../services/runIntelligenceService';
import { listRunApprovals, resolveApproval, getApproval } from '../services/governanceService';
import { buildCacheKey, getCachedValue, setCachedValue } from '../services/cacheService';
import { getCurrentWorkspaceId } from '../services/workspaceContextService';

const router = Router();

/**
 * GET /api/runs - List recent runs for dashboard observability
 */
router.get('/', (req: Request<{}, {}, {}, { status?: string; limit?: string }>, res: Response) => {
  const limitRaw = Number.parseInt(req.query.limit ?? '100', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, 500)
    : 100;

  const status = req.query.status;
  const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
  const cacheKey = buildCacheKey(['runs:list', workspaceId, status, limit]);
  const cached = getCachedValue<ReturnType<typeof listRuns>>(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      data: cached
    });
  }

  const runs = listRuns()
    .filter((run) => !status || run.status === status)
    .slice(0, limit);

  setCachedValue(cacheKey, runs, 3000);

  return res.status(200).json({
    success: true,
    data: runs
  });
});

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

  const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
  const cacheKey = buildCacheKey(['runs:intelligence', workspaceId, req.params.runId]);
  let intelligence = getCachedValue<NonNullable<ReturnType<typeof buildRunIntelligence>>>(cacheKey);
  if (!intelligence) {
    intelligence = buildRunIntelligence(req.params.runId);
    if (intelligence) {
      setCachedValue(cacheKey, intelligence, 2000);
    }
  }
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
