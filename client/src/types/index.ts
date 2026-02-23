/**
 * Agent Orchestration Platform - Client Types
 * TypeScript interfaces mirroring server types
 */

// ============================================
// Execution & Research Profiles
// ============================================
export type ExecutionProfile = 'standard' | 'deep_research';
export type ResearchDepth = 'quick' | 'standard' | 'deep';

// ============================================
// Feature Flags
// ============================================
export interface FeatureFlags {
  FEATURE_DEEP_RESEARCH: boolean;
  FEATURE_MCP_SDK_CLIENT: boolean;
  FEATURE_PROVIDER_TOOLS: boolean;
  FEATURE_EVALUATOR_LOOP: boolean;
  FEATURE_APPROVAL_GATES: boolean;
  FEATURE_RUN_INTELLIGENCE_UI: boolean;
  FEATURE_RESUMABLE_STREAM_TRANSPORT: boolean;
}

// ============================================
// Agent Types
// ============================================
export type AgentStatus = 'registered' | 'starting' | 'running' | 'idle' | 'error' | 'stopped';

export type TaskStatus = 'pending' | 'blocked' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TaskErrorType = 'tool_error' | 'model_error' | 'timeout' | 'validation_error' | 'unknown_error';
export type TaskExecutionMode = 'tool_loop' | 'claude_cli';
export type ScheduleRunStatus = 'never' | 'running' | 'succeeded' | 'failed';
export type WebhookDirection = 'inbound' | 'outbound';
export type WebhookStatus = 'pending' | 'delivered' | 'failed' | 'disabled';
export type OrchestrationExecutionStrategy = 'sequential' | 'parallel';
export type PlanStatus = 'draft' | 'active' | 'completed' | 'failed' | 'cancelled';
export type PlanStepStatus = 'pending' | 'blocked' | 'running' | 'completed' | 'failed' | 'skipped';
export type ConversationStatus = 'active' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type RunEventType =
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'task.status'
  | 'message.delta'
  | 'message.created'
  | 'tool.call'
  | 'tool.result'
  | 'tool.error'
  | 'plan.created'
  | 'plan.step.status'
  // New: Deep Research events
  | 'research.finding'
  | 'research.source'
  // New: Model routing events
  | 'model.route.selected'
  // New: Evaluation events
  | 'evaluation.completed'
  // New: Approval / governance events
  | 'approval.requested'
  | 'approval.resolved'
  // New: Stream transport events
  | 'stream.resumed';

// ============================================
// Research Types
// ============================================
export interface ResearchConfig {
  depth: ResearchDepth;
  parallelism?: number;
  requireCitations?: boolean;
  maxSources?: number;
}

export interface ResearchSource {
  id: string;
  url?: string;
  title: string;
  snippet: string;
  confidence: number;
  retrievedAt: Date;
}

export interface ResearchFinding {
  id: string;
  claim: string;
  sources: string[];
  confidence: number;
  crossChecked: boolean;
}

// ============================================
// Evaluation Types
// ============================================
export interface EvaluatorResult {
  score: number;
  criteria: Record<string, number>;
  feedback: string;
  passed: boolean;
  revisedContent?: string;
  evaluatedAt: Date;
}

// ============================================
// Approval Types
// ============================================
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'timed_out';

export interface ApprovalRequest {
  id: string;
  runId: string;
  toolName: string;
  reason: string;
  input: Record<string, unknown>;
  status: ApprovalStatus;
  requestedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// ============================================
// Route Decision
// ============================================
export interface RouteDecision {
  stepId?: string;
  selectedModel: string;
  reason: string;
  taskClass?: string;
  decidedAt: Date;
}

// ============================================
// Run Artifacts & Intelligence
// ============================================
export interface RunArtifacts {
  sources?: ResearchSource[];
  findings?: ResearchFinding[];
  evaluatorResult?: EvaluatorResult;
  approvals?: ApprovalRequest[];
  routeDecisions?: RouteDecision[];
  citationMap?: Record<string, string[]>;
  confidenceSummary?: {
    overall: number;
    perFinding: Record<string, number>;
  };
}

export interface RunPhase {
  name: string;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  eventCount: number;
  status: 'running' | 'completed' | 'failed';
}

export interface RunIntelligence {
  runId: string;
  phases: RunPhase[];
  bottleneck?: {
    phaseName: string;
    durationMs: number;
    reason: string;
  };
  toolFailureSummary: Array<{
    toolName: string;
    errorCount: number;
    lastError: string;
  }>;
  routeSummary: RouteDecision[];
  totalDurationMs: number;
}

// ============================================
// Core Model Interfaces
// ============================================

// Agent interface
export interface Agent {
  id: string;
  name: string;
  type: string;
  config: {
    executionMode?: TaskExecutionMode;
    claude?: {
      command?: string;
      baseArgs?: string[];
      promptFlag?: string;
      appendPromptAsArg?: boolean;
      timeoutMs?: number;
      workingDirectory?: string;
      allowedCommands?: string[];
    };
    [key: string]: unknown;
  };
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Task interface
export interface Task {
  id: string;
  agentId: string;
  type: string;
  data: Record<string, unknown>;
  executionMode?: TaskExecutionMode;
  status: TaskStatus;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  parentTaskId?: string;
  planId?: string;
  stepId?: string;
  dependsOnTaskIds?: string[];
  childTaskIds?: string[];
  idempotencyKey?: string;
  retryCount?: number;
  metadata?: Record<string, unknown>;
  conversationId?: string;
  runId?: string;
  result?: unknown;
  error?: string;
  errorType?: TaskErrorType;
  liveOutput?: string;
  liveErrorOutput?: string;
  lastLogAt?: Date;
}

export interface ScheduleDefinition {
  id: string;
  workspaceId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  retryLimit: number;
  retryBackoffSeconds: number;
  lastRunAt?: Date;
  nextRunAt?: Date;
  lastRunStatus: ScheduleRunStatus;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDefinition {
  id: string;
  workspaceId: string;
  direction: WebhookDirection;
  eventName: string;
  targetUrl?: string;
  status: WebhookStatus;
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
  signature?: string;
  responseStatus?: number;
  responseBody?: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: Date;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  title: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  lastRunId?: string;
  metadata?: Record<string, unknown>;
  messageCount?: number;
  lastMessage?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export interface Run {
  id: string;
  conversationId: string;
  rootTaskId?: string;
  status: RunStatus;
  startedAt: Date;
  endedAt?: Date;
  summary?: string;
  error?: string;
  executionProfile?: ExecutionProfile;
  artifacts?: RunArtifacts;
  metadata?: Record<string, unknown>;
}

export interface RunEvent {
  id: string;
  runId: string;
  conversationId: string;
  type: RunEventType;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export interface PlanStep {
  id: string;
  planId: string;
  title: string;
  description?: string;
  agentId: string;
  taskType: string;
  taskData: Record<string, unknown>;
  dependsOnStepIds: string[];
  status: PlanStepStatus;
  taskId?: string;
  output?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: string;
  objective: string;
  status: PlanStatus;
  createdByTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  steps: PlanStep[];
}

// Shared memory value interface
export interface SharedMemoryValue {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
  ttl?: number;
  expiresAt?: Date;
}

// ============================================
// WebSocket Event Payloads
// ============================================
export interface AgentStatusEvent {
  agentId: string;
  status: AgentStatus;
  timestamp: Date;
}

export interface TaskStatusEvent {
  taskId: string;
  status: TaskStatus;
  agentId?: string;
  type?: string;
  priority?: number;
  executionMode?: TaskExecutionMode;
  parentTaskId?: string;
  planId?: string;
  stepId?: string;
  runId?: string;
  conversationId?: string;
  error?: string;
  errorType?: TaskErrorType;
  timestamp: Date;
}

export interface TaskCompletedEvent {
  taskId: string;
  result: unknown;
  timestamp: Date;
}

export interface TaskLogEvent {
  taskId: string;
  agentId: string;
  stream: 'stdout' | 'stderr' | 'system';
  chunk: string;
  timestamp: Date;
}

export interface ErrorEvent {
  code: string;
  message: string;
  timestamp: Date;
}

export interface ScheduleTriggeredEvent {
  scheduleId: string;
  scheduleName: string;
  status: 'succeeded' | 'failed';
  taskId?: string;
  error?: string;
  nextRunAt?: Date;
  timestamp: Date;
}

export interface WebhookDeliveryEvent {
  webhookId: string;
  eventName: string;
  direction: WebhookDirection;
  status: WebhookStatus;
  attemptCount: number;
  responseStatus?: number;
  nextAttemptAt?: Date;
  error?: string;
  timestamp: Date;
}

// Socket events type definition
export interface SocketEvents {
  // Server -> Client events
  'agent-status': AgentStatusEvent;
  'task-status': TaskStatusEvent;
  'task-completed': TaskCompletedEvent;
  'task-log': TaskLogEvent;
  'plan-created': { planId: string; timestamp: Date };
  'plan-updated': { planId: string; status: PlanStatus; timestamp: Date };
  'plan-step-status': { planId: string; stepId: string; status: PlanStepStatus; timestamp: Date };
  'run-event': {
    id: string;
    runId: string;
    conversationId: string;
    type: RunEventType;
    payload: Record<string, unknown>;
    timestamp: Date;
  };
  'schedule-triggered': ScheduleTriggeredEvent;
  'webhook-delivery': WebhookDeliveryEvent;
  'error': ErrorEvent;

  // Client -> Server events
  'join-agent': { agentId: string };
  'leave-agent': { agentId: string };
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Client-specific types
export interface AgentWithStats extends Agent {
  taskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
}

export interface TaskWithAgent extends Task {
  agentName: string;
  agentType: string;
}
