/**
 * Dashboard Component - Scuderia Ferrari PIT WALL
 * Main dashboard layout with racing-themed navigation
 */
import { useEffect, useState } from 'react';
import { Users, ListChecks, Database, LayoutDashboard } from 'lucide-react';
import { AgentList } from './AgentList';
import { AgentDeploy } from './AgentDeploy';
import { TaskQueue } from './TaskQueue';
import { MemoryPanel } from './MemoryPanel';
import { cn } from '../lib/utils';

// Navigation tabs configuration
type TabType = 'agents' | 'tasks' | 'memory';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'agents', label: 'PIT CREW', icon: Users },
  { id: 'tasks', label: 'RACE QUEUE', icon: ListChecks },
  { id: 'memory', label: 'TELEMETRY', icon: Database },
];

interface DashboardProps {
  className?: string;
}

export function Dashboard({ className }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('agents');

  // Race timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const elements = document.getElementById('race-timer') || document.getElementById('session-timer');
      if (elements) elements.textContent = time;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Render the content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'agents':
        return (
          <div className="space-y-6 tab-slide-in">
            <AgentDeploy />
            <AgentList />
          </div>
        );
      case 'tasks':
        return <TaskQueue className="tab-slide-in" />;
      case 'memory':
        return <MemoryPanel />;
      default:
        return null;
    }
  };

  return (
    <div className={cn('min-h-screen carbon-fiber relative', className)}>
      {/* Particles Effect */}
      <div className="particles-container">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="particle" />
        ))}
      </div>

      {/* Vignette Overlay */}
      <div className="vignette-overlay" />

      {/* Header - Race Control Timing Tower */}
      <header className="bg-[#0d0d0d] border-b-2 border-[#ff2800] shadow-lg shadow-[#ff2800]/20 relative overflow-hidden">
        {/* Timing tower diagonal accent */}
        <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-[#ff2800]/20 to-transparent skew-x-12" />

        {/* Corner flags decoration */}
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#ffcc00]" />
          <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#ffcc00]/50" />
        </div>

        <div className="racing-stripe" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-between h-20">
            {/* Logo and Title - Race Control Style */}
            <div className="flex items-center gap-4">
              {/* Timing Tower Icon */}
              <div className="relative">
                <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-gradient-to-br from-[#ff2800] to-[#cc2000] shadow-lg shadow-[#ff2800]/30">
                  <LayoutDashboard className="w-7 h-7 text-white" />
                </div>
                {/* Racing line accent */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#ffcc00] rounded-full" />
              </div>

              <div className="race-start">
                <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                  PIT WALL
                  <span className="ml-3 text-xs font-semibold text-[#ffcc00] tracking-[0.3em] uppercase">Scuderia</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 font-mono">RACE CONTROL</span>
                  <span className="text-[#ff2800]">●</span>
                  <span className="text-xs text-gray-600 font-mono" id="race-timer">00:00:00</span>
                </div>
              </div>
            </div>

            {/* Race Timer Display */}
            <div className="hidden md:flex items-center gap-4">
              <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider text-center">Session Time</div>
                <div className="text-xl font-mono text-[#ffcc00] font-bold tracking-wider" id="session-timer">00:00:00</div>
              </div>

              {/* Live indicator */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#ff2800]/10 border border-[#ff2800]/30 rounded-lg">
                <div className="w-2 h-2 bg-[#ff2800] rounded-full led-pulse" style={{ color: '#ff2800' }} />
                <span className="text-xs font-semibold text-[#ff2800] uppercase tracking-wider">Live</span>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center gap-2 sm:hidden">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'p-2 rounded-lg transition-all duration-200',
                      activeTab === tab.id
                        ? 'bg-[#ff2800] text-white shadow-lg shadow-[#ff2800]/30'
                        : 'text-gray-400 hover:bg-[#1e1e1e]'
                    )}
                    title={tab.label}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs - Race Control Panel */}
      <nav className="hidden sm:block bg-[#0d0d0d] border-b border-[#2a2a2a] relative">
        {/* Timing line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#ff2800] via-[#ffcc00] to-[#ff2800] opacity-50" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative flex items-center gap-2 px-5 py-4 text-sm font-bold uppercase tracking-wider transition-all duration-300',
                    isActive
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Tab indicator bar */}
                  <div className={cn(
                    'absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300',
                    isActive ? 'bg-[#ff2800]' : 'bg-transparent'
                  )} />

                  {/* Active glow */}
                  {isActive && (
                    <div className="absolute inset-0 bg-[#ff2800]/5 blur-xl" />
                  )}

                  <Icon className={cn('w-4 h-4 relative z-10', isActive ? 'text-[#ff2800]' : 'text-gray-600')} />
                  <span className="relative z-10">{tab.label}</span>

                  {/* Corner flag on active */}
                  {isActive && (
                    <div className="absolute top-2 right-2 w-2 h-2">
                      <div className="w-1 h-1 bg-[#ffcc00]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Tab Bar - Pit Panel */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#0d0d0d] border-t-2 border-[#2a2a2a] z-10">
        {/* Top racing stripe */}
        <div className="h-0.5 bg-gradient-to-r from-[#ff2800] via-[#ffcc00] to-[#ff2800]" />

        <div className="flex justify-around py-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all duration-200 min-w-[64px] relative',
                  isActive
                    ? 'text-[#ff2800]'
                    : 'text-gray-500'
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-[#ff2800]/10 rounded-lg blur-md" />
                )}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="text-[10px] font-bold uppercase tracking-wider relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 sm:pb-8">
        {renderContent()}
      </main>
    </div>
  );
}

export default Dashboard;
