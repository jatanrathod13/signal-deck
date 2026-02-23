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
import { getIntegrationCatalog, IntegrationCategory } from '../services/integrationCatalogService';
import { getDeadLetter, listDeadLetters, markDeadLetterStatus } from '../services/deadLetterQueueService';
import { getTask, isTaskVisibleInWorkspace, retryTask } from '../services/taskQueueService';
import { getProductionReadinessReport } from '../services/productionReadinessService';
import { getOpenApiDocument } from '../services/apiDocsService';

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

router.get('/integrations', (req: Request<{}, {}, {}, { category?: string }>, res: Response) => {
  const rawCategory = req.query.category;
  const category = rawCategory === 'iot' || rawCategory === 'mcp' || rawCategory === 'provider'
    ? rawCategory as IntegrationCategory
    : undefined;

  return res.status(200).json({
    success: true,
    data: getIntegrationCatalog(category)
  });
});

router.get('/dlq', (req: Request, res: Response) => {
  const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
  return res.status(200).json({
    success: true,
    data: listDeadLetters(workspaceId)
  });
});

router.post('/dlq/:entryId/requeue', async (req: Request<{ entryId: string }>, res: Response) => {
  const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
  const entry = getDeadLetter(req.params.entryId);

  if (!entry || (workspaceId && entry.workspaceId !== workspaceId)) {
    return res.status(404).json({
      success: false,
      error: 'Dead letter entry not found'
    });
  }

  const originalTask = getTask(entry.taskId);
  if (!originalTask || !isTaskVisibleInWorkspace(originalTask, workspaceId)) {
    return res.status(404).json({
      success: false,
      error: 'Original task not found for dead letter entry'
    });
  }

  try {
    const requeuedTaskId = await retryTask(entry.taskId);
    const updatedEntry = markDeadLetterStatus(entry.id, 'requeued', {
      requeuedTaskId,
      requeuedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        entry: updatedEntry,
        requeuedTaskId
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to requeue dead letter task'
    });
  }
});

router.get('/readiness/review', async (_req: Request, res: Response) => {
  const report = await getProductionReadinessReport();
  return res.status(report.status === 'ready' ? 200 : 503).json({
    success: report.status === 'ready',
    data: report
  });
});

router.get('/openapi.json', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return res.status(200).json(getOpenApiDocument(baseUrl));
});

export default router;
