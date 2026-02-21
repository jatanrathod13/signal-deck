/**
 * TaskQueue Component - Scuderia Ferrari Race Queue
 * Displays tasks as a race starting grid with racing terminology
 */
import { useState, useMemo } from 'react';
import { ListChecks, RefreshCw, Loader2, Clock, PlayCircle, CheckCircle, XCircle, Ban, Plus } from 'lucide-react';
import type { TaskStatus } from '../types';
import { useTasks, useSubmitTask } from '../hooks/useTasks';
import { useAgents } from '../hooks/useAgents';
import { useSocket } from '../hooks/useSocket';
import { TaskItem } from './TaskItem';
import { cn } from '../lib/utils';

// Status group configuration with racing terms
const statusGroups: { label: string; value: TaskStatus | 'all'; icon: React.ElementType; color: string }[] = [
  { label: 'All Laps', value: 'all', icon: ListChecks, color: 'text-gray-400' },
  { label: 'On Grid', value: 'pending', icon: Clock, color: 'text-[#ffcc00]' },
  { label: 'Racing', value: 'processing', icon: PlayCircle, color: 'text-[#ff2800]' },
  { label: 'Chequered', value: 'completed', icon: CheckCircle, color: 'text-green-400' },
  { label: 'DNF', value: 'failed', icon: XCircle, color: 'text-red-400' },
  { label: 'Black Flag', value: 'cancelled', icon: Ban, color: 'text-gray-500' },
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

  // Fetch tasks with optional status filter
  const { data: tasks, isLoading, isError, error, refetch } = useTasks(
    statusFilter === 'all' ? undefined : statusFilter
  );

  // Fetch agents for dropdown
  const { data: agents } = useAgents();

  // Submit task mutation
  const submitTask = useSubmitTask();

  // Initialize socket connection for real-time updates
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
      // Error is handled by the mutation
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

  // Ensure tasks is always an array
  const tasksList = Array.isArray(tasks) ? tasks : [];

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    if (tasksList.length === 0) return null;

    const groups: Record<TaskStatus, typeof tasksList> = {
      pending: [],
      processing: [],
      completed: [],
      failed: [],
      cancelled: [],
    };

    tasksList.forEach((task) => {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    });

    return groups;
  }, [tasksList]);

  // Get counts for each status
  const statusCounts = useMemo(() => {
    if (!groupedTasks) return { pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };

    return {
      pending: groupedTasks.pending.length,
      processing: groupedTasks.processing.length,
      completed: groupedTasks.completed.length,
      failed: groupedTasks.failed.length,
      cancelled: groupedTasks.cancelled.length,
    };
  }, [groupedTasks]);

  // Get total count
  const totalCount = tasksList.length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-[#ff2800]" />
          <h2 className="text-xl font-semibold text-white tracking-wide">Race Queue</h2>

          {/* Connection Status */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
              isConnected
                ? 'bg-green-900/30 text-green-400 border border-green-700/40'
                : 'bg-gray-800 text-gray-500 border border-gray-700'
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isConnected ? 'bg-green-400 led-pulse' : 'bg-gray-600'
              )}
              style={isConnected ? { color: '#4ade80' } : undefined}
            />
            {isConnected ? 'Live Timing' : 'Offline'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSubmitForm(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
              'bg-[#ff2800] text-white hover:bg-[#cc2000]',
              'transition-colors duration-200'
            )}
          >
            <Plus className="w-4 h-4" />
            New Lap
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
              'bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-[#2a2a2a]',
              'border border-[#2a2a2a] hover:border-[#ff2800]/30',
              'transition-colors duration-200',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Submit Task Form */}
      {showSubmitForm && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-medium text-[#ffcc00] uppercase tracking-wider">Deploy New Task</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Agent Dropdown */}
              <div className="space-y-1">
                <label htmlFor="agentId" className="text-sm font-medium text-gray-400">
                  Assign Driver
                </label>
                <select
                  id="agentId"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  required
                  className={cn(
                    'w-full px-3 py-2 rounded-md border text-sm',
                    'border-[#2a2a2a] bg-[#0a0a0a] text-gray-300',
                    'focus:border-[#ff2800] focus:outline-none focus:ring-1 focus:ring-[#ff2800]'
                  )}
                >
                  <option value="">Select a driver</option>
                  {agents?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Type */}
              <div className="space-y-1">
                <label htmlFor="taskType" className="text-sm font-medium text-gray-400">
                  Task Type
                </label>
                <input
                  id="taskType"
                  type="text"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  placeholder="e.g., process-data"
                  required
                  className={cn(
                    'w-full px-3 py-2 rounded-md border text-sm',
                    'border-[#2a2a2a] bg-[#0a0a0a] text-gray-300',
                    'focus:border-[#ff2800] focus:outline-none focus:ring-1 focus:ring-[#ff2800]'
                  )}
                />
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label htmlFor="priority" className="text-sm font-medium text-gray-400">
                  Grid Position
                </label>
                <input
                  id="priority"
                  type="number"
                  min={1}
                  max={10}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                  className={cn(
                    'w-full px-3 py-2 rounded-md border text-sm',
                    'border-[#2a2a2a] bg-[#0a0a0a] text-gray-300',
                    'focus:border-[#ff2800] focus:outline-none focus:ring-1 focus:ring-[#ff2800]'
                  )}
                />
              </div>

              {/* Task Data */}
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="taskData" className="text-sm font-medium text-gray-400">
                  Task Data (JSON)
                </label>
                <textarea
                  id="taskData"
                  value={taskData}
                  onChange={(e) => setTaskData(e.target.value)}
                  rows={4}
                  placeholder='{"key": "value"}'
                  className={cn(
                    'w-full px-3 py-2 rounded-md border text-sm font-mono',
                    'border-[#2a2a2a] bg-[#0a0a0a] text-gray-300',
                    'focus:border-[#ff2800] focus:outline-none focus:ring-1 focus:ring-[#ff2800]',
                    jsonError && 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  )}
                />
                {jsonError && (
                  <p className="text-red-400 text-xs">{jsonError}</p>
                )}
              </div>
            </div>

            {/* Submit Error */}
            {submitTask.error && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-md p-3">
                <p className="text-red-400 text-sm">
                  {submitTask.error.message || 'Failed to deploy task'}
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitTask.isPending}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium',
                  'bg-[#ff2800] text-white hover:bg-[#cc2000]',
                  'transition-colors duration-200',
                  submitTask.isPending && 'opacity-50 cursor-not-allowed'
                )}
              >
                {submitTask.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deploying...
                  </span>
                ) : (
                  'Deploy'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitTask.isPending}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium',
                  'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-300',
                  'border border-[#2a2a2a]',
                  'transition-colors duration-200'
                )}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {statusGroups.map((group) => {
          const Icon = group.icon;
          const count = group.value === 'all'
            ? totalCount
            : statusCounts[group.value as TaskStatus];

          return (
            <button
              key={group.value}
              onClick={() => setStatusFilter(group.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                'transition-colors duration-200 border',
                statusFilter === group.value
                  ? 'bg-[#ff2800] text-white border-[#ff2800]'
                  : 'bg-[#1e1e1e] text-gray-400 border-[#2a2a2a] hover:border-[#ff2800]/40 hover:text-gray-300'
              )}
            >
              <Icon className={cn('w-4 h-4', statusFilter === group.value ? 'text-white' : group.color)} />
              {group.label}
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.5 rounded-full text-xs',
                  statusFilter === group.value
                    ? 'bg-[#cc2000] text-white'
                    : 'bg-[#0a0a0a] text-gray-500'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#ff2800] animate-spin" />
          <span className="ml-2 text-gray-500">Loading race data...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4">
          <p className="text-red-400 font-medium">Timing system failure</p>
          <p className="text-red-500/80 text-sm mt-1">
            {error?.message || 'Unknown error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-[#ff2800] hover:text-[#ffcc00] font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && totalCount === 0 && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg p-8 text-center">
          <ListChecks className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No tasks on the grid</p>
          <p className="text-gray-600 text-sm mt-1">
            {statusFilter !== 'all'
              ? `No tasks with status "${statusFilter}"`
              : 'Deploy a new task to start the race'}
          </p>
        </div>
      )}

      {/* Task List - Starting Grid View */}
      {!isLoading && !isError && totalCount > 0 && (
        <div className="space-y-4">
          {statusFilter === 'all' ? (
            <>
              {/* Pole Position - Processing (actively racing) */}
              {groupedTasks && groupedTasks.processing.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#ff2800] flex items-center gap-2 uppercase tracking-wider">
                    <PlayCircle className="w-4 h-4" />
                    Racing ({groupedTasks.processing.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.processing.map((task, index) => (
                      <TaskItem key={task.id} task={task} position={index + 1} isPolePosition={index === 0} />
                    ))}
                  </div>
                </div>
              )}

              {/* On Grid - Pending */}
              {groupedTasks && groupedTasks.pending.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#ffcc00] flex items-center gap-2 uppercase tracking-wider">
                    <Clock className="w-4 h-4" />
                    On Grid ({groupedTasks.pending.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.pending.map((task, index) => (
                      <TaskItem key={task.id} task={task} position={index + 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Chequered Flag - Completed */}
              {groupedTasks && groupedTasks.completed.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2 uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4" />
                    Chequered Flag ({groupedTasks.completed.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.completed.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {/* DNF - Failed */}
              {groupedTasks && groupedTasks.failed.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 uppercase tracking-wider">
                    <XCircle className="w-4 h-4" />
                    DNF ({groupedTasks.failed.length})
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.failed.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {/* Black Flag - Cancelled */}
              {groupedTasks && groupedTasks.cancelled.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-500 flex items-center gap-2 uppercase tracking-wider">
                    <Ban className="w-4 h-4" />
                    Black Flag ({groupedTasks.cancelled.length})
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
            /* When filtered by status, show flat list */
            <div className="space-y-2">
              {tasksList.map((task, index) => (
                <TaskItem key={task.id} task={task} position={index + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskQueue;
