/**
 * ObservabilityPanel
 * Runtime observability for runs/tasks plus scheduler/webhook event streams.
 */

import { useMemo } from 'react';
import { Activity, BellRing, CalendarClock, CheckCircle2, Loader2, TimerReset, XCircle } from 'lucide-react';
import { useRuns, useTasks } from '../hooks';
import { useConversationStore } from '../stores/conversationStore';
import { useOperationsStore } from '../stores/operationsStore';
import { cn } from '../lib/utils';
import type { RunStatus, TaskStatus } from '../types';

interface ObservabilityPanelProps {
  className?: string;
}

const runStatuses: RunStatus[] = ['running', 'completed', 'failed', 'pending', 'cancelled'];
const taskStatuses: TaskStatus[] = ['processing', 'pending', 'blocked', 'completed', 'failed', 'cancelled'];

export function ObservabilityPanel({ className }: ObservabilityPanelProps) {
  const { data: runs, isLoading: runsLoading } = useRuns(undefined, 200);
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const runEventsByConversation = useConversationStore((state) => state.runEventsByConversation);
  const scheduleEvents = useOperationsStore((state) => state.scheduleEvents);
  const webhookEvents = useOperationsStore((state) => state.webhookEvents);

  const runCounts = useMemo(() => {
    const counts: Record<RunStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const run of runs ?? []) {
      counts[run.status] += 1;
    }

    return counts;
  }, [runs]);

  const taskCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      pending: 0,
      blocked: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const task of tasks ?? []) {
      counts[task.status] += 1;
    }

    return counts;
  }, [tasks]);

  const totalRunEvents = useMemo(
    () => Object.values(runEventsByConversation).reduce((sum, events) => sum + events.length, 0),
    [runEventsByConversation]
  );

  const recentRuns = useMemo(() => (runs ?? []).slice(0, 8), [runs]);
  const recentTaskFailures = useMemo(() => (tasks ?? []).filter((task) => task.status === 'failed').slice(0, 8), [tasks]);

  const scheduleFeed = scheduleEvents.slice(0, 10);
  const webhookFeed = webhookEvents.slice(0, 10);

  return (
    <section className={cn('space-y-4', className)}>
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-2">
            <Activity className="h-4 w-4 text-cyan-200" />
          </div>
          <div>
            <p className="kicker">Runtime Health</p>
            <h2 className="panel-title">Observability</h2>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
          Run events captured: <span className="font-mono text-cyan-200">{totalRunEvents}</span>
        </div>
      </header>

      {(runsLoading || tasksLoading) && (
        <div className="glass-panel flex items-center justify-center py-8 text-slate-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-200" />
          Loading observability data...
        </div>
      )}

      {!runsLoading && !tasksLoading && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="glass-panel p-4">
              <p className="kicker mb-2">Run Status Mix</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {runStatuses.map((status) => (
                  <div key={status} className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                    <div className="uppercase tracking-wide text-slate-400">{status}</div>
                    <div className="font-mono text-base text-slate-100">{runCounts[status]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-4">
              <p className="kicker mb-2">Task Status Mix</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {taskStatuses.map((status) => (
                  <div key={status} className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                    <div className="uppercase tracking-wide text-slate-400">{status}</div>
                    <div className="font-mono text-base text-slate-100">{taskCounts[status]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="glass-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <TimerReset className="h-4 w-4 text-cyan-200" />
                <h3 className="panel-title text-sm">Recent Runs</h3>
              </div>

              <div className="space-y-2">
                {recentRuns.length === 0 && (
                  <p className="rounded-lg border border-dashed border-white/20 bg-slate-900/30 p-3 text-sm text-slate-400">
                    No runs recorded yet.
                  </p>
                )}

                {recentRuns.map((run) => (
                  <div key={run.id} className="rounded-lg border border-white/10 bg-slate-900/35 p-3 text-xs text-slate-300">
                    <p className="font-mono text-[11px] text-cyan-200">{run.id}</p>
                    <p className="mt-1 uppercase tracking-wide text-slate-400">{run.status}</p>
                    <p className="mt-1 text-slate-400">{new Date(run.startedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-200" />
                <h3 className="panel-title text-sm">Recent Task Failures</h3>
              </div>

              <div className="space-y-2">
                {recentTaskFailures.length === 0 && (
                  <p className="rounded-lg border border-dashed border-white/20 bg-slate-900/30 p-3 text-sm text-slate-400">
                    No failed tasks in this window.
                  </p>
                )}

                {recentTaskFailures.map((task) => (
                  <div key={task.id} className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-100">
                    <p className="font-mono text-[11px]">{task.id}</p>
                    <p className="mt-1">{task.error || 'Unknown error'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                <h3 className="panel-title text-sm">Automation Signals</h3>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border border-white/10 bg-slate-900/35 p-3 text-xs text-slate-300">
                  <p className="uppercase tracking-wide text-slate-400">Schedules</p>
                  <p className="font-mono text-slate-100">{scheduleFeed.length} recent events</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/35 p-3 text-xs text-slate-300">
                  <p className="uppercase tracking-wide text-slate-400">Webhooks</p>
                  <p className="font-mono text-slate-100">{webhookFeed.length} recent deliveries</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="glass-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-200" />
                <h3 className="panel-title text-sm">Scheduler Feed</h3>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {scheduleFeed.length === 0 && (
                  <p className="rounded-lg border border-dashed border-white/20 bg-slate-900/30 p-3 text-sm text-slate-400">
                    Scheduler events will stream here.
                  </p>
                )}
                {scheduleFeed.map((event) => (
                  <div key={`${event.scheduleId}-${event.timestamp.toString()}`} className="rounded-lg border border-white/10 bg-slate-900/35 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-cyan-200">{event.scheduleName}</p>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide',
                        event.status === 'succeeded'
                          ? 'bg-emerald-300/15 text-emerald-100'
                          : 'bg-rose-300/15 text-rose-100'
                      )}>
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-400">{new Date(event.timestamp).toLocaleString()}</p>
                    {event.error && <p className="mt-1 text-rose-200">{event.error}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <BellRing className="h-4 w-4 text-violet-200" />
                <h3 className="panel-title text-sm">Webhook Feed</h3>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {webhookFeed.length === 0 && (
                  <p className="rounded-lg border border-dashed border-white/20 bg-slate-900/30 p-3 text-sm text-slate-400">
                    Webhook deliveries will stream here.
                  </p>
                )}
                {webhookFeed.map((event) => (
                  <div key={`${event.webhookId}-${event.timestamp.toString()}`} className="rounded-lg border border-white/10 bg-slate-900/35 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-violet-200">{event.eventName}</p>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide',
                        event.status === 'delivered'
                          ? 'bg-emerald-300/15 text-emerald-100'
                          : event.status === 'failed'
                            ? 'bg-rose-300/15 text-rose-100'
                            : 'bg-amber-300/15 text-amber-100'
                      )}>
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-400">{new Date(event.timestamp).toLocaleString()}</p>
                    {event.error && <p className="mt-1 text-rose-200">{event.error}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default ObservabilityPanel;
