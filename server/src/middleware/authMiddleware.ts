/**
 * AuthMiddleware
 * Supabase JWT verification + workspace membership authorization.
 */

import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { getWorkspaceMembership } from '../services/workspaceAccessService';
import { WorkspaceRole } from '../repositories';

const WORKSPACE_HEADER = 'x-workspace-id';

function isSupabaseAuthEnabled(): boolean {
  return process.env.FEATURE_SUPABASE_AUTH === 'true';
}

function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue || headerValue.trim().length === 0) {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim().length > 0 ? token.trim() : null;
}

function resolveWorkspaceId(req: Request): string | null {
  const raw = req.header(WORKSPACE_HEADER);
  if (raw && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

interface JwksResponse {
  keys: JwkPublicKey[];
}

interface JwkPublicKey {
  kid?: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

interface CachedJwks {
  byKid: Map<string, JwkPublicKey>;
  expiresAt: number;
}

let cachedJwksByUrl: Map<string, CachedJwks> = new Map();

function extractJwtHeader(token: string): { kid?: string; alg?: string } {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded !== 'object') {
    return {};
  }

  const header = decoded.header as { kid?: string; alg?: string };
  return {
    kid: header.kid,
    alg: header.alg
  };
}

function verifyTokenWithSecret(token: string, secret: string): JwtPayload {
  const verified = jwt.verify(token, secret);
  if (typeof verified === 'string') {
    throw new Error('Unexpected token payload format');
  }
  return verified;
}

async function getJwksForUrl(jwksUrl: string): Promise<CachedJwks> {
  const cached = cachedJwksByUrl.get(jwksUrl);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch JWKS: ${response.status} ${response.statusText}`);
  }

  const body = await response.json() as JwksResponse;
  const byKid = new Map<string, JwkPublicKey>();
  for (const jwk of body.keys ?? []) {
    if (typeof jwk.kid === 'string' && jwk.kid.length > 0) {
      byKid.set(jwk.kid, jwk);
    }
  }

  const snapshot: CachedJwks = {
    byKid,
    expiresAt: now + (10 * 60 * 1000)
  };
  cachedJwksByUrl.set(jwksUrl, snapshot);
  return snapshot;
}

async function verifyTokenWithJwks(token: string, supabaseUrl: string): Promise<JwtPayload> {
  const header = extractJwtHeader(token);
  if (!header.kid) {
    throw new Error('Token header does not include kid');
  }

  const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', supabaseUrl).toString();
  const cache = await getJwksForUrl(jwksUrl);
  const jwk = cache.byKid.get(header.kid);

  if (!jwk) {
    throw new Error(`No signing key found for kid: ${header.kid}`);
  }

  const keyObject = createPublicKey({
    key: jwk as unknown as Record<string, unknown>,
    format: 'jwk'
  });

  const verified = jwt.verify(token, keyObject);
  if (typeof verified === 'string') {
    throw new Error('Unexpected token payload format');
  }

  return verified;
}

async function verifySupabaseToken(token: string): Promise<JwtPayload> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret && jwtSecret.length > 0) {
    return verifyTokenWithSecret(token, jwtSecret);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.length === 0) {
    throw new Error('SUPABASE_URL or SUPABASE_JWT_SECRET is required for auth verification');
  }

  return verifyTokenWithJwks(token, supabaseUrl);
}

function resolveRole(payload: JwtPayload): WorkspaceRole | null {
  const role = payload.role;
  if (
    role === 'owner' ||
    role === 'admin' ||
    role === 'member' ||
    role === 'viewer'
  ) {
    return role;
  }

  return null;
}

function maybeDecodeTokenPayload(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded === 'string') {
      return null;
    }
    return decoded;
  } catch (_error) {
    return null;
  }
}

function shouldSkipAuth(path: string): boolean {
  return path.startsWith('/metrics') || path.startsWith('/system/healthz') || path.startsWith('/system/ready');
}

export async function supabaseAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!isSupabaseAuthEnabled() || shouldSkipAuth(req.path)) {
    next();
    return;
  }

  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({
      success: false,
      error: `Missing required ${WORKSPACE_HEADER} header`
    });
    return;
  }

  const token = extractBearerToken(req.header('authorization'));
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header'
    });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = await verifySupabaseToken(token);
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? `Token verification failed: ${error.message}` : 'Token verification failed'
    });
    return;
  }

  const userId = typeof payload.sub === 'string' ? payload.sub : null;
  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Token payload does not contain a valid subject'
    });
    return;
  }

  const roleFromToken = resolveRole(payload);
  const allowServiceRole = process.env.ALLOW_SERVICE_ROLE_BYPASS === 'true';
  const fallbackRole = maybeDecodeTokenPayload(token)?.role;

  if (allowServiceRole && fallbackRole === 'service_role') {
    req.auth = {
      userId,
      workspaceId,
      role: roleFromToken ?? 'admin',
      tokenClaims: payload
    };
    next();
    return;
  }

  let membership;
  try {
    membership = await getWorkspaceMembership(userId, workspaceId);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: error instanceof Error ? `Membership check failed: ${error.message}` : 'Membership check failed'
    });
    return;
  }

  if (!membership) {
    res.status(403).json({
      success: false,
      error: 'User is not a member of the requested workspace'
    });
    return;
  }

  req.auth = {
    userId,
    workspaceId,
    role: membership.role,
    tokenClaims: payload
  };

  next();
}
