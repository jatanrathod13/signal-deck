/**
 * Express type augmentation for request-scoped metadata.
 */

import { JwtPayload } from 'jsonwebtoken';
import { WorkspaceRole } from '../repositories';

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  tokenClaims: JwtPayload;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: AuthContext;
    }
  }
}

export {};
