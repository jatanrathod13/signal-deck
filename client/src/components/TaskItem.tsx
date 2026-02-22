/**
 * TaskItem Component - Scuderia Ferrari Race Entry
 * Displays an individual task as a race entry with grid position and racing styling
 */
import { useState, useEffect, useRef } from 'react';
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
  Timer,
  Trophy,
  Play,
  PauseCircle,
} from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { useCancelTask, useRetryTask } from '../hooks/useTasks';
import { useStreamingTask } from '../hooks/useStreamingTask';
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
  blocked: {
    label: 'Boxed In',
    color: 'bg-amber-900/20 text-amber-300 border border-amber-700/40',
    icon: PauseCircle,
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
  const [elapsed, setElapsed] = useState('00:00.0');

  // Live lap time tracking
  useEffect(() => {
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled' || task.status === 'blocked') {
      // Use updatedAt as fallback if completedAt doesn't exist
      const endTime = (task as { completedAt?: string }).completedAt || task.updatedAt;
      if (endTime && task.createdAt) {
        const elapsedMs = new Date(endTime).getTime() - new Date(task.createdAt).getTime();
        const seconds = Math.floor(elapsedMs / 1000);
        const ms = Math.floor((elapsedMs % 1000) / 100);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        setElapsed(`${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${ms}`);
        return;
      }
    }

    if (task.status === 'processing') {
      const interval = setInterval(() => {
        const elapsedMs = Date.now() - new Date(task.createdAt).getTime();
        const seconds = Math.floor(elapsedMs / 1000);
        const ms = Math.floor((elapsedMs % 1000) / 100);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        setElapsed(`${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${ms}`);
      }, 100);
      return () => clearInterval(interval);
    }

    setElapsed('--:--.-');
  }, [task.status, task.updatedAt, task.createdAt]);

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

  // Streaming hook - extract prompt from task data
  const taskPrompt = typeof currentTask.data?.prompt === 'string'
    ? currentTask.data.prompt
    : JSON.stringify(currentTask.data);

  const {
    output: streamingOutput,
    isStreaming,
    error: streamingError,
    startStreaming: startStream,
    stopStreaming: stopStream,
    metadata: streamMetadata
  } = useStreamingTask({
    agentId: currentTask.agentId,
    prompt: taskPrompt,
    autoStart: false
  });

  // Ref for auto-scrolling streaming output
  const outputRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (outputRef.current && (streamingOutput || isStreaming)) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamingOutput, isStreaming]);

  const status = currentTask.status;
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const handleCancel = () => {
    cancelTaskMutation.mutate(currentTask.id);
  };

  const handleRetry = () => {
    retryTaskMutation.mutate(currentTask.id);
  };

  const handleStream = () => {
    if (isStreaming) {
      stopStream();
    } else {
      startStream();
    }
  };

  const isCancellable = status === 'pending' || status === 'blocked';
  const isRetryable = status === 'failed';
  const isLoading = cancelTaskMutation.isPending || retryTaskMutation.isPending;

  const getResultPreview = (result: unknown): string => {
    if (typeof result === 'string') {
      return result.slice(0, 40);
    }

    if (typeof result === 'object' && result !== null) {
      const maybeMessage = (result as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') {
        return maybeMessage.slice(0, 40);
      }

      return JSON.stringify(result).slice(0, 40);
    }

    return String(result).slice(0, 40);
  };

  const getResultDetails = (result: unknown): { message?: string; model?: string; steps?: number } => {
    if (!result || typeof result !== 'object') {
      return {};
    }

    const typed = result as {
      message?: unknown;
      metadata?: {
        model?: unknown;
        steps?: unknown;
      };
    };

    return {
      message: typeof typed.message === 'string' ? typed.message : undefined,
      model: typeof typed.metadata?.model === 'string' ? typed.metadata.model : undefined,
      steps: typeof typed.metadata?.steps === 'number' ? typed.metadata.steps : undefined
    };
  };

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
          ? 'border-[#ffcc00]/50 shadow-lg shadow-[#ffcc00]/10 pole-position-glow'
          : 'border-[#2a2a2a]',
        'card-reveal',
        'checkered-pulse',
        showCompletionAnimation && 'completed',
        'speed-lines',
        position === 1 && 'first-lap-highlight',
        className
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Pole Position Trophy */}
          {isPolePosition && (
            <Trophy className="w-5 h-5 text-[#ffcc00] flex-shrink-0" />
          )}

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
          {/* Stream Button - for pending or processing tasks */}
          {(status === 'pending' || status === 'processing' || status === 'blocked') && currentTask.agentId && (
            <button
              onClick={handleStream}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                isStreaming
                  ? 'bg-[#ff2800]/20 text-[#ff2800] border border-[#ff2800]/40'
                  : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#ff2800]/10 hover:text-[#ff2800]',
                'border border-[#2a2a2a] hover:border-[#ff2800]/30',
                'transition-colors duration-200'
              )}
              title={isStreaming ? 'Stop streaming' : 'Stream execution'}
            >
              <Play className={cn('w-3 h-3', isStreaming && 'animate-pulse')} />
              {isStreaming ? 'Streaming' : 'Stream'}
            </button>
          )}

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

        {/* Result Preview for completed tasks - always visible */}
        {currentTask.status === 'completed' && currentTask.result !== undefined && currentTask.result !== null && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-green-400 bg-green-900/20 max-w-[200px] truncate">
            {getResultPreview(currentTask.result)}
          </span>
        )}

        {/* Lap Time Display */}
        <span className={cn(
          'inline-flex items-center gap-1 ml-auto px-2 py-0.5 rounded font-mono',
          task.status === 'processing'
            ? 'bg-[#ff2800]/10 text-[#ff2800]'
            : task.status === 'completed'
              ? 'bg-green-900/20 text-green-400'
              : task.status === 'failed'
                ? 'bg-red-900/20 text-red-400'
                : 'bg-[#0a0a0a] text-gray-500'
        )}>
          <Timer className="w-3 h-3" />
          {elapsed}
        </span>
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

          {/* Result (if completed) - show message prominently */}
          {currentTask.result !== undefined && (
            <div>
              <h4 className="text-xs font-medium text-green-400 mb-1">Result</h4>
              {getResultDetails(currentTask.result).message ? (
                <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                  <p className="text-green-300 text-sm font-medium">
                    {getResultDetails(currentTask.result).message}
                  </p>
                  {(getResultDetails(currentTask.result).model || getResultDetails(currentTask.result).steps !== undefined) && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-green-500/70">
                      <span>Model: {getResultDetails(currentTask.result).model ?? 'n/a'}</span>
                      <span>Steps: {getResultDetails(currentTask.result).steps ?? 'n/a'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="bg-green-900/10 text-green-400 text-xs p-2 rounded border border-green-800/30 overflow-x-auto">
                  {String(JSON.stringify(currentTask.result, null, 2))}
                </pre>
              )}
            </div>
          )}

          {/* Streaming Output (when streaming) */}
          {(streamingOutput || isStreaming) && (
            <div>
              <h4 className="text-xs font-medium text-[#ffcc00] mb-1 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                    isStreaming ? 'bg-[#ffcc00]' : 'bg-green-400')}></span>
                  <span className={cn('relative inline-flex rounded-full h-2 w-2',
                    isStreaming ? 'bg-[#ffcc00]' : 'bg-green-400')}></span>
                </span>
                Live Stream {isStreaming && '(processing...)'}
              </h4>
              <pre
                ref={outputRef}
                className="bg-[#0a0a0a] text-gray-300 text-xs p-2 rounded border border-[#ffcc00]/30 overflow-x-auto max-h-96 scroll-smooth"
              >
                {streamingOutput || (isStreaming ? 'Waiting for response...' : '')}
                {isStreaming && <span className="animate-pulse">▊</span>}
              </pre>
              {streamMetadata && (
                <div className="mt-1 text-xs text-gray-500">
                  Steps: {streamMetadata.steps || 0} | Tool Calls: {streamMetadata.toolCalls || 0}
                  {streamMetadata.finishReason && ` | Finish: ${streamMetadata.finishReason}`}
                </div>
              )}
            </div>
          )}

          {/* Streaming Error */}
          {streamingError && (
            <div>
              <h4 className="text-xs font-medium text-red-400 mb-1">Stream Error</h4>
              <div className="bg-red-900/10 text-red-400 text-xs p-2 rounded border border-red-800/30 flex items-start gap-2">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span className="whitespace-pre-wrap">{streamingError.message}</span>
              </div>
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
