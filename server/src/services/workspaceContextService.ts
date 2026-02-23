/**
 * WorkspaceContextService
 * Request-scoped workspace and actor context via AsyncLocalStorage.
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface WorkspaceRequestContext {
  workspaceId?: string;
  userId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const contextStorage = new AsyncLocalStorage<WorkspaceRequestContext>();

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function runWithRequestContext<T>(
  context: WorkspaceRequestContext,
  callback: () => T
): T {
  const merged: WorkspaceRequestContext = {
    ...(contextStorage.getStore() ?? {}),
    ...context
  };

  return contextStorage.run(merged, callback);
}

export function getRequestContext(): WorkspaceRequestContext {
  return contextStorage.getStore() ?? {};
}

export function getCurrentWorkspaceId(): string | undefined {
  const fromContext = normalizeOptionalString(getRequestContext().workspaceId);
  if (fromContext) {
    return fromContext;
  }

  return undefined;
}

export function getDefaultWorkspaceId(): string | undefined {
  const fromEnv = normalizeOptionalString(process.env.DEFAULT_WORKSPACE_ID);
  if (fromEnv) {
    return fromEnv;
  }

  return undefined;
}

export function getCurrentWorkspaceIdOrDefault(): string | undefined {
  const fromContext = getCurrentWorkspaceId();
  if (fromContext) {
    return fromContext;
  }

  return getDefaultWorkspaceId();
}

export function requireCurrentWorkspaceId(): string {
  const workspaceId = getCurrentWorkspaceIdOrDefault();
  if (!workspaceId) {
    throw new Error('Workspace context is required but was not provided');
  }

  return workspaceId;
}

export function getCurrentActorUserId(): string | undefined {
  const fromContext = normalizeOptionalString(getRequestContext().userId);
  if (fromContext) {
    return fromContext;
  }

  return normalizeOptionalString(process.env.SUPABASE_DEFAULT_USER_ID);
}

export function withWorkspaceContext<T>(workspaceId: string, callback: () => T): T {
  return runWithRequestContext({ workspaceId }, callback);
}

export function isWorkspaceMatch(entityWorkspaceId: string | undefined, activeWorkspaceId: string | undefined): boolean {
  if (!activeWorkspaceId) {
    return true;
  }

  return entityWorkspaceId === activeWorkspaceId;
}
