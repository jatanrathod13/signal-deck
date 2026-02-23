/**
 * WorkspaceAccessService
 * Membership lookup utilities for workspace-scoped authorization.
 */

import { WorkspaceMemberRecord } from '../repositories';
import { getSupabaseAdminClient } from '../lib/supabaseClient';
import { SupabaseWorkspaceMemberRepository } from '../repositories/supabase';

export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMemberRecord | null> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const repository = new SupabaseWorkspaceMemberRepository(client);
  return repository.getWorkspaceMember(workspaceId, userId);
}
