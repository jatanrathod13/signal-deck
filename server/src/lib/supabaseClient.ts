/**
 * SupabaseClient
 * Centralized admin client and readiness checks for server-side data access.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

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
