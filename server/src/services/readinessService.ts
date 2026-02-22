/**
 * ReadinessService
 * Aggregates runtime dependency checks for /ready endpoint.
 */

import { redis } from '../../config/redis';
import { checkSupabaseReadiness } from '../lib/supabaseClient';
import { getTaskQueueHealth } from './taskQueueService';

export interface DependencyCheck {
  ok: boolean;
  detail: string;
}

export interface ReadinessSnapshot {
  status: 'ok' | 'degraded';
  checks: {
    redis: DependencyCheck;
    database: DependencyCheck;
    queue: DependencyCheck & {
      waiting?: number;
      active?: number;
      failed?: number;
    };
  };
  timestamp: string;
}

async function checkRedisReadiness(): Promise<DependencyCheck> {
  try {
    const pong = await redis.ping();
    return {
      ok: pong === 'PONG',
      detail: pong
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Redis unreachable'
    };
  }
}

export async function getReadinessSnapshot(): Promise<ReadinessSnapshot> {
  const [redisCheck, databaseCheck, queueHealth] = await Promise.all([
    checkRedisReadiness(),
    checkSupabaseReadiness(),
    getTaskQueueHealth()
  ]);

  const checks = {
    redis: redisCheck,
    database: databaseCheck,
    queue: queueHealth
  };

  const status = checks.redis.ok && checks.database.ok && checks.queue.ok
    ? 'ok'
    : 'degraded';

  return {
    status,
    checks,
    timestamp: new Date().toISOString()
  };
}
