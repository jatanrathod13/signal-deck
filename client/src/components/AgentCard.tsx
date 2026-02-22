/**
 * AgentCard Component
 * Individual agent display with status and controls
 */
import { useState } from 'react';
import { Play, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useDeleteAgent, useStartAgent, useStopAgent } from '../hooks/useAgents';
import type { Agent, AgentStatus } from '../types';
import { cn } from '../lib/utils';

const statusLabels: Record<AgentStatus, string> = {
  registered: 'Registered',
  starting: 'Starting',
  running: 'Running',
  idle: 'Idle',
  error: 'Error',
  stopped: 'Stopped',
};

const statusClass: Record<AgentStatus, string> = {
  registered: 'text-sky-200 bg-sky-300/15 border-sky-300/30',
  starting: 'text-amber-200 bg-amber-300/15 border-amber-300/30',
  running: 'text-emerald-200 bg-emerald-300/15 border-emerald-300/30',
  idle: 'text-slate-200 bg-slate-300/15 border-slate-300/30',
  error: 'text-rose-200 bg-rose-300/15 border-rose-300/30',
  stopped: 'text-slate-400 bg-slate-500/10 border-slate-400/20',
};

const statusDotClass: Record<AgentStatus, string> = {
  registered: 'text-sky-300',
  starting: 'text-amber-300',
  running: 'text-emerald-300',
  idle: 'text-slate-300',
  error: 'text-rose-300',
  stopped: 'text-slate-500',
};

const loadIndex: Record<AgentStatus, number> = {
  registered: 20,
  starting: 48,
  running: 90,
  idle: 42,
  error: 8,
  stopped: 0,
};

interface AgentCardProps {
  agent: Agent;
  className?: string;
}

export function AgentCard({ agent, className }: AgentCardProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const startAgent = useStartAgent();
  const stopAgent = useStopAgent();
  const deleteAgent = useDeleteAgent();

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await startAgent.mutateAsync(agent.id);
    } catch (error) {
      console.error('Failed to start agent:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await stopAgent.mutateAsync(agent.id);
    } catch (error) {
      console.error('Failed to stop agent:', error);
    } finally {
      setIsStopping(false);
    }
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await stopAgent.mutateAsync(agent.id);
      await startAgent.mutateAsync(agent.id);
    } catch (error) {
      console.error('Failed to restart agent:', error);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this agent?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAgent.mutateAsync(agent.id);
    } catch (error) {
      console.error('Failed to delete agent:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const isRunning = agent.status === 'running' || agent.status === 'idle';
  const isStopped = agent.status === 'stopped';
  const isLoading = isStarting || isStopping || isRestarting || isDeleting;

  return (
    <article className={cn('glass-panel p-4 subtle-ring transition-all duration-200 hover:-translate-y-0.5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('status-dot', statusDotClass[agent.status], agent.status === 'running' && 'live-pulse')} />
            <h3 className="truncate text-base font-semibold text-slate-100">{agent.name}</h3>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{agent.type}</p>
        </div>

        <span className={cn('rounded-full border px-2 py-1 text-xs font-medium', statusClass[agent.status])}>
          {statusLabels[agent.status]}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
          <span>Load Index</span>
          <span className="font-mono text-cyan-200">{loadIndex[agent.status]}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-950">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300 transition-all duration-500"
            style={{ width: `${loadIndex[agent.status]}%` }}
          />
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-400/15 bg-slate-950/40 p-2 font-mono text-xs text-slate-300">
        <p className="truncate">id: {agent.id}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-white/10 pt-3">
        <button
          onClick={handleStart}
          disabled={isRunning || isLoading}
          className={cn(
            'rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
            isRunning || isLoading ? 'cursor-not-allowed bg-slate-700/30 text-slate-500' : 'btn-primary'
          )}
        >
          <span className="inline-flex items-center gap-1">
            {isStarting ? <RotateCcw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Start
          </span>
        </button>

        <button
          onClick={handleStop}
          disabled={isStopped || isLoading}
          className={cn(
            'rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
            isStopped || isLoading
              ? 'cursor-not-allowed bg-slate-700/30 text-slate-500'
              : 'border border-rose-300/30 bg-rose-300/15 text-rose-100 hover:bg-rose-300/25'
          )}
        >
          <span className="inline-flex items-center gap-1">
            {isStopping ? <RotateCcw className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
            Stop
          </span>
        </button>

        <button
          onClick={handleRestart}
          disabled={isLoading}
          className={cn(
            'rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
            isLoading
              ? 'cursor-not-allowed bg-slate-700/30 text-slate-500'
              : 'border border-amber-300/30 bg-amber-300/15 text-amber-100 hover:bg-amber-300/25'
          )}
        >
          <span className="inline-flex items-center gap-1">
            <RotateCcw className={cn('h-3 w-3', isRestarting && 'animate-spin')} />
            Restart
          </span>
        </button>

        <button
          onClick={handleDelete}
          disabled={isLoading}
          className={cn(
            'rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
            isLoading
              ? 'cursor-not-allowed bg-slate-700/30 text-slate-500'
              : 'border border-slate-300/25 bg-slate-300/10 text-slate-200 hover:border-rose-300/30 hover:text-rose-100'
          )}
        >
          <span className="inline-flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            Delete
          </span>
        </button>
      </div>
    </article>
  );
}

export default AgentCard;
