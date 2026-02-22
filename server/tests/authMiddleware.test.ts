import express, { Request, Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { supabaseAuthMiddleware } from '../src/middleware/authMiddleware';
import { getWorkspaceMembership } from '../src/services/workspaceAccessService';

jest.mock('../src/services/workspaceAccessService', () => ({
  getWorkspaceMembership: jest.fn()
}));

const getWorkspaceMembershipMock = getWorkspaceMembership as jest.MockedFunction<typeof getWorkspaceMembership>;

async function createToken(secret: string, subject: string): Promise<string> {
  return jwt.sign({ role: 'member' }, secret, {
    subject,
    expiresIn: '2h'
  });
}

describe('supabaseAuthMiddleware', () => {
  const secret = 'phase3-test-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FEATURE_SUPABASE_AUTH = 'true';
    process.env.SUPABASE_JWT_SECRET = secret;
    delete process.env.SUPABASE_URL;
    delete process.env.ALLOW_SERVICE_ROLE_BYPASS;
  });

  it('rejects requests without workspace header', async () => {
    const app = express();
    app.use(supabaseAuthMiddleware);
    app.get('/agents', (_req: Request, res: Response) => res.status(200).json({ ok: true }));

    const response = await request(app)
      .get('/agents')
      .set('Authorization', 'Bearer fake-token');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('x-workspace-id');
  });

  it('rejects requests when membership is missing', async () => {
    getWorkspaceMembershipMock.mockResolvedValue(null);

    const token = await createToken(secret, 'user-1');

    const app = express();
    app.use(supabaseAuthMiddleware);
    app.get('/agents', (_req: Request, res: Response) => res.status(200).json({ ok: true }));

    const response = await request(app)
      .get('/agents')
      .set('x-workspace-id', 'workspace-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(getWorkspaceMembershipMock).toHaveBeenCalledWith('user-1', 'workspace-1');
  });

  it('attaches auth context for valid membership', async () => {
    getWorkspaceMembershipMock.mockResolvedValue({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'member',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const token = await createToken(secret, 'user-1');

    const app = express();
    app.use(supabaseAuthMiddleware);
    app.get('/agents', (req: Request, res: Response) => {
      return res.status(200).json({
        userId: req.auth?.userId,
        workspaceId: req.auth?.workspaceId,
        role: req.auth?.role
      });
    });

    const response = await request(app)
      .get('/agents')
      .set('x-workspace-id', 'workspace-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      role: 'member'
    });
  });
});
