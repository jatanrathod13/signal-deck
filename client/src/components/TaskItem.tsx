/**
 * TaskItem Component - Scuderia Ferrari Race Entry
 * Displays an individual task as a race entry with grid position and racing styling
 */
import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Ban,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { useCancelTask, useRetryTask } from '../hooks/useTasks';
import { useTaskStore } from '../stores/taskStore';
import { cn } from '../lib/utils';

// Status configuration with racing theme
const statusConfig: Record<TaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: {
    label: 'On Grid',
    color: 'bg-[#ffcc00]/20 text-[#ffcc00] border border-[#ffcc00]/30',
    icon: Clock,
  },
  processing: {
    label: 'Racing',
    color: 'bg-[#ff2800]/20 text-[#ff2800] border border-[#ff2800]/30',
    icon: Loader2,
  },
  completed: {
    label: 'Chequered',
    color: 'bg-green-900/30 text-green-400 border border-green-700/40',
    icon: CheckCircle,
  },
  failed: {
    label: 'DNF',
    color: 'bg-red-900/30 text-red-400 border border-red-700/40',
    icon: XCircle,
  },
  cancelled: {
    label: 'Black Flag',
    color: 'bg-gray-800/50 text-gray-500 border border-gray-700/40',
    icon: Ban,
  },
};

interface TaskItemProps {
  task: Task;
  className?: string;
  position?: number;
  isPolePosition?: boolean;
}

export function TaskItem({ task, className, position, isPolePosition }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);

  // Get task from store for real-time updates
  const storeTask = useTaskStore((state) => state.getTask(task.id));
  const currentTask = storeTask || task;

  // Track completion for checkered flag animation
  useEffect(() => {
    if (task.status !== 'completed' && currentTask.status === 'completed') {
      setShowCompletionAnimation(true);
      const timer = setTimeout(() => setShowCompletionAnimation(false), 600);
      return () => clearTimeout(timer);
    }
  }, [currentTask.status]);

  // Mutations
  const cancelTaskMutation = useCancelTask();
  const retryTaskMutation = useRetryTask();

  const status = currentTask.status;
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const handleCancel = () => {
    cancelTaskMutation.mutate(currentTask.id);
  };

  const handleRetry = () => {
    retryTaskMutation.mutate(currentTask.id);
  };

  const isCancellable = status === 'pending';
  const isRetryable = status === 'failed';
  const isLoading = cancelTaskMutation.isPending || retryTaskMutation.isPending;

  // Format date helper
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  return (
    <div
      className={cn(
        'bg-[#1e1e1e] border rounded-lg p-4 transition-all duration-200 carbon-overlay',
        'hover:border-[#ff2800]/40',
        isPolePosition
          ? 'border-[#ffcc00]/50 shadow-lg shadow-[#ffcc00]/5'
          : 'border-[#2a2a2a]',
        'card-reveal',
        'checkered-pulse',
        showCompletionAnimation && 'completed',
        'speed-lines',
        className
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Grid Position */}
          {position !== undefined && (
            <span
              className={cn(
                'flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-bold',
                isPolePosition
                  ? 'bg-[#ffcc00] text-black'
                  : 'bg-[#0a0a0a] text-gray-400 border border-[#2a2a2a]'
              )}
            >
              P{position}
            </span>
          )}

          {/* Status Badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              config.color
            )}
          >
            <StatusIcon className={cn('w-3 h-3', status === 'processing' && 'animate-spin')} />
            {config.label}
          </span>

          {/* Task Type */}
          <span className="text-sm font-medium text-gray-300 truncate">
            {currentTask.type || 'Unknown Type'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Cancel Button - only for pending tasks */}
          {isCancellable && (
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                'bg-[#1a1a1a] text-gray-400 hover:bg-red-900/30 hover:text-red-400',
                'border border-[#2a2a2a] hover:border-red-700/40',
                'transition-colors duration-200',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
              title="Black flag this task"
            >
              <X className="w-3 h-3" />
              Flag
            </button>
          )}

          {/* Retry Button - only for failed tasks */}
          {isRetryable && (
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                'bg-[#ff2800]/10 text-[#ff2800] hover:bg-[#ff2800]/20',
                'border border-[#ff2800]/30',
                'transition-colors duration-200',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
              title="Re-enter the race"
            >
              <RotateCcw className={cn('w-3 h-3', retryTaskMutation.isPending && 'animate-spin')} />
              Re-enter
            </button>
          )}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span>ID: {currentTask.id.slice(0, 8)}...</span>
        <span>Grid: P{currentTask.priority}</span>
        {currentTask.agentId && <span>Driver: {currentTask.agentId.slice(0, 8)}...</span>}
      </div>

      {/* Timestamps */}
      <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
        <span>Started: {formatDate(currentTask.createdAt)}</span>
        <span>Updated: {formatDate(currentTask.updatedAt)}</span>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'mt-2 inline-flex items-center gap-1 text-xs font-medium',
          'text-gray-500 hover:text-[#ffcc00] transition-colors duration-200'
        )}
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3 h-3" />
            Hide telemetry
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            Show telemetry
          </>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-3 tab-slide-in">
          {/* Task Data */}
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-1">Task Data</h4>
            <pre className="bg-[#0a0a0a] text-gray-400 text-xs p-2 rounded border border-[#2a2a2a] overflow-x-auto">
              {String(JSON.stringify(currentTask.data, null, 2))}
            </pre>
          </div>

          {/* Result (if completed) */}
          {currentTask.result !== undefined && (
            <div>
              <h4 className="text-xs font-medium text-green-400 mb-1">Result</h4>
              <pre className="bg-green-900/10 text-green-400 text-xs p-2 rounded border border-green-800/30 overflow-x-auto">
                {String(JSON.stringify(currentTask.result, null, 2))}
              </pre>
            </div>
          )}

          {/* Error (if failed) */}
          {currentTask.error && (
            <div>
              <h4 className="text-xs font-medium text-red-400 mb-1">Incident Report</h4>
              <div className="bg-red-900/10 text-red-400 text-xs p-2 rounded border border-red-800/30 flex items-start gap-2">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span className="whitespace-pre-wrap">{currentTask.error}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskItem;
