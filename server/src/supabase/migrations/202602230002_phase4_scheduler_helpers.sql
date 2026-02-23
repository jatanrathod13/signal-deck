-- Phase 4 scheduler helpers: pg_cron integration hooks with safe fallback behavior.
-- Date: 2026-02-23

alter table if exists public.schedules
  add column if not exists pg_cron_job_id bigint;

create or replace function public.enqueue_schedule_run(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.schedules
  set
    next_run_at = timezone('utc', now()),
    last_run_status = 'running'::public.schedule_run_status,
    updated_at = timezone('utc', now())
  where id = p_schedule_id
    and enabled = true;
end;
$$;

create or replace function public.remove_workspace_schedule_job(p_schedule_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    return false;
  end if;

  select pg_cron_job_id
  into existing_job_id
  from public.schedules
  where id = p_schedule_id;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  update public.schedules
  set pg_cron_job_id = null
  where id = p_schedule_id;

  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.upsert_workspace_schedule_job(
  p_schedule_id uuid,
  p_cron_expression text,
  p_timezone text default 'UTC',
  p_enabled boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_job_id bigint;
  created_job_id bigint;
  command_sql text;
begin
  if to_regclass('cron.job') is null then
    return null;
  end if;

  if not p_enabled then
    perform public.remove_workspace_schedule_job(p_schedule_id);
    return null;
  end if;

  select pg_cron_job_id
  into previous_job_id
  from public.schedules
  where id = p_schedule_id;

  if previous_job_id is not null then
    perform cron.unschedule(previous_job_id);
  end if;

  command_sql := format(
    'select public.enqueue_schedule_run(''%s''::uuid)',
    p_schedule_id
  );

  select cron.schedule(
    format('schedule_%s', p_schedule_id),
    p_cron_expression,
    command_sql
  )
  into created_job_id;

  update public.schedules
  set
    pg_cron_job_id = created_job_id,
    timezone = coalesce(nullif(trim(p_timezone), ''), timezone)
  where id = p_schedule_id;

  return created_job_id;
exception when others then
  return null;
end;
$$;

-- Optional extension setup. If unavailable in target environment, migration remains valid.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron extension not available in this environment';
  end;
end;
$$;
