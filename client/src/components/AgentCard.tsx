/**
 * AgentCard Component
 * Individual agent display with status and controls
 */
import { useState } from 'react';
import { PenLine, Play, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useDeleteAgent, useStartAgent, useStopAgent, useUpdateAgent } from '../hooks/useAgents';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(agent.name);
  const [editType, setEditType] = useState(agent.type);
  const [editConfig, setEditConfig] = useState(JSON.stringify(agent.config ?? {}, null, 2));
  const [editError, setEditError] = useState<string | null>(null);

  const startAgent = useStartAgent();
  const stopAgent = useStopAgent();
  const updateAgent = useUpdateAgent();
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

  const beginEdit = () => {
    setEditName(agent.name);
    setEditType(agent.type);
    setEditConfig(JSON.stringify(agent.config ?? {}, null, 2));
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const saveEdit = async () => {
    let parsedConfig: Record<string, unknown>;

    try {
      const parsed = JSON.parse(editConfig);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setEditError('Config must be a JSON object.');
        return;
      }
      parsedConfig = parsed as Record<string, unknown>;
    } catch {
      setEditError('Config JSON is invalid.');
      return;
    }

    if (!editName.trim() || !editType.trim()) {
      setEditError('Name and type are required.');
      return;
    }

    setEditError(null);

    try {
      await updateAgent.mutateAsync({
        id: agent.id,
        data: {
          name: editName.trim(),
          type: editType.trim(),
          config: parsedConfig
        }
      });
      setIsEditing(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update agent');
    }
  };

  const isRunning = agent.status === 'running' || agent.status === 'idle';
  const isStopped = agent.status === 'stopped';
  const isLoading = isStarting || isStopping || isRestarting || isDeleting || updateAgent.isPending;

  return (
    <article className={cn('glass-panel surface-lift p-4 subtle-ring transition-all duration-200', className)}>
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

      <div className="grid grid-cols-5 gap-2 border-t border-white/10 pt-3">
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
          onClick={beginEdit}
          disabled={isLoading}
          className={cn(
            'rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
            isLoading
              ? 'cursor-not-allowed bg-slate-700/30 text-slate-500'
              : 'border border-blue-300/30 bg-blue-300/15 text-blue-100 hover:bg-blue-300/25'
          )}
        >
          <span className="inline-flex items-center gap-1">
            <PenLine className="h-3 w-3" />
            Edit
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

      {isEditing && (
        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-900/45 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="input-field"
              placeholder="Agent name"
            />
            <input
              value={editType}
              onChange={(event) => setEditType(event.target.value)}
              className="input-field"
              placeholder="Agent type"
            />
          </div>
          <textarea
            value={editConfig}
            onChange={(event) => setEditConfig(event.target.value)}
            rows={5}
            className="input-field font-mono text-xs"
          />
          {editError && (
            <p className="text-xs text-rose-200">{editError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold"
              onClick={saveEdit}
              disabled={updateAgent.isPending}
            >
              {updateAgent.isPending ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default AgentCard;
