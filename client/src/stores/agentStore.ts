/**
 * Agent Store - Zustand store for agent state management
 */
import { create } from 'zustand';
import type { Agent } from '../types';

interface AgentStore {
  agents: Record<string, Agent>;
  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  getAgent: (id: string) => Agent | undefined;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: {},

  setAgents: (agents: Agent[]) =>
    set(() => ({
      agents: agents.reduce<Record<string, Agent>>((acc, agent) => {
        acc[agent.id] = agent;
        return acc;
      }, {})
    })),

  updateAgent: (id: string, updates: Partial<Agent>) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: { ...state.agents[id], ...updates }
      }
    })),

  addAgent: (agent: Agent) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agent.id]: agent
      }
    })),

  removeAgent: (id: string) =>
    set((state) => {
      const { [id]: _, ...remainingAgents } = state.agents;
      return { agents: remainingAgents };
    }),

  getAgent: (id: string) => get().agents[id]
}));
