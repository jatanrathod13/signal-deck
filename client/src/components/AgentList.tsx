/**
 * AgentList Component
 * Displays all agents with status filters
 */
import { useState } from 'react';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import { useSocket } from '../hooks/useSocket';
import type { AgentStatus } from '../types';
import { cn } from '../lib/utils';
import { AgentCard } from './AgentCard';

const statusFilters: { label: string; value: AgentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Idle', value: 'idle' },
  { label: 'Error', value: 'error' },
  { label: 'Stopped', value: 'stopped' },
];

interface AgentListProps {
  className?: string;
}

export function AgentList({ className }: AgentListProps) {
  const { data: agents, isLoading, isError, error, refetch } = useAgents();
  const { isConnected } = useSocket();
  const [localStatusFilter, setLocalStatusFilter] = useState<AgentStatus | 'all'>('all');

  const agentsList = Array.isArray(agents) ? agents : [];
  const filteredAgents = agentsList.filter(
    (agent) => localStatusFilter === 'all' || agent.status === localStatusFilter
  );

  return (
    <section className={cn('space-y-4', className)}>
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-300/30 bg-blue-300/10 p-2">
            <Users className="h-4 w-4 text-blue-200" />
          </div>
          <div>
            <p className="kicker">Runtime Fleet</p>
            <h2 className="panel-title">Agents</h2>
          </div>
          <span className={cn('signal-pill', !isConnected && 'border-slate-400/30 bg-slate-500/10 text-slate-300')}>
            <span className={cn('status-dot', isConnected ? 'live-pulse text-emerald-300' : 'text-slate-500')} />
            {isConnected ? 'Socket Connected' : 'Socket Offline'}
          </span>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className={cn(
            'btn-ghost inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all',
            isLoading && 'cursor-not-allowed opacity-60'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setLocalStatusFilter(filter.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all',
              localStatusFilter === filter.value ? 'btn-primary' : 'btn-ghost'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="glass-panel flex items-center justify-center py-10 text-slate-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-200" />
          Loading agents...
        </div>
      )}

      {isError && (
        <div className="glass-panel rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">
          <p className="font-semibold">Unable to load agents</p>
          <p className="mt-1 text-rose-200/90">{error?.message || 'Unknown error occurred'}</p>
        </div>
      )}

      {!isLoading && !isError && filteredAgents.length === 0 && (
        <div className="glass-panel p-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <p className="font-medium text-slate-200">No agents in this view</p>
          <p className="mt-1 text-sm text-slate-400">
            {localStatusFilter !== 'all' ? `No agents with status "${localStatusFilter}"` : 'Deploy an agent to get started.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && filteredAgents.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </section>
  );
}

export default AgentList;
