-- Phase 5 governance and quota primitives.
-- Date: 2026-02-23

create table if not exists public.workspace_governance_workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_type text not null,
  status text not null default 'pending',
  requested_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  decision_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create table if not exists public.workspace_quota_policies (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default true,
  max_tasks_per_hour integer not null default 500,
  max_runs_per_day integer not null default 200,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_quota_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  usage_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, metric, window_start, window_seconds)
);

create index if not exists idx_governance_workflows_workspace_status
  on public.workspace_governance_workflows (workspace_id, status, created_at desc);

create index if not exists idx_quota_usage_workspace_metric_window
  on public.workspace_quota_usage (workspace_id, metric, window_start desc);

drop trigger if exists trg_workspace_governance_workflows_set_updated_at on public.workspace_governance_workflows;
create trigger trg_workspace_governance_workflows_set_updated_at
before update on public.workspace_governance_workflows
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_quota_policies_set_updated_at on public.workspace_quota_policies;
create trigger trg_workspace_quota_policies_set_updated_at
before update on public.workspace_quota_policies
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_quota_usage_set_updated_at on public.workspace_quota_usage;
create trigger trg_workspace_quota_usage_set_updated_at
before update on public.workspace_quota_usage
for each row execute function public.set_updated_at();

alter table public.workspace_governance_workflows enable row level security;
alter table public.workspace_quota_policies enable row level security;
alter table public.workspace_quota_usage enable row level security;

drop policy if exists workflows_select_member on public.workspace_governance_workflows;
create policy workflows_select_member
on public.workspace_governance_workflows
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists workflows_write_admin on public.workspace_governance_workflows;
create policy workflows_write_admin
on public.workspace_governance_workflows
for all
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

drop policy if exists quota_policy_select_member on public.workspace_quota_policies;
create policy quota_policy_select_member
on public.workspace_quota_policies
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists quota_policy_write_admin on public.workspace_quota_policies;
create policy quota_policy_write_admin
on public.workspace_quota_policies
for all
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

drop policy if exists quota_usage_select_member on public.workspace_quota_usage;
create policy quota_usage_select_member
on public.workspace_quota_usage
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists quota_usage_insert_member on public.workspace_quota_usage;
create policy quota_usage_insert_member
on public.workspace_quota_usage
for insert
with check (public.is_workspace_member(workspace_id));

drop policy if exists quota_usage_update_member on public.workspace_quota_usage;
create policy quota_usage_update_member
on public.workspace_quota_usage
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
