/**
 * RuntimePolicyService
 * Exposes effective caching, connection, and quota runtime policies.
 */

import { getRedisConnectionPolicy } from '../../config/redis';
import { getCacheStats } from './cacheService';
import { getQuotaPolicy } from './quotaService';

export interface RuntimePolicySnapshot {
  caching: {
    defaultTtlMs: number;
    maxEntries: number;
  };
  cacheStats: ReturnType<typeof getCacheStats>;
  connections: {
    redis: ReturnType<typeof getRedisConnectionPolicy>;
    worker: {
      concurrency: number;
      rateLimit: number;
    };
    supabase: {
      hasUrl: boolean;
      hasSecretKey: boolean;
      readTimeoutMs: number;
    };
  };
  quotas: ReturnType<typeof getQuotaPolicy>;
}

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

export function getRuntimePolicySnapshot(): RuntimePolicySnapshot {
  const cacheStats = getCacheStats();

  return {
    caching: {
      defaultTtlMs: cacheStats.defaultTtlMs,
      maxEntries: cacheStats.maxEntries
    },
    cacheStats,
    connections: {
      redis: getRedisConnectionPolicy(),
      worker: {
        concurrency: parsePositiveInt(process.env.WORKER_CONCURRENCY, 10),
        rateLimit: parsePositiveInt(process.env.WORKER_RATE_LIMIT, 10)
      },
      supabase: {
        hasUrl: Boolean(process.env.SUPABASE_URL),
        hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
        readTimeoutMs: parsePositiveInt(process.env.SUPABASE_READ_TIMEOUT_MS, 10000)
      }
    },
    quotas: getQuotaPolicy()
  };
}
