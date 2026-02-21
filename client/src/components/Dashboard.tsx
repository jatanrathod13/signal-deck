/**
 * Dashboard Component - Scuderia Ferrari PIT WALL
 * Main dashboard layout with racing-themed navigation
 */
import { useState } from 'react';
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

      {/* Header */}
      <header className="bg-[#141414] border-b border-[#2a2a2a] shadow-lg shadow-black/30 sticky top-0 z-10">
        <div className="racing-stripe" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#ff2800] shadow-lg shadow-[#ff2800]/20">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">
                  PIT WALL
                  <span className="ml-2 text-xs font-normal text-[#ffcc00] tracking-widest">SCUDERIA</span>
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">Deploy, monitor, and coordinate racing agents</p>
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
                      'p-2 rounded-lg transition-colors duration-200',
                      activeTab === tab.id
                        ? 'bg-[#ff2800] text-white'
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

      {/* Navigation Tabs - Desktop */}
      <nav className="hidden sm:block bg-[#141414] border-b border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors duration-200 tracking-wider',
                    isActive
                      ? 'border-[#ff2800] text-[#ff2800]'
                      : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-[#ff2800]' : 'text-gray-600')} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Tab Bar - Bottom */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#141414] border-t border-[#2a2a2a] z-10">
        <div className="flex justify-around py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors duration-200 min-w-[64px]',
                  isActive
                    ? 'text-[#ff2800]'
                    : 'text-gray-500'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold tracking-wider">{tab.label}</span>
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
