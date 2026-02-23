/**
 * AgentWorkspace
 * Chat-first workspace for orchestrator + specialist runs.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BrainCircuit,
  Loader2,
  Plus,
  Send,
  Sparkles,
  TerminalSquare,
  User
} from 'lucide-react';
import {
  useConversation,
  useConversationEvents,
  useConversations,
  useCreateConversation,
  useSubmitConversationMessage
} from '../hooks/useConversations';
import { useSocket } from '../hooks/useSocket';
import { useAgents } from '../hooks/useAgents';
import { useConversationStore } from '../stores/conversationStore';
import { cn } from '../lib/utils';

interface AgentWorkspaceProps {
  className?: string;
}

export function AgentWorkspace({ className }: AgentWorkspaceProps) {
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const { isConnected } = useSocket();
  const { data: agents } = useAgents();

  const { data: conversations, isLoading: isLoadingConversations } = useConversations();
  const { data: conversationDetail } = useConversation(activeConversationId);

  const runEventsByConversation = useConversationStore((state) => state.runEventsByConversation);
  const runsById = useConversationStore((state) => state.runs);
  const eventCursor = useMemo(() => {
    const events = runEventsByConversation[activeConversationId] ?? [];
    const lastEvent = events[events.length - 1];
    return lastEvent?.timestamp ? new Date(lastEvent.timestamp).toISOString() : undefined;
  }, [activeConversationId, runEventsByConversation]);

  const { data: conversationEvents } = useConversationEvents(activeConversationId, eventCursor);

  const createConversationMutation = useCreateConversation();
  const submitMessageMutation = useSubmitConversationMessage();

  const setConversations = useConversationStore((state) => state.setConversations);
  const setMessages = useConversationStore((state) => state.setMessages);
  const setRunEvents = useConversationStore((state) => state.setRunEvents);
  const appendRunEvent = useConversationStore((state) => state.appendRunEvent);
  const getConversationMessages = useConversationStore((state) => state.getConversationMessages);
  const getConversationEvents = useConversationStore((state) => state.getConversationEvents);

  useEffect(() => {
    if (conversations && conversations.length > 0) {
      setConversations(conversations);
    }
  }, [conversations, setConversations]);

  useEffect(() => {
    if (!activeConversationId && conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgentId) {
      const preferredAgent = agents.find((agent) => agent.status === 'running' || agent.status === 'idle');
      setSelectedAgentId(preferredAgent?.id ?? agents[0].id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (conversationDetail && activeConversationId) {
      setMessages(activeConversationId, conversationDetail.messages);
    }
  }, [conversationDetail, activeConversationId, setMessages]);

  useEffect(() => {
    if (activeConversationId && conversationEvents && conversationEvents.length > 0) {
      if (!eventCursor) {
        setRunEvents(activeConversationId, conversationEvents);
        return;
      }

      conversationEvents.forEach((event) => appendRunEvent(event));
    }
  }, [activeConversationId, conversationEvents, eventCursor, setRunEvents, appendRunEvent]);

  const messages = getConversationMessages(activeConversationId);
  const events = getConversationEvents(activeConversationId);

  const activeRuns = useMemo(() => {
    const runs = Object.values(runsById);
    return runs
      .filter((run) => run.conversationId === activeConversationId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [activeConversationId, runsById]);

  const createConversation = async () => {
    const conversation = await createConversationMutation.mutateAsync({
      title: `Session ${new Date().toLocaleString()}`
    });

    setActiveConversationId(conversation.id);
    setRunEvents(conversation.id, []);
    setMessages(conversation.id, []);
  };

  const submitMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    const content = draft.trim();
    if (!content) {
      return;
    }

    let conversationId = activeConversationId;
    if (!conversationId) {
      const conversation = await createConversationMutation.mutateAsync({
        title: content.slice(0, 60)
      });
      conversationId = conversation.id;
      setActiveConversationId(conversation.id);
    }

    await submitMessageMutation.mutateAsync({
      conversationId,
      data: {
        content,
        agentId: selectedAgentId || undefined
      }
    });

    setDraft('');
  };

  return (
    <section className={cn('grid gap-4 xl:grid-cols-[260px_1fr_320px]', className)}>
      <aside className="panel-elevated flex min-h-[72vh] flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="kicker">Workspace Index</p>
            <h2 className="panel-title">Conversations</h2>
          </div>
          <button
            className="command-button rounded-lg px-3 py-2 text-xs font-semibold"
            onClick={createConversation}
            disabled={createConversationMutation.isPending}
          >
            <span className="inline-flex items-center gap-1">
              {createConversationMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              New
            </span>
          </button>
        </div>

        <div className="data-card mb-3 px-3 py-2 text-xs text-[#d9c9b6]">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[#efd2ab]" />
            {isConnected ? 'Realtime event stream active' : 'Realtime event stream offline'}
          </span>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {isLoadingConversations && (
            <div className="data-card p-3 text-sm text-[#d9c9b6]">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Loading conversations...
            </div>
          )}

          {!isLoadingConversations && (conversations ?? []).length === 0 && (
            <div className="rounded-lg border border-dashed border-[rgba(226,204,180,0.22)] bg-[rgba(19,16,13,0.6)] p-3 text-sm text-[#baa48f]">
              No conversations yet. Create one to begin orchestration.
            </div>
          )}

          {(conversations ?? []).map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setActiveConversationId(conversation.id)}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-all surface-lift',
                activeConversationId === conversation.id
                  ? 'border-[rgba(213,164,106,0.58)] bg-[rgba(213,164,106,0.16)]'
                  : 'border-[rgba(226,204,180,0.2)] bg-[rgba(25,21,17,0.72)] hover:border-[rgba(226,204,180,0.38)]'
              )}
            >
              <p className="truncate text-sm font-semibold text-[#f4e7d6]">{conversation.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[#b79f87]">{conversation.lastMessage || 'No messages yet'}</p>
            </button>
          ))}
        </div>
      </aside>

      <main className="panel-elevated flex min-h-[72vh] flex-col p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(226,204,180,0.2)] pb-3">
          <div>
            <p className="kicker">Execution Transcript</p>
            <h2 className="panel-title text-[1.22rem]">Orchestrator Session</h2>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#bda68f]">Agent</label>
            <select
              className="input-field w-56"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              {(agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-[rgba(226,204,180,0.22)] bg-[rgba(20,16,13,0.62)] p-4 text-sm text-[#b89f84]">
              Ask for a goal like "Research X and produce a summary". The orchestrator will plan, call tools, and answer.
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'rounded-xl border p-3 surface-lift',
                message.role === 'user'
                  ? 'ml-auto max-w-[80%] border-[rgba(213,164,106,0.44)] bg-[rgba(213,164,106,0.14)] text-[#fff2e0]'
                  : 'mr-auto max-w-[85%] border-[rgba(226,204,180,0.2)] bg-[rgba(24,20,16,0.8)] text-[#ecdfcf]'
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#baa089]">
                {message.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                {message.role}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
            </div>
          ))}

          {submitMessageMutation.isPending && (
            <div className="mr-auto max-w-[85%] rounded-xl border border-[rgba(226,204,180,0.2)] bg-[rgba(24,20,16,0.8)] p-3 text-[#ecdfcf]">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Submitting objective to orchestrator...
            </div>
          )}
        </div>

        <form onSubmit={submitMessage} className="mt-4 grid gap-3 border-t border-[rgba(226,204,180,0.2)] pt-3">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Describe what you want the agents to do..."
            className="input-field"
          />
          <button
            type="submit"
            disabled={submitMessageMutation.isPending || !draft.trim()}
            className="command-button rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <span className="inline-flex items-center gap-2">
              {submitMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Run Objective
            </span>
          </button>
        </form>
      </main>

      <aside className="panel-elevated min-h-[72vh] p-4">
        <div className="mb-4 flex items-center gap-2 border-b border-[rgba(226,204,180,0.2)] pb-3">
          <TerminalSquare className="h-4 w-4 text-[#efd2ab]" />
          <div>
            <p className="kicker">Live Timeline</p>
            <h2 className="panel-title">Run Events</h2>
          </div>
        </div>

        <div className="data-card mb-3 p-3 text-xs text-[#d9c9b6]">
          <div className="mb-1 inline-flex items-center gap-1 text-[#ecd9c3]">
            <BrainCircuit className="h-3 w-3" />
            Active Runs: {activeRuns.length}
          </div>
          {activeRuns.slice(0, 3).map((run) => (
            <p key={run.id} className="truncate font-mono text-[11px] text-[#c4ad95]">
              {run.id.slice(0, 16)}... {run.status}
            </p>
          ))}
        </div>

        <div className="max-h-[58vh] space-y-2 overflow-y-auto">
          {events.length === 0 && (
            <div className="rounded-lg border border-dashed border-[rgba(226,204,180,0.2)] bg-[rgba(22,18,14,0.6)] p-3 text-sm text-[#b99f84]">
              Run and tool events will appear here.
            </div>
          )}

          {events.map((event) => (
            <div key={event.id} className="data-card p-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-[#f1c993]">{event.type}</p>
              <p className="mt-1 text-[11px] text-[#c7af94]">
                {new Date(event.timestamp).toLocaleTimeString()}
              </p>
              <pre className="code-block mt-2 max-h-40 overflow-auto whitespace-pre-wrap p-2 text-[11px] text-[#ead6bf]">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

export default AgentWorkspace;
