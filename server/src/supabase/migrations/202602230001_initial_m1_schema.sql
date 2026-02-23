-- M1 initial schema for app-level multi-tenancy with workspace_id + RLS.
-- Date: 2026-02-23
-- Scope: workspaces, workspace_members, agents, tasks, plans, runs, run_events, webhooks, schedules, audit_events.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_role') then
    create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agent_status') then
    create type public.agent_status as enum ('registered', 'starting', 'running', 'idle', 'error', 'stopped');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('pending', 'blocked', 'processing', 'completed', 'failed', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_execution_mode') then
    create type public.task_execution_mode as enum ('tool_loop', 'claude_cli');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_status') then
    create type public.plan_status as enum ('draft', 'active', 'completed', 'failed', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_step_status') then
    create type public.plan_step_status as enum ('pending', 'blocked', 'running', 'completed', 'failed', 'skipped');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'run_status') then
    create type public.run_status as enum ('pending', 'running', 'completed', 'failed', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'run_event_type') then
    create type public.run_event_type as enum (
      'run.started',
      'run.completed',
      'run.failed',
      'task.status',
      'message.delta',
      'message.created',
      'tool.call',
      'tool.result',
      'tool.error',
      'plan.created',
      'plan.step.status',
      'research.finding',
      'research.source',
      'model.route.selected',
      'evaluation.completed',
      'approval.requested',
      'approval.resolved',
      'stream.resumed'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'webhook_direction') then
    create type public.webhook_direction as enum ('inbound', 'outbound');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'webhook_delivery_status') then
    create type public.webhook_delivery_status as enum ('pending', 'delivered', 'failed', 'disabled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'schedule_run_status') then
    create type public.schedule_run_status as enum ('never', 'running', 'succeeded', 'failed');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  invited_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create table if not exists public.agents (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  type text not null,
  config jsonb not null default '{}'::jsonb,
  status public.agent_status not null default 'registered',
  created_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plans (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  objective text not null,
  status public.plan_status not null default 'draft',
  created_by_task_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plan_steps (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id text not null references public.plans(id) on delete cascade,
  title text not null,
  description text,
  agent_id text references public.agents(id) on delete set null,
  task_type text not null,
  task_data jsonb not null default '{}'::jsonb,
  depends_on_step_ids text[] not null default '{}',
  status public.plan_step_status not null default 'pending',
  task_id text,
  output jsonb,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.runs (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id text not null,
  root_task_id text,
  status public.run_status not null default 'pending',
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  summary text,
  error text,
  execution_profile text not null default 'standard',
  artifacts jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id text references public.agents(id) on delete set null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  execution_mode public.task_execution_mode not null default 'tool_loop',
  status public.task_status not null default 'pending',
  priority integer not null default 0,
  parent_task_id text references public.tasks(id) on delete set null,
  plan_id text references public.plans(id) on delete set null,
  step_id text,
  depends_on_task_ids text[] not null default '{}',
  child_task_ids text[] not null default '{}',
  idempotency_key text,
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  conversation_id text,
  run_id text references public.runs(id) on delete set null,
  result jsonb,
  error text,
  error_type text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.run_events (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id text not null references public.runs(id) on delete cascade,
  conversation_id text not null,
  type public.run_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default timezone('utc', now()),
  sequence_id bigint generated always as identity
);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  direction public.webhook_direction not null,
  event_name text not null,
  target_url text,
  status public.webhook_delivery_status not null default 'pending',
  headers jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  signature text,
  response_status integer,
  response_body text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  cron_expression text not null,
  timezone text not null default 'UTC',
  payload jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  retry_limit integer not null default 3,
  retry_backoff_seconds integer not null default 60,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_run_status public.schedule_run_status not null default 'never',
  created_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, name)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user',
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_tasks_workspace_idempotency
  on public.tasks (workspace_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_workspace_members_user_id
  on public.workspace_members (user_id);

create index if not exists idx_agents_workspace_status
  on public.agents (workspace_id, status, updated_at desc);

create index if not exists idx_tasks_workspace_status_created
  on public.tasks (workspace_id, status, created_at desc);

create index if not exists idx_tasks_workspace_run_id
  on public.tasks (workspace_id, run_id);

create index if not exists idx_plan_steps_workspace_plan
  on public.plan_steps (workspace_id, plan_id, status);

create index if not exists idx_runs_workspace_status_started
  on public.runs (workspace_id, status, started_at desc);

create index if not exists idx_run_events_run_sequence
  on public.run_events (run_id, sequence_id);

create index if not exists idx_run_events_workspace_timestamp
  on public.run_events (workspace_id, timestamp desc);

create index if not exists idx_webhooks_workspace_status_next_attempt
  on public.webhooks (workspace_id, status, next_attempt_at);

create index if not exists idx_schedules_workspace_enabled_next_run
  on public.schedules (workspace_id, enabled, next_run_at);

create index if not exists idx_audit_events_workspace_occurred
  on public.audit_events (workspace_id, occurred_at desc);

drop trigger if exists trg_workspaces_set_updated_at on public.workspaces;
create trigger trg_workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_members_set_updated_at on public.workspace_members;
create trigger trg_workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_agents_set_updated_at on public.agents;
create trigger trg_agents_set_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

drop trigger if exists trg_plans_set_updated_at on public.plans;
create trigger trg_plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_plan_steps_set_updated_at on public.plan_steps;
create trigger trg_plan_steps_set_updated_at
before update on public.plan_steps
for each row execute function public.set_updated_at();

drop trigger if exists trg_runs_set_updated_at on public.runs;
create trigger trg_runs_set_updated_at
before update on public.runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_set_updated_at on public.tasks;
create trigger trg_tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_webhooks_set_updated_at on public.webhooks;
create trigger trg_webhooks_set_updated_at
before update on public.webhooks
for each row execute function public.set_updated_at();

drop trigger if exists trg_schedules_set_updated_at on public.schedules;
create trigger trg_schedules_set_updated_at
before update on public.schedules
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.plans enable row level security;
alter table public.plan_steps enable row level security;
alter table public.runs enable row level security;
alter table public.run_events enable row level security;
alter table public.webhooks enable row level security;
alter table public.schedules enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
on public.workspaces
for select
using (public.is_workspace_member(id));

drop policy if exists workspaces_insert_creator on public.workspaces;
create policy workspaces_insert_creator
on public.workspaces
for insert
with check (auth.uid() = created_by_user_id);

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin
on public.workspaces
for update
using (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]));

drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner
on public.workspaces
for delete
using (public.has_workspace_role(id, array['owner']::public.workspace_role[]));

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin
on public.workspace_members
for insert
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

drop policy if exists workspace_members_update_admin on public.workspace_members;
create policy workspace_members_update_admin
on public.workspace_members
for update
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

drop policy if exists workspace_members_delete_admin on public.workspace_members;
create policy workspace_members_delete_admin
on public.workspace_members
for delete
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

drop policy if exists agents_select_member on public.agents;
create policy agents_select_member
on public.agents
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists agents_write_member on public.agents;
create policy agents_write_member
on public.agents
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists tasks_select_member on public.tasks;
create policy tasks_select_member
on public.tasks
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists tasks_write_member on public.tasks;
create policy tasks_write_member
on public.tasks
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists plans_select_member on public.plans;
create policy plans_select_member
on public.plans
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists plans_write_member on public.plans;
create policy plans_write_member
on public.plans
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists plan_steps_select_member on public.plan_steps;
create policy plan_steps_select_member
on public.plan_steps
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists plan_steps_write_member on public.plan_steps;
create policy plan_steps_write_member
on public.plan_steps
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists runs_select_member on public.runs;
create policy runs_select_member
on public.runs
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists runs_write_member on public.runs;
create policy runs_write_member
on public.runs
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists run_events_select_member on public.run_events;
create policy run_events_select_member
on public.run_events
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists run_events_insert_member on public.run_events;
create policy run_events_insert_member
on public.run_events
for insert
with check (public.is_workspace_member(workspace_id));

drop policy if exists webhooks_select_member on public.webhooks;
create policy webhooks_select_member
on public.webhooks
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists webhooks_write_member on public.webhooks;
create policy webhooks_write_member
on public.webhooks
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists schedules_select_member on public.schedules;
create policy schedules_select_member
on public.schedules
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists schedules_write_member on public.schedules;
create policy schedules_write_member
on public.schedules
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists audit_events_select_member on public.audit_events;
create policy audit_events_select_member
on public.audit_events
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists audit_events_insert_member on public.audit_events;
create policy audit_events_insert_member
on public.audit_events
for insert
with check (public.is_workspace_member(workspace_id));
