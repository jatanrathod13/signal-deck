/**
 * TaskItem Component
 * Displays an individual task with controls and telemetry
 */
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  PauseCircle,
  Play,
  RotateCcw,
  Timer,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { useStreamingTask } from '../hooks/useStreamingTask';
import { useCancelTask, useRetryTask } from '../hooks/useTasks';
import { useTaskStore } from '../stores/taskStore';
import type { Task, TaskStatus } from '../types';
import { cn } from '../lib/utils';

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: {
    label: 'Pending',
    color: 'bg-amber-300/12 text-amber-100 border border-amber-300/30',
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    color: 'bg-cyan-300/12 text-cyan-100 border border-cyan-300/30',
    icon: Loader2,
  },
  blocked: {
    label: 'Blocked',
    color: 'bg-orange-300/12 text-orange-100 border border-orange-300/30',
    icon: PauseCircle,
  },
  completed: {
    label: 'Completed',
    color: 'bg-emerald-300/12 text-emerald-100 border border-emerald-300/30',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    color: 'bg-rose-300/12 text-rose-100 border border-rose-300/30',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-slate-500/12 text-slate-300 border border-slate-400/30',
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
  const storeTask = useTaskStore((state) => state.getTask(task.id));
  const storeTaskIsNewer = storeTask
    ? new Date(storeTask.updatedAt).getTime() >= new Date(task.updatedAt).getTime()
    : false;
  const currentTask = storeTaskIsNewer
    ? {
      ...task,
      ...storeTask,
    }
    : {
      ...task,
      liveOutput: storeTask?.liveOutput ?? task.liveOutput,
      liveErrorOutput: storeTask?.liveErrorOutput ?? task.liveErrorOutput,
      lastLogAt: storeTask?.lastLogAt ?? task.lastLogAt,
    };

  useEffect(() => {
    if (
      currentTask.status === 'completed' ||
      currentTask.status === 'failed' ||
      currentTask.status === 'cancelled' ||
      currentTask.status === 'blocked'
    ) {
      const endTime = (currentTask as { completedAt?: string }).completedAt || currentTask.updatedAt;
      if (endTime && currentTask.createdAt) {
        const elapsedMs = new Date(endTime).getTime() - new Date(currentTask.createdAt).getTime();
        const seconds = Math.floor(elapsedMs / 1000);
        const ms = Math.floor((elapsedMs % 1000) / 100);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        setElapsed(`${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${ms}`);
        return;
      }
    }

    if (currentTask.status === 'processing') {
      const interval = setInterval(() => {
        const elapsedMs = Date.now() - new Date(currentTask.createdAt).getTime();
        const seconds = Math.floor(elapsedMs / 1000);
        const ms = Math.floor((elapsedMs % 1000) / 100);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        setElapsed(`${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${ms}`);
      }, 100);
      return () => clearInterval(interval);
    }

    setElapsed('--:--.-');
  }, [currentTask.status, currentTask.updatedAt, currentTask.createdAt]);

  useEffect(() => {
    if (task.status !== 'completed' && currentTask.status === 'completed') {
      setShowCompletionAnimation(true);
      const timer = setTimeout(() => setShowCompletionAnimation(false), 600);
      return () => clearTimeout(timer);
    }
  }, [currentTask.status, task.status]);

  const cancelTaskMutation = useCancelTask();
  const retryTaskMutation = useRetryTask();

  const taskPrompt =
    typeof currentTask.data?.prompt === 'string' ? currentTask.data.prompt : JSON.stringify(currentTask.data);

  const {
    output: streamingOutput,
    isStreaming,
    error: streamingError,
    startStreaming: startStream,
    stopStreaming: stopStream,
    metadata: streamMetadata,
  } = useStreamingTask({
    agentId: currentTask.agentId,
    prompt: taskPrompt,
    autoStart: false,
  });

  const outputRef = useRef<HTMLPreElement>(null);

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
    if (typeof result === 'string') return result.slice(0, 40);

    if (typeof result === 'object' && result !== null) {
      const maybeMessage = (result as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') return maybeMessage.slice(0, 40);
      return JSON.stringify(result).slice(0, 40);
    }

    return String(result).slice(0, 40);
  };

  const getResultDetails = (result: unknown): { message?: string; model?: string; steps?: number } => {
    if (!result || typeof result !== 'object') return {};

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
      steps: typeof typed.metadata?.steps === 'number' ? typed.metadata.steps : undefined,
    };
  };

  const executionLabel = currentTask.executionMode === 'claude_cli' ? 'claude-cli' : 'tool-loop';
  const liveOutput = currentTask.liveOutput || '';
  const liveError = currentTask.liveErrorOutput || '';

  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  return (
    <article
      className={cn(
        'glass-panel surface-lift border p-4 transition-all duration-200',
        showCompletionAnimation && 'ring-2 ring-emerald-300/35',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {isPolePosition && <Trophy className="h-4 w-4 text-amber-200" />}
            {position !== undefined && (
              <span className="rounded-lg border border-white/15 bg-slate-900/70 px-2 py-1 text-[10px] font-semibold text-slate-300">
                #{position}
              </span>
            )}
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', config.color)}>
              <StatusIcon className={cn('h-3 w-3', status === 'processing' && 'animate-spin')} />
              {config.label}
            </span>
          </div>

          <p className="truncate text-sm font-semibold text-slate-100">{currentTask.type || 'Unknown task type'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="font-mono">id: {currentTask.id.slice(0, 8)}...</span>
            <span className="font-mono">priority: {currentTask.priority}</span>
            {currentTask.agentId && <span className="font-mono">agent: {currentTask.agentId.slice(0, 8)}...</span>}
            <span className="font-mono">mode: {executionLabel}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 font-mono text-cyan-200">
              <Timer className="h-3 w-3" />
              {elapsed}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {(status === 'pending' || status === 'processing' || status === 'blocked') && currentTask.agentId && (
            <button
              onClick={handleStream}
              className={cn(
                'rounded-lg border px-2 py-1 text-xs font-semibold transition-all',
                isStreaming
                  ? 'border-cyan-300/35 bg-cyan-300/15 text-cyan-100'
                  : 'btn-ghost border-white/15 text-slate-200'
              )}
              title={isStreaming ? 'Stop streaming' : 'Stream execution'}
            >
              <span className="inline-flex items-center gap-1">
                <Play className={cn('h-3 w-3', isStreaming && 'animate-pulse')} />
                {isStreaming ? 'Streaming' : 'Stream'}
              </span>
            </button>
          )}

          {isCancellable && (
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className={cn(
                'rounded-lg border px-2 py-1 text-xs font-semibold transition-all',
                isLoading
                  ? 'cursor-not-allowed border-slate-500/25 bg-slate-600/15 text-slate-500'
                  : 'border-rose-300/30 bg-rose-300/15 text-rose-100 hover:bg-rose-300/25'
              )}
              title="Cancel task"
            >
              <span className="inline-flex items-center gap-1">
                <X className="h-3 w-3" />
                Cancel
              </span>
            </button>
          )}

          {isRetryable && (
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className={cn(
                'rounded-lg border border-amber-300/30 bg-amber-300/15 px-2 py-1 text-xs font-semibold text-amber-100 transition-all hover:bg-amber-300/25',
                isLoading && 'cursor-not-allowed opacity-60'
              )}
              title="Retry task"
            >
              <span className="inline-flex items-center gap-1">
                <RotateCcw className={cn('h-3 w-3', retryTaskMutation.isPending && 'animate-spin')} />
                Retry
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-slate-500">
        Started: {formatDate(currentTask.createdAt)} | Updated: {formatDate(currentTask.updatedAt)}
      </div>

      {currentTask.status === 'completed' && currentTask.result !== undefined && currentTask.result !== null && (
        <div className="mt-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100">
          {getResultPreview(currentTask.result)}
        </div>
      )}

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-300 transition-colors hover:text-cyan-100"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            Hide details
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            Show details
          </>
        )}
      </button>

      {isExpanded && (
        <div className="tab-in mt-3 space-y-3 border-t border-white/10 pt-3">
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Execution Context</h4>
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-2 text-xs text-slate-300">
              <p>plan: {currentTask.planId ?? 'n/a'}</p>
              <p>step: {currentTask.stepId ?? 'n/a'}</p>
              <p>parent: {currentTask.parentTaskId ?? 'n/a'}</p>
              <p>run: {currentTask.runId ?? 'n/a'}</p>
              <p>mode: {executionLabel}</p>
            </div>
          </div>

          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Task Data</h4>
            <pre className="code-block max-h-64 overflow-auto p-2 text-xs">{String(JSON.stringify(currentTask.data, null, 2))}</pre>
          </div>

          {(status === 'processing' || liveOutput || liveError) && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                Live Execution Logs
                {status === 'processing' && ' (active)'}
              </h4>
              <pre ref={outputRef} className="code-block max-h-64 overflow-auto p-2 text-xs">
                {liveOutput || (status === 'processing' ? 'Waiting for command output...' : '')}
                {status === 'processing' && <span className="animate-pulse">▊</span>}
              </pre>
              {liveError && (
                <pre className="mt-2 code-block max-h-48 overflow-auto border border-rose-300/30 bg-rose-300/10 p-2 text-xs text-rose-100">
                  {liveError}
                </pre>
              )}
              {currentTask.lastLogAt && (
                <div className="mt-1 text-xs text-slate-400">
                  last log: {formatDate(currentTask.lastLogAt)}
                </div>
              )}
            </div>
          )}

          {currentTask.result !== undefined && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">Result</h4>
              {getResultDetails(currentTask.result).message ? (
                <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                  <p>{getResultDetails(currentTask.result).message}</p>
                  {(getResultDetails(currentTask.result).model || getResultDetails(currentTask.result).steps !== undefined) && (
                    <div className="mt-2 text-xs text-emerald-200/90">
                      model: {getResultDetails(currentTask.result).model ?? 'n/a'} | steps:{' '}
                      {getResultDetails(currentTask.result).steps ?? 'n/a'}
                    </div>
                  )}
                </div>
              ) : (
                <pre className="code-block max-h-64 overflow-auto p-2 text-xs text-emerald-100">
                  {String(JSON.stringify(currentTask.result, null, 2))}
                </pre>
              )}

              {typeof currentTask.result === 'object' && currentTask.result !== null && (
                <div className="mt-2">
                  <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Execution Metadata</h5>
                  <pre className="code-block max-h-48 overflow-auto p-2 text-xs text-slate-200">
                    {String(
                      JSON.stringify(
                        (currentTask.result as { metadata?: unknown }).metadata ?? {},
                        null,
                        2
                      )
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}

          {(streamingOutput || isStreaming) && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                Stream Output {isStreaming && '(live)'}
              </h4>
              <pre ref={outputRef} className="code-block max-h-80 overflow-auto p-2 text-xs">
                {streamingOutput || (isStreaming ? 'Waiting for response...' : '')}
                {isStreaming && <span className="animate-pulse">▊</span>}
              </pre>
              {streamMetadata && (
                <div className="mt-1 text-xs text-slate-400">
                  steps: {streamMetadata.steps || 0} | tool calls: {streamMetadata.toolCalls || 0}
                  {streamMetadata.finishReason && ` | finish: ${streamMetadata.finishReason}`}
                </div>
              )}
            </div>
          )}

          {streamingError && (
            <div className="rounded-lg border border-rose-300/25 bg-rose-300/10 p-2 text-xs text-rose-100">
              <div className="inline-flex items-center gap-1 font-semibold">
                <AlertCircle className="h-3 w-3" />
                Stream Error
              </div>
              <div className="mt-1 whitespace-pre-wrap">{streamingError.message}</div>
            </div>
          )}

          {currentTask.error && (currentTask.status === 'failed' || currentTask.status === 'cancelled') && (
            <div className="rounded-lg border border-rose-300/25 bg-rose-300/10 p-2 text-xs text-rose-100">
              <div className="inline-flex items-center gap-1 font-semibold">
                <AlertCircle className="h-3 w-3" />
                Task Error
              </div>
              <div className="mt-1 whitespace-pre-wrap">{currentTask.error}</div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default TaskItem;
