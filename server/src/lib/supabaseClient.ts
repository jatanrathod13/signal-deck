/**
 * SupabaseClient
 * Centralized admin client and readiness checks for server-side data access.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

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

async function fetchWithTimeout(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> {
  const timeoutMs = parsePositiveInt(process.env.SUPABASE_READ_TIMEOUT_MS, 10000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? '';
}

export function getSupabaseServiceKey(): string {
  return process.env.SUPABASE_SECRET_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? '';
}

export function hasSupabaseAdminConfig(): boolean {
  return getSupabaseUrl().length > 0 && getSupabaseServiceKey().length > 0;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!hasSupabaseAdminConfig()) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        fetch: fetchWithTimeout
      }
    });
  }

  return adminClient;
}

export function resetSupabaseAdminClientForTests(): void {
  adminClient = null;
}

export async function checkSupabaseReadiness(): Promise<{ ok: boolean; detail: string }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      ok: false,
      detail: 'SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY are required'
    };
  }

  const { error } = await client
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  if (error) {
    return {
      ok: false,
      detail: error.message
    };
  }

  return {
    ok: true,
    detail: 'reachable'
  };
}
