/**
 * System Routes
 * Runtime dependency health and environment readiness.
 */

import { Router, Request, Response } from 'express';
import { redis } from '../../config/redis';

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

export default router;
