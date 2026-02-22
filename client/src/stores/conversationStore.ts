/**
 * Conversation Store
 * Tracks conversations, messages, runs, and live run events.
 */

import { create } from 'zustand';
import type { Conversation, ConversationMessage, Run, RunEvent } from '../types';

interface ConversationStore {
  conversations: Record<string, Conversation>;
  messagesByConversation: Record<string, ConversationMessage[]>;
  runs: Record<string, Run>;
  runEventsByConversation: Record<string, RunEvent[]>;

  setConversations: (conversations: Conversation[]) => void;
  upsertConversation: (conversation: Conversation) => void;

  setMessages: (conversationId: string, messages: ConversationMessage[]) => void;
  addMessage: (conversationId: string, message: ConversationMessage) => void;

  setRuns: (runs: Run[]) => void;
  upsertRun: (run: Run) => void;

  setRunEvents: (conversationId: string, events: RunEvent[]) => void;
  appendRunEvent: (event: RunEvent) => void;

  getConversationMessages: (conversationId: string) => ConversationMessage[];
  getConversationEvents: (conversationId: string) => RunEvent[];
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: {},
  messagesByConversation: {},
  runs: {},
  runEventsByConversation: {},

  setConversations: (conversations) => {
    set(() => ({
      conversations: conversations.reduce<Record<string, Conversation>>((acc, conversation) => {
        acc[conversation.id] = conversation;
        return acc;
      }, {})
    }));
  },

  upsertConversation: (conversation) => {
    set((state) => ({
      conversations: {
        ...state.conversations,
        [conversation.id]: conversation
      }
    }));
  },

  setMessages: (conversationId, messages) => {
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }
    }));
  },

  addMessage: (conversationId, message) => {
    set((state) => {
      const existing = state.messagesByConversation[conversationId] ?? [];
      const alreadyExists = existing.some((entry) => entry.id === message.id);
      if (alreadyExists) {
        return state;
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existing, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        }
      };
    });
  },

  setRuns: (runs) => {
    set(() => ({
      runs: runs.reduce<Record<string, Run>>((acc, run) => {
        acc[run.id] = run;
        return acc;
      }, {})
    }));
  },

  upsertRun: (run) => {
    set((state) => ({
      runs: {
        ...state.runs,
        [run.id]: {
          ...state.runs[run.id],
          ...run
        }
      }
    }));
  },

  setRunEvents: (conversationId, events) => {
    set((state) => ({
      runEventsByConversation: {
        ...state.runEventsByConversation,
        [conversationId]: [...events].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      }
    }));
  },

  appendRunEvent: (event) => {
    set((state) => {
      const existing = state.runEventsByConversation[event.conversationId] ?? [];
      if (existing.some((entry) => entry.id === event.id)) {
        return state;
      }

      return {
        runEventsByConversation: {
          ...state.runEventsByConversation,
          [event.conversationId]: [...existing, event].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        }
      };
    });
  },

  getConversationMessages: (conversationId) => {
    return get().messagesByConversation[conversationId] ?? [];
  },

  getConversationEvents: (conversationId) => {
    return get().runEventsByConversation[conversationId] ?? [];
  }
}));
