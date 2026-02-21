/**
 * AgentList Component - Scuderia Ferrari Pit Crew
 * Displays a list of all agents with racing-themed status filters
 */
import { useState } from 'react';
import { Users, RefreshCw, Loader2 } from 'lucide-react';
import type { AgentStatus } from '../types';
import { useAgents } from '../hooks/useAgents';
import { useSocket } from '../hooks/useSocket';
import { AgentCard } from './AgentCard';
import { cn } from '../lib/utils';

// Status filter options
const statusFilters: { label: string; value: AgentStatus | 'all' }[] = [
  { label: 'All Drivers', value: 'all' },
  { label: 'Racing', value: 'running' },
  { label: 'Pit Lane', value: 'idle' },
  { label: 'DNF', value: 'error' },
  { label: 'Retired', value: 'stopped' },
];

interface AgentListProps {
  className?: string;
}

export function AgentList({ className }: AgentListProps) {
  const { data: agents, isLoading, isError, error, refetch } = useAgents();

  // Initialize socket connection for real-time updates
  const { isConnected } = useSocket();

  // Filter state
  const [localStatusFilter, setLocalStatusFilter] = useState<AgentStatus | 'all'>('all');

  // Ensure agents is always an array
  const agentsList = Array.isArray(agents) ? agents : [];

  // Filter agents based on status
  const filteredAgents = agentsList.filter(
    (agent) => localStatusFilter === 'all' || agent.status === localStatusFilter
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#ff2800]" />
          <h2 className="text-xl font-semibold text-white tracking-wide">Pit Crew</h2>

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
            {isConnected ? 'Radio Live' : 'Radio Off'}
          </span>
        </div>

        {/* Refresh Button */}
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

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setLocalStatusFilter(filter.value)}
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200',
              'border',
              localStatusFilter === filter.value
                ? 'bg-[#ff2800] text-white border-[#ff2800]'
                : 'bg-[#1e1e1e] text-gray-400 border-[#2a2a2a] hover:border-[#ff2800]/40 hover:text-gray-300'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#ff2800] animate-spin" />
          <span className="ml-2 text-gray-500">Loading pit crew...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4">
          <p className="text-red-400 font-medium">Radio failure - cannot load pit crew</p>
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
      {!isLoading && !isError && filteredAgents.length === 0 && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg p-8 text-center">
          <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No drivers on the grid</p>
          <p className="text-gray-600 text-sm mt-1">
            {localStatusFilter !== 'all'
              ? `No drivers with status "${localStatusFilter}"`
              : 'Deploy a new driver to join the race'}
          </p>
        </div>
      )}

      {/* Agent Grid */}
      {!isLoading && !isError && filteredAgents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentList;
