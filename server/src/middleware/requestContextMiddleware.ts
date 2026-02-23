/**
 * RequestContextMiddleware
 * Injects correlation IDs, structured request logs, and request metrics.
 */

import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';
import { observeHttpRequest } from '../services/observabilityService';
import { runWithRequestContext } from '../services/workspaceContextService';

const REQUEST_ID_HEADER = 'x-request-id';
const WORKSPACE_HEADER = 'x-workspace-id';

function sanitizeRoutePath(path: string): string {
  if (!path || path === '/') {
    return '/';
  }

  return path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{16,}/gi, '/:id');
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestIdHeader = req.header(REQUEST_ID_HEADER);
  const requestId = requestIdHeader && requestIdHeader.trim().length > 0
    ? requestIdHeader
    : randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const workspaceIdHeader = req.header(WORKSPACE_HEADER);
  const workspaceId = workspaceIdHeader && workspaceIdHeader.trim().length > 0
    ? workspaceIdHeader.trim()
    : process.env.DEFAULT_WORKSPACE_ID;

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const routePattern = sanitizeRoutePath(req.baseUrl + (req.route?.path?.toString() ?? req.path));

    observeHttpRequest({
      method: req.method,
      route: routePattern,
      statusCode: res.statusCode,
      requestId,
      durationMs
    });

    logger.info({
      requestId,
      method: req.method,
      path: req.originalUrl,
      route: routePattern,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(3))
    }, 'request.completed');
  });

  runWithRequestContext({
    requestId,
    workspaceId,
    ipAddress: req.ip,
    userAgent: req.header('user-agent') ?? undefined
  }, () => {
    next();
  });
}
