/**
 * RateLimitMiddleware
 * Lightweight per-workspace/IP rate limiter for API endpoints.
 */

import { NextFunction, Request, Response } from 'express';

interface WindowCounter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, WindowCounter>();
let nextCleanupAt = 0;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getWindowMs(): number {
  return parsePositiveInt(process.env.HTTP_RATE_LIMIT_WINDOW_MS, 60_000);
}

function getMaxRequests(): number {
  return parsePositiveInt(process.env.HTTP_RATE_LIMIT_MAX_REQUESTS, 120);
}

function getRateLimitScope(req: Request): string {
  const workspaceId = req.auth?.workspaceId;

  if (workspaceId) {
    return `workspace:${workspaceId}`;
  }

  return `ip:${req.ip || 'unknown'}`;
}

function getMaxTrackedScopes(): number {
  return parsePositiveInt(process.env.HTTP_RATE_LIMIT_MAX_TRACKED_SCOPES, 10_000);
}

function maybeCleanupExpiredCounters(now: number): void {
  if (now < nextCleanupAt) {
    return;
  }

  for (const [scope, counter] of counters.entries()) {
    if (now >= counter.resetAt) {
      counters.delete(scope);
    }
  }

  nextCleanupAt = now + 5_000;
}

function evictOneCounterIfNeeded(): void {
  const maxTrackedScopes = getMaxTrackedScopes();
  if (counters.size < maxTrackedScopes) {
    return;
  }

  let oldestScope: string | null = null;
  let oldestResetAt = Number.POSITIVE_INFINITY;

  for (const [scope, counter] of counters.entries()) {
    if (counter.resetAt < oldestResetAt) {
      oldestResetAt = counter.resetAt;
      oldestScope = scope;
    }
  }

  if (oldestScope) {
    counters.delete(oldestScope);
  }
}

function isRateLimitEnabled(): boolean {
  return process.env.FEATURE_HTTP_RATE_LIMIT === 'true';
}

export function httpRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isRateLimitEnabled()) {
    next();
    return;
  }

  const now = Date.now();
  maybeCleanupExpiredCounters(now);
  const windowMs = getWindowMs();
  const maxRequests = getMaxRequests();
  const scope = getRateLimitScope(req);

  const current = counters.get(scope);

  if (!current || now >= current.resetAt) {
    evictOneCounterIfNeeded();
    counters.set(scope, {
      count: 1,
      resetAt: now + windowMs
    });

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
    next();
    return;
  }

  current.count += 1;
  const remaining = Math.max(maxRequests - current.count, 0);

  res.setHeader('X-RateLimit-Limit', String(maxRequests));
  res.setHeader('X-RateLimit-Remaining', String(remaining));

  if (current.count > maxRequests) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      success: false,
      error: `Rate limit exceeded for ${scope}`,
      details: {
        scope,
        maxRequests,
        windowMs,
        retryAfterSeconds
      }
    });
    return;
  }

  next();
}

export function resetRateLimitState(): void {
  counters.clear();
  nextCleanupAt = 0;
}
