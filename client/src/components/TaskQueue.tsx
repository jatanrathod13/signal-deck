/**
 * TaskQueue Component
 * Displays tasks with filtering and submission controls
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle,
  Clock,
  ListChecks,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
  Timer,
  XCircle,
} from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import { useSocket } from '../hooks/useSocket';
import { useSubmitTask, useTasks } from '../hooks/useTasks';
import type { TaskStatus } from '../types';
import { cn } from '../lib/utils';
import { TaskItem } from './TaskItem';

const statusGroups: { label: string; value: TaskStatus | 'all'; icon: React.ElementType; color: string }[] = [
  { label: 'All', value: 'all', icon: ListChecks, color: 'text-slate-300' },
  { label: 'Pending', value: 'pending', icon: Clock, color: 'text-amber-200' },
  { label: 'Blocked', value: 'blocked', icon: Ban, color: 'text-orange-200' },
  { label: 'Processing', value: 'processing', icon: PlayCircle, color: 'text-cyan-200' },
  { label: 'Completed', value: 'completed', icon: CheckCircle, color: 'text-emerald-200' },
  { label: 'Failed', value: 'failed', icon: XCircle, color: 'text-rose-200' },
  { label: 'Cancelled', value: 'cancelled', icon: Ban, color: 'text-slate-400' },
];

interface TaskQueueProps {
  className?: string;
}

export function TaskQueue({ className }: TaskQueueProps) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [taskType, setTaskType] = useState('');
  const [taskData, setTaskData] = useState('{}');
  const [priority, setPriority] = useState(1);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState('00:00.00');

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const ms = Math.floor((elapsed % 1000) / 10);
      setSessionTime(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms
          .toString()
          .padStart(2, '0')}`
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const { data: tasks, isLoading, isError, error, refetch } = useTasks(
    statusFilter === 'all' ? undefined : statusFilter
  );
  const { data: agents } = useAgents();
  const submitTask = useSubmitTask();
  const { isConnected } = useSocket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);

    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(taskData);
    } catch {
      setJsonError('Invalid JSON in task data');
      return;
    }

    try {
      await submitTask.mutateAsync({
        agentId,
        type: taskType,
        data: parsedData,
        priority,
      });

      setShowSubmitForm(false);
      setAgentId('');
      setTaskType('');
      setTaskData('{}');
      setPriority(1);
    } catch {
      // Handled by mutation
    }
  };

  const handleCancel = () => {
    setShowSubmitForm(false);
    setAgentId('');
    setTaskType('');
    setTaskData('{}');
    setPriority(1);
    setJsonError(null);
  };

  const tasksList = Array.isArray(tasks) ? tasks : [];

  const groupedTasks = useMemo(() => {
    if (tasksList.length === 0) return null;

    const groups: Record<TaskStatus, typeof tasksList> = {
      pending: [],
      blocked: [],
      processing: [],
      completed: [],
      failed: [],
      cancelled: [],
    };

    tasksList.forEach((task) => {
      if (groups[task.status]) groups[task.status].push(task);
    });

    return groups;
  }, [tasksList]);

  const statusCounts = useMemo(() => {
    if (!groupedTasks) {
      return { pending: 0, blocked: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
    }

    return {
      pending: groupedTasks.pending.length,
      blocked: groupedTasks.blocked.length,
      processing: groupedTasks.processing.length,
      completed: groupedTasks.completed.length,
      failed: groupedTasks.failed.length,
      cancelled: groupedTasks.cancelled.length,
    };
  }, [groupedTasks]);

  const totalCount = tasksList.length;

  return (
    <section className={cn('space-y-4', className)}>
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-indigo-300/30 bg-indigo-300/10 p-2">
            <ListChecks className="h-4 w-4 text-indigo-200" />
          </div>
          <div>
            <p className="kicker">Execution Queue</p>
            <h2 className="panel-title">Tasks</h2>
          </div>
          <span className="rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1 font-mono text-xs text-cyan-200">
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {sessionTime}
            </span>
          </span>
          <span className={cn('signal-pill', !isConnected && 'border-slate-400/30 bg-slate-500/10 text-slate-300')}>
            <span className={cn('status-dot', isConnected ? 'text-emerald-300 live-pulse' : 'text-slate-500')} />
            {isConnected ? 'Live updates' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className={cn('btn-ghost rounded-xl px-3 py-2 text-sm font-medium', isLoading && 'opacity-60')}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Refresh
            </span>
          </button>
          <button
            onClick={() => setShowSubmitForm(true)}
            className="btn-primary rounded-xl px-3 py-2 text-sm font-semibold"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Task
            </span>
          </button>
        </div>
      </header>

      {showSubmitForm && (
        <div className="glass-panel p-4">
          <h3 className="panel-title mb-3 text-sm">Submit Task</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="agentId" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Agent
                </label>
                <select
                  id="agentId"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  required
                  className="input-field"
                >
                  <option value="">Select an agent</option>
                  {agents?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="taskType" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Task Type
                </label>
                <input
                  id="taskType"
                  type="text"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  placeholder="e.g. summarize-report"
                  required
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="priority" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Priority
                </label>
                <input
                  id="priority"
                  type="number"
                  min={1}
                  max={10}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="taskData" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Data JSON
                </label>
                <textarea
                  id="taskData"
                  value={taskData}
                  onChange={(e) => setTaskData(e.target.value)}
                  rows={4}
                  className={cn('input-field font-mono', jsonError && 'border-rose-400/60 text-rose-100')}
                />
                {jsonError && <p className="mt-1 text-xs text-rose-300">{jsonError}</p>}
              </div>
            </div>

            {submitTask.error && (
              <div className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">
                {submitTask.error.message || 'Failed to submit task'}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitTask.isPending}
                className={cn('btn-primary rounded-xl px-4 py-2 text-sm font-semibold', submitTask.isPending && 'opacity-60')}
              >
                {submitTask.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Submit Task'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitTask.isPending}
                className="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {statusGroups.map((group) => {
          const Icon = group.icon;
          const count = group.value === 'all' ? totalCount : statusCounts[group.value as TaskStatus];

          return (
            <button
              key={group.value}
              onClick={() => setStatusFilter(group.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all',
                statusFilter === group.value ? 'btn-primary' : 'btn-ghost'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', group.color)} />
              {group.label}
              <span className="rounded-full border border-white/15 bg-slate-900/70 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="glass-panel flex items-center justify-center py-10 text-slate-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-200" />
          Loading tasks...
        </div>
      )}

      {isError && (
        <div className="glass-panel rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">
          <p className="font-semibold">Unable to load tasks</p>
          <p className="mt-1 text-rose-200/90">{error?.message || 'Unknown error occurred'}</p>
        </div>
      )}

      {!isLoading && !isError && totalCount === 0 && (
        <div className="glass-panel p-8 text-center">
          <ListChecks className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <p className="font-medium text-slate-200">No tasks available</p>
          <p className="mt-1 text-sm text-slate-400">Submit a task to start execution.</p>
        </div>
      )}

      {!isLoading && !isError && totalCount > 0 && (
        <div className="space-y-4">
          {statusFilter === 'all' ? (
            <>
              {groupedTasks && groupedTasks.processing.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-200">
                    Processing ({groupedTasks.processing.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.processing.map((task, index) => (
                      <TaskItem key={task.id} task={task} position={index + 1} isPolePosition={index === 0} />
                    ))}
                  </div>
                </div>
              )}

              {groupedTasks && groupedTasks.pending.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                    Pending ({groupedTasks.pending.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.pending.map((task, index) => (
                      <TaskItem key={task.id} task={task} position={index + 1} />
                    ))}
                  </div>
                </div>
              )}

              {groupedTasks && groupedTasks.blocked.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-orange-200">
                    Blocked ({groupedTasks.blocked.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.blocked.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedTasks && groupedTasks.completed.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                    Completed ({groupedTasks.completed.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.completed.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedTasks && groupedTasks.failed.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-200">
                    Failed ({groupedTasks.failed.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.failed.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {groupedTasks && groupedTasks.cancelled.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Cancelled ({groupedTasks.cancelled.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.cancelled.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {tasksList.map((task, index) => (
                <TaskItem key={task.id} task={task} position={index + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default TaskQueue;
