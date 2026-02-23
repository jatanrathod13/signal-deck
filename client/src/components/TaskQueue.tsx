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
  Search,
  Timer,
  XCircle,
} from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import { useSocket } from '../hooks/useSocket';
import { useSubmitTask, useTasks } from '../hooks/useTasks';
import { useTaskStore } from '../stores/taskStore';
import type { TaskExecutionMode, TaskStatus } from '../types';
import { cn } from '../lib/utils';
import { TaskItem } from './TaskItem';

const statusGroups: { label: string; value: TaskStatus | 'all'; icon: React.ElementType; color: string }[] = [
  { label: 'All', value: 'all', icon: ListChecks, color: 'text-[#d8c1a9]' },
  { label: 'Pending', value: 'pending', icon: Clock, color: 'text-[#efc274]' },
  { label: 'Blocked', value: 'blocked', icon: Ban, color: 'text-[#e6a565]' },
  { label: 'Processing', value: 'processing', icon: PlayCircle, color: 'text-[#96f0d8]' },
  { label: 'Completed', value: 'completed', icon: CheckCircle, color: 'text-[#9fe6b1]' },
  { label: 'Failed', value: 'failed', icon: XCircle, color: 'text-[#f0a39d]' },
  { label: 'Cancelled', value: 'cancelled', icon: Ban, color: 'text-[#c0ad98]' },
];
const MAX_VISIBLE_PER_GROUP = 20;

interface TaskQueueProps {
  className?: string;
}

export function TaskQueue({ className }: TaskQueueProps) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('processing');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [agentId, setAgentId] = useState('');
  const [taskType, setTaskType] = useState('');
  const [executionMode, setExecutionMode] = useState<TaskExecutionMode>('tool_loop');
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

  const { data: tasks, isLoading, isError, error, refetch } = useTasks();
  const setTasks = useTaskStore((state) => state.setTasks);
  const { data: agents } = useAgents();
  const submitTask = useSubmitTask();
  const { isConnected } = useSocket();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setJsonError(null);

    const formData = new FormData(e.currentTarget);
    const finalAgentId = (formData.get('agentId') as string) || agentId;
    const finalTaskType = (formData.get('taskType') as string) || taskType;
    const finalExecutionMode = (formData.get('executionMode') as TaskExecutionMode) || executionMode;
    const finalTaskData = (formData.get('taskData') as string) || taskData;
    const finalPriority = parseInt(formData.get('priority') as string, 10) || priority;

    if (!finalAgentId || !finalTaskType) {
      setJsonError('Agent and Task Type are required');
      return;
    }

    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(finalTaskData);
    } catch {
      setJsonError('Invalid JSON in task data');
      return;
    }

    try {
      await submitTask.mutateAsync({
        agentId: finalAgentId,
        type: finalTaskType,
        data: parsedData,
        executionMode: finalExecutionMode,
        priority: finalPriority,
      });

      setShowSubmitForm(false);
      setAgentId('');
      setTaskType('');
      setExecutionMode('tool_loop');
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
    setExecutionMode('tool_loop');
    setTaskData('{}');
    setPriority(1);
    setJsonError(null);
  };

  const loadClaudeTaskPreset = () => {
    const preferredAgent = agentId || agents?.[0]?.id || '';
    setAgentId(preferredAgent);
    setTaskType('claude-cli-task');
    setExecutionMode('claude_cli');
    setTaskData(
      JSON.stringify(
        {
          prompt: 'Analyze the codebase and implement the requested task with tests.',
          claude: {
            args: [],
            timeoutMs: 900000
          }
        },
        null,
        2
      )
    );
  };

  const loadParallelTeamPreset = () => {
    const availableAgentIds = (agents ?? []).map((agent) => agent.id);
    const coordinatorAgentId = agentId || availableAgentIds[0] || '';

    setAgentId(coordinatorAgentId);
    setTaskType('orchestrate-team');
    setExecutionMode('claude_cli');
    setTaskData(
      JSON.stringify(
        {
          objective: 'Research, plan, implement, and verify the requested feature.',
          teamAgentIds: availableAgentIds.length > 0 ? availableAgentIds : [coordinatorAgentId].filter(Boolean),
          executionStrategy: 'parallel',
          maxSteps: Math.max(3, availableAgentIds.length || 1),
          stepPrompts: [
            'Investigate requirements and constraints, then summarize implementation plan.',
            'Implement the solution and update related code paths.',
            'Run validations/tests, fix issues, and provide final summary.'
          ]
        },
        null,
        2
      )
    );
  };

  const tasksList = useMemo(
    () => (Array.isArray(tasks) ? [...tasks] : []).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [tasks]
  );

  useEffect(() => {
    if (!Array.isArray(tasks)) {
      return;
    }

    setTasks(tasks);
  }, [setTasks, tasks]);

  const filteredTasks = useMemo(() => {
    const byStatus = statusFilter === 'all'
      ? tasksList
      : tasksList.filter((task) => task.status === statusFilter);

    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      return byStatus;
    }

    return byStatus.filter((task) => {
      const searchable = [
        task.id,
        task.type,
        task.agentId,
        task.status,
        task.planId,
        task.stepId,
        task.executionMode,
        typeof task.data?.prompt === 'string' ? task.data.prompt : ''
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(trimmed);
    });
  }, [searchQuery, statusFilter, tasksList]);

  const groupedTasks = useMemo(() => {
    if (filteredTasks.length === 0) return null;

    const groups: Record<TaskStatus, typeof filteredTasks> = {
      pending: [],
      blocked: [],
      processing: [],
      completed: [],
      failed: [],
      cancelled: [],
    };

    filteredTasks.forEach((task) => {
      if (groups[task.status]) groups[task.status].push(task);
    });

    return groups;
  }, [filteredTasks]);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, blocked: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
    tasksList.forEach((task) => {
      counts[task.status] += 1;
    });
    return counts;
  }, [tasksList]);

  const totalCount = tasksList.length;
  const visibleCount = filteredTasks.length;
  const processingCount = statusCounts.processing;
  const failingCount = statusCounts.failed;

  const toggleGroupExpansion = (group: TaskStatus) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [group]: !previous[group]
    }));
  };

  const getVisibleGroupTasks = (group: TaskStatus) => {
    if (!groupedTasks) {
      return [];
    }

    const tasksForGroup = groupedTasks[group];
    if (expandedGroups[group] || statusFilter !== 'all') {
      return tasksForGroup;
    }

    return tasksForGroup.slice(0, MAX_VISIBLE_PER_GROUP);
  };

  return (
    <section className={cn('space-y-4', className)}>
      <header className="panel-elevated flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[rgba(213,164,106,0.34)] bg-[rgba(213,164,106,0.16)] p-2">
            <ListChecks className="h-4 w-4 text-[#f4dcc1]" />
          </div>
          <div>
            <p className="kicker">Execution Operations</p>
            <h2 className="panel-title text-[1.2rem]">Tasks</h2>
          </div>
          <span className="status-pill warn font-mono">
            <Timer className="h-3 w-3" />
            {sessionTime}
          </span>
          <span className={cn('status-pill', !isConnected && 'muted')}>
            <span className={cn('status-dot', isConnected ? 'text-[#9ef0d8] live-pulse' : 'text-[#8f7e6b]')} />
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
            className="command-button rounded-xl px-3 py-2 text-sm font-semibold"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Task
            </span>
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="data-card p-3">
          <p className="kicker mb-1">Queue Depth</p>
          <p className="font-mono text-xl font-semibold text-[#f1dbc2]">{totalCount}</p>
          <p className="text-xs text-[#b99f84]">All tasks in workspace queue</p>
        </div>
        <div className="data-card p-3">
          <p className="kicker mb-1">Active Processing</p>
          <p className="font-mono text-xl font-semibold text-[#a9f1dc]">{processingCount}</p>
          <p className="text-xs text-[#b99f84]">Running now across agents</p>
        </div>
        <div className="data-card p-3">
          <p className="kicker mb-1">Failure Pressure</p>
          <p className="font-mono text-xl font-semibold text-[#efac9f]">{failingCount}</p>
          <p className="text-xs text-[#b99f84]">Failed tasks requiring attention</p>
        </div>
      </div>

      <div className="panel-elevated p-3">
        <label htmlFor="task-search" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c7af94]">
          Search Tasks
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#8d7a67]" />
          <input
            id="task-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by id, type, agent, plan, mode, prompt..."
            className="input-field pl-9"
          />
        </div>
      </div>

      {showSubmitForm && (
        <div className="panel-elevated p-4">
          <h3 className="panel-title mb-3 text-sm">Submit Task</h3>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadClaudeTaskPreset}
              className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Claude Preset
            </button>
            <button
              type="button"
              onClick={loadParallelTeamPreset}
              className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Parallel Team Preset
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="agentId" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c7af94]">
                  Agent
                </label>
                <select
                  id="agentId"
                  name="agentId"
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
                <label htmlFor="taskType" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c7af94]">
                  Task Type
                </label>
                <input
                  id="taskType"
                  name="taskType"
                  type="text"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  placeholder="e.g. summarize-report"
                  required
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="executionMode" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c7af94]">
                  Execution Mode
                </label>
                <select
                  id="executionMode"
                  name="executionMode"
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value as TaskExecutionMode)}
                  className="input-field"
                >
                  <option value="tool_loop">Tool Loop (AI SDK)</option>
                  <option value="claude_cli">Claude CLI (local)</option>
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c7af94]">
                  Priority
                </label>
                <input
                  id="priority"
                  name="priority"
                  type="number"
                  min={1}
                  max={10}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="taskData" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#c7af94]">
                  Data JSON
                </label>
                <textarea
                  id="taskData"
                  name="taskData"
                  value={taskData}
                  onChange={(e) => setTaskData(e.target.value)}
                  rows={4}
                  className={cn('input-field font-mono', jsonError && 'border-[rgba(241,131,122,0.6)] text-[#f6c3bd]')}
                />
                {jsonError && <p className="mt-1 text-xs text-[#f3a79f]">{jsonError}</p>}
              </div>
            </div>

            {submitTask.error && (
              <div className="rounded-xl border border-[rgba(241,131,122,0.42)] bg-[rgba(241,131,122,0.14)] p-3 text-sm text-[#f7cabf]">
                {submitTask.error.message || 'Failed to submit task'}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitTask.isPending}
                className={cn('command-button rounded-xl px-4 py-2 text-sm font-semibold', submitTask.isPending && 'opacity-60')}
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
                statusFilter === group.value
                  ? 'command-button'
                  : 'btn-ghost'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', group.color)} />
              {group.label}
              <span className="rounded-full border border-[rgba(226,204,180,0.24)] bg-[rgba(19,16,13,0.7)] px-2 py-0.5 font-mono text-[10px] text-[#cfb79c]">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="panel-elevated flex items-center justify-center py-10 text-[#d8c0a7]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#efd2ab]" />
          Loading tasks...
        </div>
      )}

      {isError && (
        <div className="panel-elevated rounded-xl border border-[rgba(241,131,122,0.42)] bg-[rgba(241,131,122,0.12)] p-4 text-sm text-[#f7c8be]">
          <p className="font-semibold">Unable to load tasks</p>
          <p className="mt-1 text-[#f7c8be]">{error?.message || 'Unknown error occurred'}</p>
        </div>
      )}

      {!isLoading && !isError && visibleCount === 0 && (
        <div className="panel-elevated p-8 text-center">
          <ListChecks className="mx-auto mb-3 h-10 w-10 text-[#8e7b67]" />
          <p className="font-medium text-[#ebdccb]">
            {searchQuery ? 'No matching tasks' : statusFilter === 'all' ? 'No tasks available' : `No ${statusFilter} tasks`}
          </p>
          <p className="mt-1 text-sm text-[#b89f84]">
            {searchQuery ? 'Try a different search query.' : totalCount === 0 ? 'Submit a task to start execution.' : 'Try another status filter.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && visibleCount > 0 && (
        <div className="space-y-4">
          {statusFilter === 'all' ? (
            <>
              {(['processing', 'pending', 'blocked', 'failed', 'completed', 'cancelled'] as TaskStatus[]).map((group) => {
                if (!groupedTasks || groupedTasks[group].length === 0) {
                  return null;
                }

                const visibleTasks = getVisibleGroupTasks(group);
                const hiddenCount = groupedTasks[group].length - visibleTasks.length;
                const titleColor = group === 'processing'
                  ? 'text-[#a9f1dc]'
                  : group === 'pending'
                    ? 'text-[#efc274]'
                    : group === 'blocked'
                      ? 'text-[#e6a565]'
                      : group === 'failed'
                        ? 'text-[#efac9f]'
                        : group === 'completed'
                          ? 'text-[#9fe6b1]'
                          : 'text-[#c0ad98]';

                return (
                  <div key={group} className="space-y-2">
                    <h3 className={cn('text-xs font-semibold uppercase tracking-wider', titleColor)}>
                      {group} ({groupedTasks[group].length})
                    </h3>
                    <div className="stagger-list space-y-2">
                      {visibleTasks.map((task, index) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          position={index + 1}
                          isPolePosition={group === 'processing' && index === 0}
                        />
                      ))}
                    </div>
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleGroupExpansion(group)}
                        className="btn-ghost rounded-lg px-3 py-1 text-xs font-semibold"
                      >
                        {expandedGroups[group] ? 'Show less' : `Show ${hiddenCount} more`}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="stagger-list space-y-2">
              {filteredTasks.map((task, index) => (
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
