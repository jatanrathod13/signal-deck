/**
 * Dashboard Component
 * Main application shell with tabbed panels
 */
import { useEffect, useMemo, useState } from 'react';
import { BellRing, Bot, CalendarClock, Database, Eye, ListChecks, Users } from 'lucide-react';
import { AgentWorkspace } from './AgentWorkspace';
import { AgentDeploy } from './AgentDeploy';
import { AgentList } from './AgentList';
import { MemoryPanel } from './MemoryPanel';
import { ObservabilityPanel } from './ObservabilityPanel';
import { ScheduleManager } from './ScheduleManager';
import { TaskQueue } from './TaskQueue';
import { WebhookManager } from './WebhookManager';
import { cn } from '../lib/utils';

type TabType = 'workspace' | 'agents' | 'tasks' | 'observability' | 'schedules' | 'webhooks' | 'memory';

interface TabConfig {
  id: TabType;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  note: string;
}

const tabs: TabConfig[] = [
  { id: 'workspace', label: 'Workspace', shortLabel: 'Work', icon: Bot, note: 'Objective intake + orchestration' },
  { id: 'agents', label: 'Agents', shortLabel: 'Agents', icon: Users, note: 'Deploy and manage agent fleet' },
  { id: 'tasks', label: 'Tasks', shortLabel: 'Tasks', icon: ListChecks, note: 'Queue, stream, and control execution' },
  { id: 'observability', label: 'Observability', shortLabel: 'Observe', icon: Eye, note: 'Live telemetry and run health' },
  { id: 'schedules', label: 'Schedules', shortLabel: 'Sched', icon: CalendarClock, note: 'Automated recurring triggers' },
  { id: 'webhooks', label: 'Webhooks', shortLabel: 'Hooks', icon: BellRing, note: 'Inbound automation endpoints' },
  { id: 'memory', label: 'Memory', shortLabel: 'Memory', icon: Database, note: 'Shared context and facts' },
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

  const activeTabMeta = useMemo(() => tabs.find((tab) => tab.id === activeTab) ?? tabs[0], [activeTab]);

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
      case 'observability':
        return <ObservabilityPanel className="tab-in" />;
      case 'schedules':
        return <ScheduleManager className="tab-in" />;
      case 'webhooks':
        return <WebhookManager className="tab-in" />;
      case 'memory':
        return <MemoryPanel className="tab-in" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn('app-shell', className)}>
      <div className="editorial-bg" />

      <div className="relative z-10 shell-grid">
        <aside className="shell-rail">
          <div className="mb-5">
            <p className="kicker">Agent Orchestration Platform</p>
            <h1 className="page-title">Signal Deck</h1>
          </div>

          <div className="mb-5 data-card p-3">
            <p className="kicker mb-2">Runtime Status</p>
            <div className="flex items-center justify-between">
              <span className="signal-pill">
                <span className="status-dot live-pulse" />
                Live
              </span>
              <span className="font-mono text-sm text-[#f0ddc7]">{clock}</span>
            </div>
          </div>

          <nav className="space-y-1.5" aria-label="Dashboard sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn('rail-nav-button', isActive && 'active')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 px-3 pb-24 pt-4 sm:px-5 lg:px-8 lg:pb-8 lg:pt-6 page-in">
          <header className="top-command mb-5">
            <div>
              <p className="kicker">Current Surface</p>
              <h2 className="panel-title text-[1.35rem]">{activeTabMeta.label}</h2>
              <p className="mt-1 text-sm text-[#bfa890]">{activeTabMeta.note}</p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <span className="status-pill">
                <span className="status-dot live-pulse" />
                Realtime
              </span>
              <span className="status-pill warn">Governed</span>
              <button className="command-button px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                Control Plane Active
              </button>
            </div>
          </header>

          <main>{renderContent()}</main>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[rgba(226,204,180,0.24)] bg-[rgba(16,13,10,0.95)] px-2.5 py-2 backdrop-blur-md sm:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'surface-lift inline-flex min-w-[84px] flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold',
                    isActive
                      ? 'border-[rgba(213,164,106,0.62)] bg-[rgba(213,164,106,0.19)] text-[#fff2df]'
                      : 'border-[rgba(226,204,180,0.2)] bg-[rgba(28,23,19,0.75)] text-[#c5af96]'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.shortLabel}
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
