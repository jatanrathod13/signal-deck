/**
 * ScheduleManager
 * CRUD management surface for task schedules.
 */

import { useMemo, useState } from 'react';
import { CalendarClock, Loader2, PlayCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
  useTriggerSchedule,
  useUpdateSchedule
} from '../hooks';
import { cn } from '../lib/utils';
import type { ScheduleDefinition } from '../types';

interface ScheduleManagerProps {
  className?: string;
}

interface ScheduleFormState {
  name: string;
  cronExpression: string;
  timezone: string;
  payload: string;
  enabled: boolean;
  retryLimit: number;
  retryBackoffSeconds: number;
}

const DEFAULT_FORM: ScheduleFormState = {
  name: '',
  cronExpression: '*/15 * * * *',
  timezone: 'UTC',
  payload: JSON.stringify(
    {
      agentId: '',
      type: 'scheduled-task',
      data: {
        prompt: 'Run scheduled automation step'
      },
      executionMode: 'tool_loop',
      priority: 1
    },
    null,
    2
  ),
  enabled: true,
  retryLimit: 3,
  retryBackoffSeconds: 60
};

function toFormState(schedule: ScheduleDefinition): ScheduleFormState {
  return {
    name: schedule.name,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    payload: JSON.stringify(schedule.payload ?? {}, null, 2),
    enabled: schedule.enabled,
    retryLimit: schedule.retryLimit,
    retryBackoffSeconds: schedule.retryBackoffSeconds
  };
}

export function ScheduleManager({ className }: ScheduleManagerProps) {
  const [form, setForm] = useState<ScheduleFormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const schedulesQuery = useSchedules();
  const createMutation = useCreateSchedule();
  const updateMutation = useUpdateSchedule();
  const deleteMutation = useDeleteSchedule();
  const triggerMutation = useTriggerSchedule();

  const schedules = useMemo(
    () => (schedulesQuery.data ?? []).slice().sort((a, b) => {
      const left = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    }),
    [schedulesQuery.data]
  );

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setFormError(null);
  };

  const parsePayload = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(form.payload);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setFormError('Payload must be a JSON object.');
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      setFormError('Payload JSON is invalid.');
      return null;
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const payload = parsePayload();
    if (!payload) {
      return;
    }

    const data = {
      name: form.name.trim(),
      cronExpression: form.cronExpression.trim(),
      timezone: form.timezone.trim() || 'UTC',
      payload,
      enabled: form.enabled,
      retryLimit: form.retryLimit,
      retryBackoffSeconds: form.retryBackoffSeconds
    };

    if (!data.name) {
      setFormError('Name is required.');
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save schedule');
    }
  };

  const beginEdit = (schedule: ScheduleDefinition) => {
    setEditingId(schedule.id);
    setForm(toFormState(schedule));
    setFormError(null);
  };

  const toggleEnabled = async (schedule: ScheduleDefinition) => {
    try {
      await updateMutation.mutateAsync({
        id: schedule.id,
        data: {
          enabled: !schedule.enabled
        }
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to update schedule');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <section className={cn('space-y-4', className)}>
      <header className="glass-panel flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-2">
            <CalendarClock className="h-4 w-4 text-amber-200" />
          </div>
          <div>
            <p className="kicker">Automation</p>
            <h2 className="panel-title">Schedules</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => schedulesQuery.refetch()}
          className="btn-ghost rounded-xl px-3 py-2 text-sm font-medium"
          disabled={schedulesQuery.isFetching}
        >
          <span className="inline-flex items-center gap-2">
            <RefreshCw className={cn('h-4 w-4', schedulesQuery.isFetching && 'animate-spin')} />
            Refresh
          </span>
        </button>
      </header>

      <form onSubmit={onSubmit} className="glass-panel space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Name</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Nightly Sync"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Cron</label>
            <input
              className="input-field font-mono"
              value={form.cronExpression}
              onChange={(event) => setForm((previous) => ({ ...previous, cronExpression: event.target.value }))}
              placeholder="*/30 * * * *"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Timezone</label>
            <input
              className="input-field"
              value={form.timezone}
              onChange={(event) => setForm((previous) => ({ ...previous, timezone: event.target.value }))}
              placeholder="UTC"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Retry Limit</label>
              <input
                className="input-field"
                type="number"
                min={1}
                max={20}
                value={form.retryLimit}
                onChange={(event) => setForm((previous) => ({ ...previous, retryLimit: Number.parseInt(event.target.value, 10) || 1 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Backoff (s)</label>
              <input
                className="input-field"
                type="number"
                min={1}
                max={3600}
                value={form.retryBackoffSeconds}
                onChange={(event) => setForm((previous) => ({ ...previous, retryBackoffSeconds: Number.parseInt(event.target.value, 10) || 60 }))}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Task Payload (JSON)</label>
          <textarea
            className="input-field font-mono text-xs"
            rows={7}
            value={form.payload}
            onChange={(event) => setForm((previous) => ({ ...previous, payload: event.target.value }))}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((previous) => ({ ...previous, enabled: event.target.checked }))}
          />
          Enabled
        </label>

        {formError && (
          <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
            {formError}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold" type="submit" disabled={isSaving}>
            <span className="inline-flex items-center gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingId ? 'Update Schedule' : 'Create Schedule'}
            </span>
          </button>
          {editingId && (
            <button className="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold" type="button" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {schedulesQuery.isLoading && (
          <div className="glass-panel px-4 py-6 text-sm text-slate-300">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Loading schedules...
          </div>
        )}

        {!schedulesQuery.isLoading && schedules.length === 0 && (
          <div className="glass-panel px-4 py-6 text-sm text-slate-400">
            No schedules created yet.
          </div>
        )}

        {schedules.map((schedule) => (
          <article key={schedule.id} className="glass-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-100">{schedule.name}</p>
                <p className="font-mono text-xs text-slate-400">{schedule.cronExpression} ({schedule.timezone})</p>
              </div>
              <span className={cn(
                'rounded-full px-2 py-1 text-[10px] uppercase tracking-wide',
                schedule.enabled ? 'bg-emerald-300/15 text-emerald-100' : 'bg-slate-300/15 text-slate-300'
              )}>
                {schedule.enabled ? 'enabled' : 'disabled'}
              </span>
            </div>

            <div className="mt-2 text-xs text-slate-400">
              <p>Next run: {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : 'n/a'}</p>
              <p>Last status: {schedule.lastRunStatus}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
                onClick={() => beginEdit(schedule)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
                onClick={() => toggleEnabled(schedule)}
              >
                {schedule.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold"
                onClick={() => triggerMutation.mutate(schedule.id)}
                disabled={triggerMutation.isPending}
              >
                <span className="inline-flex items-center gap-1">
                  <PlayCircle className="h-3 w-3" />
                  Trigger
                </span>
              </button>
              <button
                type="button"
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
                onClick={() => deleteMutation.mutate(schedule.id)}
                disabled={deleteMutation.isPending}
              >
                <span className="inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" />
                  Delete
                </span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ScheduleManager;
