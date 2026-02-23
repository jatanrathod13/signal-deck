import Redis from 'ioredis';

export interface RedisConnectionPolicy {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: number | null;
  enableOfflineQueue: boolean;
  connectTimeoutMs: number;
  retryCapMs: number;
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseNullableRetries(rawValue: string | undefined): number | null {
  if (!rawValue || rawValue.toLowerCase() === 'null') {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function getRedisConnectionPolicy(): RedisConnectionPolicy {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parsePositiveInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: parseNullableRetries(process.env.REDIS_MAX_RETRIES_PER_REQUEST),
    enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE === 'true',
    connectTimeoutMs: parsePositiveInt(process.env.REDIS_CONNECT_TIMEOUT_MS, 10000),
    retryCapMs: parsePositiveInt(process.env.REDIS_RETRY_CAP_MS, 2000)
  };
}

const policy = getRedisConnectionPolicy();

export const redis = new Redis({
  host: policy.host,
  port: policy.port,
  password: policy.password,
  maxRetriesPerRequest: policy.maxRetriesPerRequest, // BullMQ prefers null.
  enableOfflineQueue: policy.enableOfflineQueue,
  connectTimeout: policy.connectTimeoutMs,
  retryStrategy: (times: number) => Math.min(50 * Math.pow(2, times), policy.retryCapMs)
});

export function getRedis(): Redis {
  return redis;
}
