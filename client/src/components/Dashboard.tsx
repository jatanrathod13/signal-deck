/**
 * Dashboard Component
 * Main application shell with tabbed panels
 */
import { useEffect, useState } from 'react';
import { Activity, Bot, Database, ListChecks, Users } from 'lucide-react';
import { AgentWorkspace } from './AgentWorkspace';
import { AgentDeploy } from './AgentDeploy';
import { AgentList } from './AgentList';
import { MemoryPanel } from './MemoryPanel';
import { TaskQueue } from './TaskQueue';
import { cn } from '../lib/utils';

type TabType = 'workspace' | 'agents' | 'tasks' | 'memory';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'workspace', label: 'Workspace', icon: Bot },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'memory', label: 'Memory', icon: Database },
];

interface DashboardProps {
  className?: string;
}

export function Dashboard({ className }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('workspace');
  const [clock, setClock] = useState('00:00:00');

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'workspace':
        return <AgentWorkspace className="tab-in" />;
      case 'agents':
        return (
          <div className="space-y-5 tab-in">
            <AgentDeploy />
            <AgentList />
          </div>
        );
      case 'tasks':
        return <TaskQueue className="tab-in" />;
      case 'memory':
        return <MemoryPanel className="tab-in" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn('app-shell', className)}>
      <div className="mesh-bg" />

      <div className="relative z-10">
        <header className="border-b border-white/10 bg-[#0b1020]/75 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10">
                  <Activity className="h-5 w-5 text-cyan-200" />
                </div>
                <div>
                  <p className="kicker">Agent Orchestration Platform</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Signal Deck</h1>
                </div>
              </div>

              <div className="hidden items-center gap-3 md:flex">
                <span className="signal-pill">
                  <span className="status-dot live-pulse" />
                  Live
                </span>
                <div className="glass-panel px-3 py-2">
                  <div className="kicker">Session Time</div>
                  <div className="font-mono text-sm text-cyan-100">{clock}</div>
                </div>
              </div>
            </div>
          </div>

          <nav className="mx-auto hidden max-w-7xl gap-2 px-4 pb-4 sm:flex sm:px-6 lg:px-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'surface-lift inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
                    isActive ? 'btn-primary text-cyan-50' : 'btn-ghost'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">{renderContent()}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#0b1020]/85 px-3 py-2 backdrop-blur-xl sm:hidden">
          <div className="grid grid-cols-4 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'surface-lift inline-flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium',
                    isActive ? 'btn-primary' : 'btn-ghost'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default Dashboard;
