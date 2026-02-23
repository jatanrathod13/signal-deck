/**
 * System Routes
 * Runtime dependency health and environment readiness.
 */

import { Router, Request, Response } from 'express';
import { redis } from '../../config/redis';
import { getReadinessSnapshot } from '../services/readinessService';
import { getRuntimePolicySnapshot } from '../services/runtimePolicyService';
import { getCurrentWorkspaceId } from '../services/workspaceContextService';
import { getQuotaUsage } from '../services/quotaService';

const router = Router();

router.get('/healthz', async (_req: Request, res: Response) => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {
    redis: { ok: false },
    modelProvider: { ok: false },
    tracing: { ok: true }
  };

  try {
    const pong = await redis.ping();
    checks.redis = {
      ok: pong === 'PONG',
      detail: pong
    };
  } catch (error) {
    checks.redis = {
      ok: false,
      detail: error instanceof Error ? error.message : 'Redis unreachable'
    };
  }

  const hasGateway = !!process.env.AI_GATEWAY_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  checks.modelProvider = {
    ok: hasGateway || hasOpenAI,
    detail: hasGateway ? 'AI Gateway configured' : (hasOpenAI ? 'OpenAI configured' : 'No model API key configured')
  };

  const tracingEnabled = process.env.LANGSMITH_TRACING === 'true';
  const tracingKeySet = !!process.env.LANGSMITH_API_KEY;
  checks.tracing = {
    ok: !tracingEnabled || tracingKeySet,
    detail: tracingEnabled
      ? (tracingKeySet ? 'LangSmith configured' : 'LANGSMITH_TRACING enabled but LANGSMITH_API_KEY is missing')
      : 'Tracing disabled'
  };

  const allHealthy = Object.values(checks).every((check) => check.ok);

  return res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    }
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  const snapshot = await getReadinessSnapshot();
  const httpStatus = snapshot.status === 'ok' ? 200 : 503;

  return res.status(httpStatus).json({
    success: snapshot.status === 'ok',
    data: snapshot
  });
});

router.get('/runtime-policies', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: getRuntimePolicySnapshot()
  });
});

router.get('/quotas', async (req: Request, res: Response) => {
  const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      error: 'Workspace context is required to query quotas'
    });
  }

  const usage = await getQuotaUsage(workspaceId);
  return res.status(200).json({
    success: true,
    data: usage
  });
});

export default router;
