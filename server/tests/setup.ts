import { redis } from '../config/redis';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.PORT = '3000';
});

afterAll(async () => {
  try {
    if (redis.status !== 'end') {
      await redis.quit();
    }
  } catch (_error) {
    redis.disconnect();
  }
});

// Global test timeout
jest.setTimeout(10000);
