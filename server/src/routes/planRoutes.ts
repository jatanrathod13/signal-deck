/**
 * Plan REST Routes
 * Endpoints for creating and managing orchestration plans.
 */

import { Router, Request, Response } from 'express';
import { createAndStartPlan, getPlanById } from '../services/orchestratorService';
import { listPlans, updateStepStatus } from '../services/planService';

const router = Router();

interface CreatePlanBody {
  objective: string;
  defaultAgentId: string;
  stepPrompts?: string[];
  autoGenerate?: boolean;
  maxSteps?: number;
  conversationId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}

router.post('/', async (req: Request<{}, {}, CreatePlanBody>, res: Response) => {
  try {
    const { objective, defaultAgentId, stepPrompts, autoGenerate = false, maxSteps, conversationId, runId, metadata } = req.body;

    if (!objective || !defaultAgentId) {
      return res.status(400).json({
        success: false,
        error: 'objective and defaultAgentId are required'
      });
    }

    const hasManualSteps = Array.isArray(stepPrompts) && stepPrompts.length > 0;
    if (!hasManualSteps && !autoGenerate) {
      return res.status(400).json({
        success: false,
        error: 'Provide non-empty stepPrompts or set autoGenerate=true'
      });
    }

    const summary = await createAndStartPlan({
      objective,
      defaultAgentId,
      stepPrompts: hasManualSteps ? stepPrompts : undefined,
      maxSteps,
      conversationId,
      runId,
      metadata
    });

    return res.status(201).json({
      success: true,
      data: summary
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create plan'
    });
  }
});

router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: listPlans()
  });
});

router.get('/:planId', (req: Request<{ planId: string }>, res: Response) => {
  const plan = getPlanById(req.params.planId);

  if (!plan) {
    return res.status(404).json({
      success: false,
      error: 'Plan not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: plan
  });
});

router.patch('/:planId/steps/:stepId', async (
  req: Request<{ planId: string; stepId: string }, {}, { status: 'pending' | 'blocked' | 'running' | 'completed' | 'failed' | 'skipped' }>,
  res: Response
) => {
  const { planId, stepId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'status is required'
    });
  }

  const step = await updateStepStatus(planId, stepId, status);
  if (!step) {
    return res.status(404).json({
      success: false,
      error: 'Plan or step not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: step
  });
});

export default router;
