/**
 * AgentCard Component - Scuderia Ferrari Racing Card
 * Individual agent display with LED status, fuel gauge, and racing controls
 */
import { useState } from 'react';
import { Play, Square, RotateCcw, Trash2 } from 'lucide-react';
import type { Agent, AgentStatus } from '../types';
import { useStartAgent, useStopAgent, useDeleteAgent } from '../hooks/useAgents';
import { cn } from '../lib/utils';

// LED status indicator colors
const statusLedColors: Record<AgentStatus, string> = {
  registered: 'text-blue-400',
  starting: 'text-yellow-400',
  running: 'text-green-400',
  idle: 'text-gray-400',
  error: 'text-red-500',
  stopped: 'text-gray-600',
};

// Status badge styling
const statusColors: Record<AgentStatus, string> = {
  registered: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  starting: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
  running: 'bg-green-900/40 text-green-300 border border-green-700/50',
  idle: 'bg-gray-800/40 text-gray-400 border border-gray-600/50',
  error: 'bg-red-900/40 text-red-300 border border-red-700/50',
  stopped: 'bg-gray-800/40 text-gray-500 border border-gray-700/50',
};

// Status text mapping with racing terms
const statusLabels: Record<AgentStatus, string> = {
  registered: 'On Grid',
  starting: 'Warming Up',
  running: 'Full Throttle',
  idle: 'Pit Lane',
  error: 'DNF',
  stopped: 'Retired',
};

// Simulated fuel level based on status
const statusFuel: Record<AgentStatus, number> = {
  registered: 100,
  starting: 85,
  running: 60,
  idle: 40,
  error: 10,
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
  const [showGreenLight, setShowGreenLight] = useState(false);

  const startAgent = useStartAgent();
  const stopAgent = useStopAgent();
  const deleteAgent = useDeleteAgent();

  const handleStart = async () => {
    setIsStarting(true);
    setShowGreenLight(true);
    try {
      await startAgent.mutateAsync(agent.id);
    } catch (error) {
      console.error('Failed to start agent:', error);
    } finally {
      setIsStarting(false);
      setTimeout(() => setShowGreenLight(false), 1000);
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
    if (!window.confirm('Are you sure you want to retire this driver?')) {
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
  const fuelLevel = statusFuel[agent.status];

  return (
    <div
      className={cn(
        'bg-[#1e1e1e] rounded-lg p-4 carbon-overlay',
        'border border-[#2a2a2a]',
        'hover:border-[#ff2800]/50 transition-all duration-300',
        'ferrari-hover-glow',
        'card-reveal',
        'green-light-sequence',
        showGreenLight && 'active',
        'speed-lines',
        className
      )}
    >
      {/* Top accent line */}
      <div className="h-0.5 bg-gradient-to-r from-[#ff2800] via-[#ffcc00] to-[#ff2800] rounded-full mb-3 opacity-60" />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* LED Status Indicator */}
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                statusLedColors[agent.status],
                (agent.status === 'running' || agent.status === 'starting') && 'led-pulse'
              )}
              style={{ backgroundColor: 'currentColor' }}
            />
            <h3 className="text-lg font-semibold text-white truncate">
              {agent.name}
            </h3>
          </div>
          <p className="text-sm text-gray-500 truncate mt-0.5">
            {agent.type}
          </p>
        </div>

        {/* Status Badge */}
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            statusColors[agent.status]
          )}
        >
          {statusLabels[agent.status]}
        </span>
      </div>

      {/* Fuel Gauge */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Fuel Level</span>
          <span className="text-[10px] font-mono text-gray-500">{fuelLevel}%</span>
        </div>
        <div className="h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden">
          <div
            className="h-full fuel-gauge rounded-full transition-all duration-500"
            style={{ width: `${fuelLevel}%` }}
          />
        </div>
      </div>

      {/* Agent Details */}
      <div className="mb-4">
        <p className="text-xs text-gray-500">
          ID: <span className="font-mono text-gray-400">{agent.id}</span>
        </p>
        {agent.config && Object.keys(agent.config).length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Config: {JSON.stringify(agent.config).slice(0, 50)}
            {JSON.stringify(agent.config).length > 50 && '...'}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Light Green (Start) */}
        <button
          onClick={handleStart}
          disabled={isRunning || isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold',
            'transition-colors duration-200',
            'btn-ferrari',
            isRunning || isLoading
              ? 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed'
              : 'bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-700/40 glow-green'
          )}
        >
          {isStarting ? (
            <div className="tachometer-spinner w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Light Green
        </button>

        {/* Box This Car (Stop) */}
        <button
          onClick={handleStop}
          disabled={isStopped || isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold',
            'transition-colors duration-200',
            'btn-ferrari',
            isStopped || isLoading
              ? 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed'
              : 'bg-red-900/30 text-[#ff2800] hover:bg-red-900/50 border border-red-700/40 glow-red'
          )}
        >
          {isStopping ? (
            <div className="tachometer-spinner w-3.5 h-3.5" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          Box
        </button>

        {/* Pit Stop (Restart) */}
        <button
          onClick={handleRestart}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold',
            'transition-colors duration-200',
            'btn-ferrari',
            isLoading
              ? 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed'
              : 'bg-[#ffcc00]/10 text-[#ffcc00] hover:bg-[#ffcc00]/20 border border-[#ffcc00]/30 glow-yellow'
          )}
        >
          {isRestarting ? (
            <div className="tachometer-spinner w-3.5 h-3.5" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          Pit Stop
        </button>

        {/* Retire (Delete) */}
        <button
          onClick={handleDelete}
          disabled={isLoading || !isStopped}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold',
            'transition-colors duration-200',
            isLoading || !isStopped
              ? 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed'
              : 'bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-800/40'
          )}
        >
          {isDeleting ? (
            <div className="tachometer-spinner w-3.5 h-3.5" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Retire
        </button>
      </div>
    </div>
  );
}

export default AgentCard;
