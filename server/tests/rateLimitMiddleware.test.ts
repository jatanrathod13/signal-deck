import express, { Request, Response } from 'express';
import request from 'supertest';
import { httpRateLimitMiddleware, resetRateLimitState } from '../src/middleware/rateLimitMiddleware';

describe('httpRateLimitMiddleware', () => {
  beforeEach(() => {
    process.env.FEATURE_HTTP_RATE_LIMIT = 'true';
    process.env.HTTP_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.HTTP_RATE_LIMIT_MAX_REQUESTS = '2';
    resetRateLimitState();
  });

  afterEach(() => {
    delete process.env.FEATURE_HTTP_RATE_LIMIT;
    delete process.env.HTTP_RATE_LIMIT_WINDOW_MS;
    delete process.env.HTTP_RATE_LIMIT_MAX_REQUESTS;
    resetRateLimitState();
  });

  it('allows requests within limit and rejects when exceeded', async () => {
    const app = express();
    app.use(httpRateLimitMiddleware);
    app.get('/test', (_req: Request, res: Response) => res.status(200).json({ ok: true }));

    const first = await request(app).get('/test').set('x-workspace-id', 'workspace-1');
    const second = await request(app).get('/test').set('x-workspace-id', 'workspace-1');
    const third = await request(app).get('/test').set('x-workspace-id', 'workspace-1');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body.error).toContain('Rate limit exceeded');
  });

  it('does not enforce limits when feature flag is disabled', async () => {
    process.env.FEATURE_HTTP_RATE_LIMIT = 'false';

    const app = express();
    app.use(httpRateLimitMiddleware);
    app.get('/test', (_req: Request, res: Response) => res.status(200).json({ ok: true }));

    const requests = await Promise.all([
      request(app).get('/test'),
      request(app).get('/test'),
      request(app).get('/test')
    ]);

    expect(requests.every((response) => response.status === 200)).toBe(true);
  });

  it('ignores untrusted workspace header when auth context is absent', async () => {
    const app = express();
    app.use(httpRateLimitMiddleware);
    app.get('/test', (_req: Request, res: Response) => res.status(200).json({ ok: true }));

    const first = await request(app).get('/test').set('x-workspace-id', 'workspace-a');
    const second = await request(app).get('/test').set('x-workspace-id', 'workspace-b');
    const third = await request(app).get('/test').set('x-workspace-id', 'workspace-c');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });
});
