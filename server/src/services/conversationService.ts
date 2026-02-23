/**
 * ConversationService
 * Manages chat conversations, messages, runs, and run events.
 */

import {
  Conversation,
  ConversationMessage,
  Run,
  RunEvent,
  RunEventType,
  RunStatus,
  MessageRole
} from '../../types';
import { redis } from '../../config/redis';
import { emitRunEvent } from './socketService';
import { getCurrentWorkspaceId, getCurrentWorkspaceIdOrDefault, isWorkspaceMatch } from './workspaceContextService';

const CONVERSATION_KEY_PREFIX = 'conversation:';
const CONVERSATION_INDEX_KEY = 'conversations:index';
const CONVERSATION_MESSAGES_KEY_PREFIX = 'conversation:messages:';

const RUN_KEY_PREFIX = 'run:';
const RUN_INDEX_KEY = 'runs:index';
const RUN_EVENTS_KEY_PREFIX = 'run:events:';

const conversations = new Map<string, Conversation>();
const conversationMessages = new Map<string, ConversationMessage[]>();
const runs = new Map<string, Run>();
const runEvents = new Map<string, RunEvent[]>();

function resolveWorkspaceId(): string {
  return getCurrentWorkspaceIdOrDefault() ?? 'workspace-default';
}

function isConversationVisible(conversation: Conversation): boolean {
  return isWorkspaceMatch(conversation.workspaceId, getCurrentWorkspaceId());
}

function isRunVisible(run: Run): boolean {
  return isWorkspaceMatch(run.workspaceId, getCurrentWorkspaceId());
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializeDateModel<T>(value: T): string {
  return JSON.stringify(value);
}

function deserializeConversation(raw: string): Conversation {
  const parsed = JSON.parse(raw) as Conversation;
  return {
    ...parsed,
    workspaceId: parsed.workspaceId ?? 'workspace-default',
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt)
  };
}

function deserializeMessage(raw: string): ConversationMessage {
  const parsed = JSON.parse(raw) as ConversationMessage;
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt)
  };
}

function deserializeRun(raw: string): Run {
  const parsed = JSON.parse(raw) as Run;
  return {
    ...parsed,
    workspaceId: parsed.workspaceId ?? 'workspace-default',
    startedAt: new Date(parsed.startedAt),
    endedAt: parsed.endedAt ? new Date(parsed.endedAt) : undefined
  };
}

function deserializeRunEvent(raw: string): RunEvent {
  const parsed = JSON.parse(raw) as RunEvent;
  return {
    ...parsed,
    workspaceId: parsed.workspaceId,
    timestamp: new Date(parsed.timestamp)
  };
}

function hydrateMessages(messages: ConversationMessage[]): ConversationMessage[] {
  return messages.map((message) => ({
    ...message,
    createdAt: new Date(message.createdAt)
  }));
}

function hydrateRunEvents(events: RunEvent[]): RunEvent[] {
  return events.map((event) => ({
    ...event,
    timestamp: new Date(event.timestamp)
  }));
}

async function persistConversation(conversation: Conversation): Promise<void> {
  try {
    const pipeline = redis.pipeline();
    pipeline.set(`${CONVERSATION_KEY_PREFIX}${conversation.id}`, serializeDateModel(conversation));
    pipeline.sadd(CONVERSATION_INDEX_KEY, conversation.id);
    await pipeline.exec();
  } catch (error) {
    console.warn('[ConversationService] Failed to persist conversation:', error);
  }
}

async function persistMessages(conversationId: string, messages: ConversationMessage[]): Promise<void> {
  try {
    await redis.set(
      `${CONVERSATION_MESSAGES_KEY_PREFIX}${conversationId}`,
      serializeDateModel(messages)
    );
  } catch (error) {
    console.warn('[ConversationService] Failed to persist messages:', error);
  }
}

async function persistRun(run: Run): Promise<void> {
  try {
    const pipeline = redis.pipeline();
    pipeline.set(`${RUN_KEY_PREFIX}${run.id}`, serializeDateModel(run));
    pipeline.sadd(RUN_INDEX_KEY, run.id);
    await pipeline.exec();
  } catch (error) {
    console.warn('[ConversationService] Failed to persist run:', error);
  }
}

async function persistRunEvents(runId: string, events: RunEvent[]): Promise<void> {
  try {
    await redis.set(`${RUN_EVENTS_KEY_PREFIX}${runId}`, serializeDateModel(events));
  } catch (error) {
    console.warn('[ConversationService] Failed to persist run events:', error);
  }
}

function persistConversationAsync(conversation: Conversation): void {
  persistConversation(conversation).catch((error) => {
    console.warn('[ConversationService] Async conversation persistence failed:', error);
  });
}

function persistMessagesAsync(conversationId: string, messages: ConversationMessage[]): void {
  persistMessages(conversationId, messages).catch((error) => {
    console.warn('[ConversationService] Async message persistence failed:', error);
  });
}

function persistRunAsync(run: Run): void {
  persistRun(run).catch((error) => {
    console.warn('[ConversationService] Async run persistence failed:', error);
  });
}

function persistRunEventsAsync(runId: string, events: RunEvent[]): void {
  persistRunEvents(runId, events).catch((error) => {
    console.warn('[ConversationService] Async run events persistence failed:', error);
  });
}

export async function initializeConversationStore(): Promise<void> {
  try {
    const conversationIds = await redis.smembers(CONVERSATION_INDEX_KEY);
    if (conversationIds.length > 0) {
      const conversationPipeline = redis.pipeline();
      for (const id of conversationIds) {
        conversationPipeline.get(`${CONVERSATION_KEY_PREFIX}${id}`);
      }

      const conversationResults = await conversationPipeline.exec();
      if (conversationResults) {
        for (const [err, raw] of conversationResults) {
          if (!err && raw) {
            const conversation = deserializeConversation(raw as string);
            conversations.set(conversation.id, conversation);
          }
        }
      }

      for (const id of conversationIds) {
        const rawMessages = await redis.get(`${CONVERSATION_MESSAGES_KEY_PREFIX}${id}`);
        if (!rawMessages) {
          continue;
        }

        const parsed = JSON.parse(rawMessages) as ConversationMessage[];
        conversationMessages.set(id, hydrateMessages(parsed));
      }
    }

    const runIds = await redis.smembers(RUN_INDEX_KEY);
    if (runIds.length > 0) {
      const runPipeline = redis.pipeline();
      for (const id of runIds) {
        runPipeline.get(`${RUN_KEY_PREFIX}${id}`);
      }

      const runResults = await runPipeline.exec();
      if (runResults) {
        for (const [err, raw] of runResults) {
          if (!err && raw) {
            const run = deserializeRun(raw as string);
            runs.set(run.id, run);
          }
        }
      }

      for (const id of runIds) {
        const rawEvents = await redis.get(`${RUN_EVENTS_KEY_PREFIX}${id}`);
        if (!rawEvents) {
          continue;
        }

        const parsed = JSON.parse(rawEvents) as RunEvent[];
        runEvents.set(id, hydrateRunEvents(parsed));
      }
    }
  } catch (error) {
    console.warn('[ConversationService] Failed to initialize from Redis:', error);
  }
}

export function listConversations(): Conversation[] {
  return Array.from(conversations.values())
    .filter((conversation) => isConversationVisible(conversation))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function getConversation(conversationId: string): Conversation | undefined {
  const conversation = conversations.get(conversationId);
  if (!conversation) {
    return undefined;
  }

  if (!isConversationVisible(conversation)) {
    return undefined;
  }

  return conversation;
}

export function createConversation(input?: {
  title?: string;
  metadata?: Record<string, unknown>;
}): Conversation {
  const now = new Date();
  const conversation: Conversation = {
    id: generateId('conv'),
    workspaceId: resolveWorkspaceId(),
    title: input?.title?.trim() || 'Untitled Conversation',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    metadata: input?.metadata
  };

  conversations.set(conversation.id, conversation);
  conversationMessages.set(conversation.id, []);
  persistConversationAsync(conversation);

  return conversation;
}

function touchConversation(conversationId: string, updates?: Partial<Conversation>): void {
  const conversation = conversations.get(conversationId);
  if (!conversation) {
    return;
  }

  Object.assign(conversation, updates ?? {});
  conversation.updatedAt = new Date();
  persistConversationAsync(conversation);
}

export function addConversationMessage(input: {
  conversationId: string;
  role: MessageRole;
  content: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): ConversationMessage {
  const conversation = conversations.get(input.conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const message: ConversationMessage = {
    id: generateId('msg'),
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    createdAt: new Date(),
    runId: input.runId,
    metadata: input.metadata
  };

  const messages = conversationMessages.get(input.conversationId) ?? [];
  messages.push(message);
  conversationMessages.set(input.conversationId, messages);

  touchConversation(input.conversationId);
  persistMessagesAsync(input.conversationId, messages);

  return message;
}

export function listConversationMessages(conversationId: string): ConversationMessage[] {
  return [...(conversationMessages.get(conversationId) ?? [])]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function createRun(input: {
  conversationId: string;
  rootTaskId?: string;
  metadata?: Record<string, unknown>;
}): Run {
  const conversation = conversations.get(input.conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const run: Run = {
    id: generateId('run'),
    workspaceId: conversation.workspaceId ?? resolveWorkspaceId(),
    conversationId: input.conversationId,
    rootTaskId: input.rootTaskId,
    status: 'running',
    startedAt: new Date(),
    metadata: input.metadata
  };

  runs.set(run.id, run);
  runEvents.set(run.id, []);

  touchConversation(input.conversationId, { lastRunId: run.id });
  persistRunAsync(run);

  return run;
}

export function getRun(runId: string): Run | undefined {
  const run = runs.get(runId);
  if (!run) {
    return undefined;
  }

  if (!isRunVisible(run)) {
    return undefined;
  }

  return run;
}

export function listRuns(): Run[] {
  return Array.from(runs.values())
    .filter((run) => isRunVisible(run))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export function updateRun(
  runId: string,
  status: RunStatus,
  updates?: Partial<Omit<Run, 'id' | 'conversationId' | 'status'>>
): Run | undefined {
  const run = runs.get(runId);
  if (!run) {
    return undefined;
  }

  run.status = status;

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    run.endedAt = new Date();
  }

  if (updates) {
    Object.assign(run, updates);
  }

  touchConversation(run.conversationId, { lastRunId: run.id });
  persistRunAsync(run);

  return run;
}

export function appendRunEvent(input: {
  runId: string;
  conversationId: string;
  type: RunEventType;
  payload?: Record<string, unknown>;
}): RunEvent {
  const event: RunEvent = {
    id: generateId('evt'),
    workspaceId: getRun(input.runId)?.workspaceId ?? resolveWorkspaceId(),
    runId: input.runId,
    conversationId: input.conversationId,
    type: input.type,
    payload: input.payload ?? {},
    timestamp: new Date()
  };

  const events = runEvents.get(input.runId) ?? [];
  events.push(event);
  runEvents.set(input.runId, events);

  persistRunEventsAsync(input.runId, events);
  emitRunEvent(event);

  return event;
}

export function listRunEvents(runId: string): RunEvent[] {
  const run = getRun(runId);
  if (!run) {
    return [];
  }

  return [...(runEvents.get(runId) ?? [])]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function listConversationEvents(conversationId: string, after?: string): RunEvent[] {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    return [];
  }

  const parsed = after ? new Date(after) : null;
  const start = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const events = Array.from(runEvents.values())
    .flatMap((entries) => entries)
    .filter((event) => event.conversationId === conversationId)
    .filter((event) => isWorkspaceMatch(event.workspaceId, conversation.workspaceId));

  const filtered = start
    ? events.filter((event) => event.timestamp.getTime() > start.getTime())
    : events;

  return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
