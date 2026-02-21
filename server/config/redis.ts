import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: (times: number) => Math.min(50 * Math.pow(2, times), 2000)
});

export function getRedis(): Redis {
  return redis;
}
