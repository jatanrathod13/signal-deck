/**
 * WebhookManager
 * CRUD surface for inbound/outbound webhook configuration.
 */

import { useMemo, useState } from 'react';
import { BellRing, Loader2, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import {
  useCreateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useUpdateWebhook,
  useWebhooks
} from '../hooks';
import { cn } from '../lib/utils';
import type { WebhookDefinition, WebhookDirection, WebhookStatus } from '../types';

interface WebhookManagerProps {
  className?: string;
}

interface WebhookFormState {
  direction: WebhookDirection;
  eventName: string;
  targetUrl: string;
  headers: string;
  maxAttempts: number;
  status: WebhookStatus;
  metadata: string;
}

const DEFAULT_FORM: WebhookFormState = {
  direction: 'outbound',
  eventName: 'task.completed',
  targetUrl: '',
  headers: '{\n  "x-source": "agent-platform"\n}',
  maxAttempts: 5,
  status: 'pending',
  metadata: '{\n  "secret": ""\n}'
};

function toFormState(webhook: WebhookDefinition): WebhookFormState {
  return {
    direction: webhook.direction,
    eventName: webhook.eventName,
    targetUrl: webhook.targetUrl ?? '',
    headers: JSON.stringify(webhook.headers ?? {}, null, 2),
    maxAttempts: webhook.maxAttempts,
    status: webhook.status,
    metadata: JSON.stringify(webhook.metadata ?? {}, null, 2)
  };
}

function parseRecord(value: string, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Must be a JSON object');
  }

  return parsed as Record<string, unknown>;
}

export function WebhookManager({ className }: WebhookManagerProps) {
  const [form, setForm] = useState<WebhookFormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const webhooksQuery = useWebhooks();
  const createMutation = useCreateWebhook();
  const updateMutation = useUpdateWebhook();
  const deleteMutation = useDeleteWebhook();
  const testMutation = useTestWebhook();

  const webhooks = useMemo(() => (webhooksQuery.data ?? []).slice(), [webhooksQuery.data]);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setFormError(null);
  };

  const beginEdit = (webhook: WebhookDefinition) => {
    setEditingId(webhook.id);
    setForm(toFormState(webhook));
    setFormError(null);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    let headers: Record<string, unknown>;
    let metadata: Record<string, unknown>;

    try {
      headers = parseRecord(form.headers, {});
      metadata = parseRecord(form.metadata, {});
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid JSON fields');
      return;
    }

    const payload = {
      direction: form.direction,
      eventName: form.eventName.trim(),
      targetUrl: form.direction === 'outbound' ? form.targetUrl.trim() : undefined,
      headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)])),
      maxAttempts: form.maxAttempts,
      status: form.status,
      metadata
    };

    if (!payload.eventName) {
      setFormError('Event name is required.');
      return;
    }

    if (payload.direction === 'outbound' && !payload.targetUrl) {
      setFormError('Target URL is required for outbound webhooks.');
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save webhook');
    }
  };

  const toggleEnabled = async (webhook: WebhookDefinition) => {
    const nextStatus: WebhookStatus = webhook.status === 'disabled' ? 'pending' : 'disabled';
    try {
      await updateMutation.mutateAsync({
        id: webhook.id,
        data: { status: nextStatus }
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to update webhook');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <section className={cn('space-y-4', className)}>
      <header className="glass-panel flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-violet-300/30 bg-violet-300/10 p-2">
            <BellRing className="h-4 w-4 text-violet-200" />
          </div>
          <div>
            <p className="kicker">Integrations</p>
            <h2 className="panel-title">Webhooks</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => webhooksQuery.refetch()}
          className="btn-ghost rounded-xl px-3 py-2 text-sm font-medium"
          disabled={webhooksQuery.isFetching}
        >
          <span className="inline-flex items-center gap-2">
            <RefreshCw className={cn('h-4 w-4', webhooksQuery.isFetching && 'animate-spin')} />
            Refresh
          </span>
        </button>
      </header>

      <form onSubmit={onSubmit} className="glass-panel space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Direction</label>
            <select
              className="input-field"
              value={form.direction}
              onChange={(event) => setForm((previous) => ({ ...previous, direction: event.target.value as WebhookDirection }))}
            >
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Event Name</label>
            <input
              className="input-field"
              value={form.eventName}
              onChange={(event) => setForm((previous) => ({ ...previous, eventName: event.target.value }))}
              placeholder="task.completed"
            />
          </div>
          {form.direction === 'outbound' && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Target URL</label>
              <input
                className="input-field"
                value={form.targetUrl}
                onChange={(event) => setForm((previous) => ({ ...previous, targetUrl: event.target.value }))}
                placeholder="https://example.com/hooks/task-completed"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Max Attempts</label>
            <input
              className="input-field"
              type="number"
              min={1}
              max={20}
              value={form.maxAttempts}
              onChange={(event) => setForm((previous) => ({ ...previous, maxAttempts: Number.parseInt(event.target.value, 10) || 1 }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value as WebhookStatus }))}
            >
              <option value="pending">pending</option>
              <option value="delivered">delivered</option>
              <option value="failed">failed</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Headers JSON</label>
            <textarea
              className="input-field font-mono text-xs"
              rows={5}
              value={form.headers}
              onChange={(event) => setForm((previous) => ({ ...previous, headers: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Metadata JSON</label>
            <textarea
              className="input-field font-mono text-xs"
              rows={5}
              value={form.metadata}
              onChange={(event) => setForm((previous) => ({ ...previous, metadata: event.target.value }))}
            />
          </div>
        </div>

        {formError && (
          <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
            {formError}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold" type="submit" disabled={isSaving}>
            <span className="inline-flex items-center gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingId ? 'Update Webhook' : 'Create Webhook'}
            </span>
          </button>
          {editingId && (
            <button type="button" className="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {webhooksQuery.isLoading && (
          <div className="glass-panel px-4 py-6 text-sm text-slate-300">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Loading webhooks...
          </div>
        )}

        {!webhooksQuery.isLoading && webhooks.length === 0 && (
          <div className="glass-panel px-4 py-6 text-sm text-slate-400">
            No webhooks configured.
          </div>
        )}

        {webhooks.map((webhook) => (
          <article key={webhook.id} className="glass-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-100">{webhook.eventName}</p>
                <p className="font-mono text-xs text-slate-400">{webhook.direction} {webhook.targetUrl ? `→ ${webhook.targetUrl}` : ''}</p>
              </div>
              <span className={cn(
                'rounded-full px-2 py-1 text-[10px] uppercase tracking-wide',
                webhook.status === 'delivered'
                  ? 'bg-emerald-300/15 text-emerald-100'
                  : webhook.status === 'failed'
                    ? 'bg-rose-300/15 text-rose-100'
                    : webhook.status === 'disabled'
                      ? 'bg-slate-300/15 text-slate-300'
                      : 'bg-amber-300/15 text-amber-100'
              )}>
                {webhook.status}
              </span>
            </div>

            <div className="mt-2 text-xs text-slate-400">
              <p>Attempts: {webhook.attemptCount}/{webhook.maxAttempts}</p>
              <p>Last attempt: {webhook.lastAttemptAt ? new Date(webhook.lastAttemptAt).toLocaleString() : 'n/a'}</p>
              {webhook.error && <p className="text-rose-200">Error: {webhook.error}</p>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold" type="button" onClick={() => beginEdit(webhook)}>
                Edit
              </button>
              <button className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold" type="button" onClick={() => toggleEnabled(webhook)}>
                {webhook.status === 'disabled' ? 'Enable' : 'Disable'}
              </button>
              {webhook.direction === 'outbound' && (
                <button
                  className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold"
                  type="button"
                  onClick={() => testMutation.mutate({ id: webhook.id })}
                  disabled={testMutation.isPending}
                >
                  <span className="inline-flex items-center gap-1">
                    <Send className="h-3 w-3" />
                    Test
                  </span>
                </button>
              )}
              <button
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
                type="button"
                onClick={() => deleteMutation.mutate(webhook.id)}
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

export default WebhookManager;
