/**
 * Governance Routes
 * Approval workflows and auditability endpoints.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getApproval, listApprovals, resolveApproval } from '../services/governanceService';
import { listAuditEvents } from '../services/auditService';

const router = Router();

const listApprovalsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'denied', 'timed_out']).optional(),
  runId: z.string().min(1).optional()
});

const resolveApprovalBodySchema = z.object({
  decision: z.enum(['approved', 'denied']),
  resolvedBy: z.string().min(1).optional()
});

const listAuditQuerySchema = z.object({
  action: z.string().min(1).optional(),
  resourceType: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

router.get('/approvals', (req: Request, res: Response) => {
  const parsed = listApprovalsQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid approvals query payload',
      details: parsed.error.flatten()
    });
  }

  return res.status(200).json({
    success: true,
    data: listApprovals(parsed.data)
  });
});

router.post('/approvals/:approvalId/resolve', (req: Request<{ approvalId: string }>, res: Response) => {
  const parsed = resolveApprovalBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid resolve approval payload',
      details: parsed.error.flatten()
    });
  }

  const approval = getApproval(req.params.approvalId);
  if (!approval) {
    return res.status(404).json({
      success: false,
      error: 'Approval not found'
    });
  }

  if (approval.status !== 'pending') {
    return res.status(409).json({
      success: false,
      error: `Approval already resolved with status: ${approval.status}`
    });
  }

  const resolved = resolveApproval(
    approval.id,
    parsed.data.decision,
    parsed.data.resolvedBy
  );

  if (!resolved) {
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve approval'
    });
  }

  return res.status(200).json({
    success: true,
    data: resolved
  });
});

router.get('/audit-events', async (req: Request, res: Response) => {
  const parsed = listAuditQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid audit query payload',
      details: parsed.error.flatten()
    });
  }

  const events = await listAuditEvents(parsed.data);

  return res.status(200).json({
    success: true,
    data: events
  });
});

export default router;
