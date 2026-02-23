/**
 * Agent Orchestration Platform - Server Types
 * TypeScript interfaces for Agent, Task, and SharedMemory
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
  FEATURE_IOT_INTEGRATIONS: boolean;
  FEATURE_EXTERNAL_AI_PROVIDERS: boolean;
  FEATURE_EVALUATOR_LOOP: boolean;
  FEATURE_APPROVAL_GATES: boolean;
  FEATURE_RUN_INTELLIGENCE_UI: boolean;
  FEATURE_RESUMABLE_STREAM_TRANSPORT: boolean;
  FEATURE_HTTP_RATE_LIMIT: boolean;
  FEATURE_CIRCUIT_BREAKERS: boolean;
  FEATURE_DEAD_LETTER_QUEUE: boolean;
  FEATURE_ADVANCED_DAG: boolean;
  FEATURE_DYNAMIC_AGENT_POOLS: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  FEATURE_DEEP_RESEARCH: false,
  FEATURE_MCP_SDK_CLIENT: false,
  FEATURE_PROVIDER_TOOLS: false,
  FEATURE_IOT_INTEGRATIONS: false,
  FEATURE_EXTERNAL_AI_PROVIDERS: false,
  FEATURE_EVALUATOR_LOOP: false,
  FEATURE_APPROVAL_GATES: false,
  FEATURE_RUN_INTELLIGENCE_UI: false,
  FEATURE_RESUMABLE_STREAM_TRANSPORT: false,
  FEATURE_HTTP_RATE_LIMIT: false,
  FEATURE_CIRCUIT_BREAKERS: false,
  FEATURE_DEAD_LETTER_QUEUE: false,
  FEATURE_ADVANCED_DAG: false,
  FEATURE_DYNAMIC_AGENT_POOLS: false,
};

export function getFeatureFlags(): FeatureFlags {
  return {
    FEATURE_DEEP_RESEARCH: process.env.FEATURE_DEEP_RESEARCH === 'true',
    FEATURE_MCP_SDK_CLIENT: process.env.FEATURE_MCP_SDK_CLIENT === 'true',
    FEATURE_PROVIDER_TOOLS: process.env.FEATURE_PROVIDER_TOOLS === 'true',
    FEATURE_IOT_INTEGRATIONS: process.env.FEATURE_IOT_INTEGRATIONS === 'true',
    FEATURE_EXTERNAL_AI_PROVIDERS: process.env.FEATURE_EXTERNAL_AI_PROVIDERS === 'true',
    FEATURE_EVALUATOR_LOOP: process.env.FEATURE_EVALUATOR_LOOP === 'true',
    FEATURE_APPROVAL_GATES: process.env.FEATURE_APPROVAL_GATES === 'true',
    FEATURE_RUN_INTELLIGENCE_UI: process.env.FEATURE_RUN_INTELLIGENCE_UI === 'true',
    FEATURE_RESUMABLE_STREAM_TRANSPORT: process.env.FEATURE_RESUMABLE_STREAM_TRANSPORT === 'true',
    FEATURE_HTTP_RATE_LIMIT: process.env.FEATURE_HTTP_RATE_LIMIT === 'true',
    FEATURE_CIRCUIT_BREAKERS: process.env.FEATURE_CIRCUIT_BREAKERS === 'true',
    FEATURE_DEAD_LETTER_QUEUE: process.env.FEATURE_DEAD_LETTER_QUEUE === 'true',
    FEATURE_ADVANCED_DAG: process.env.FEATURE_ADVANCED_DAG === 'true',
    FEATURE_DYNAMIC_AGENT_POOLS: process.env.FEATURE_DYNAMIC_AGENT_POOLS === 'true',
  };
}

// ============================================
// Agent Types
// ============================================
export type AgentStatus = 'registered' | 'starting' | 'running' | 'idle' | 'error' | 'stopped';

// MCP Server Configuration
export interface McpServerConfig {
  url?: string;           // For HTTP MCP servers
  name: string;
  transport?: 'stdio' | 'http';
  command?: string;       // For stdio transport
  args?: string[];        // For stdio transport
}

// Model Routing Configuration
export interface ModelRoutingConfig {
  defaultModel: string;
  taskClassRoutes?: Record<string, string>;  // taskClass -> model
  toolRequiredModel?: string;                // model when tools are needed
  budgetModel?: string;                      // model for budget-constrained tasks
  complexityThreshold?: number;              // 0-1, above => use complex model
}

// Provider Tool Configuration
export interface ProviderToolConfig {
  enabled: boolean;
  allowedProviders?: string[];
  deniedProviders?: string[];
}

// Evaluation Policy
export interface EvaluationPolicy {
  enabled: boolean;
  minScoreThreshold?: number;      // 0-1, below => auto-revise or fail
  maxRevisionAttempts?: number;
  evaluationModel?: string;
  criteria?: string[];              // e.g., ['accuracy', 'completeness', 'relevance']
}

// Governance Policy
export interface GovernancePolicy {
  enabled: boolean;
  requireApprovalTools?: string[];  // tool names that require approval
  requireApprovalActions?: string[]; // action types needing approval
  autoApproveTimeout?: number;      // ms before auto-deny
  notifyOnApproval?: boolean;
}

// Agent configuration
export interface AgentConfig {
  mcpServers?: McpServerConfig[];
  executionMode?: TaskExecutionMode;
  modelRouting?: ModelRoutingConfig;
  providerTools?: ProviderToolConfig;
  evaluationPolicy?: EvaluationPolicy;
  governancePolicy?: GovernancePolicy;
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
}

// ============================================
// Task Types
// ============================================
export type TaskStatus = 'pending' | 'blocked' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TaskErrorType = 'tool_error' | 'model_error' | 'timeout' | 'validation_error' | 'unknown_error';
export type TaskExecutionMode = 'tool_loop' | 'claude_cli';
export type ScheduleRunStatus = 'never' | 'running' | 'succeeded' | 'failed';
export type WebhookDirection = 'inbound' | 'outbound';
export type WebhookStatus = 'pending' | 'delivered' | 'failed' | 'disabled';
export type OrchestrationExecutionStrategy = 'sequential' | 'parallel' | 'dag';
export type PlanStatus = 'draft' | 'active' | 'completed' | 'failed' | 'cancelled';
export type PlanStepStatus = 'pending' | 'blocked' | 'running' | 'completed' | 'failed' | 'skipped';
export type ConversationStatus = 'active' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Extended RunEventType with new event types
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
// Research Configuration
// ============================================
export interface ResearchConfig {
  depth: ResearchDepth;
  parallelism?: number;
  requireCitations?: boolean;
  maxSources?: number;
}

// ============================================
// Research Artifacts
// ============================================
export interface ResearchSource {
  id: string;
  url?: string;
  title: string;
  snippet: string;
  confidence: number;        // 0-1
  retrievedAt: Date;
}

export interface ResearchFinding {
  id: string;
  claim: string;
  sources: string[];         // source IDs
  confidence: number;        // 0-1
  crossChecked: boolean;
}

// ============================================
// Evaluation Artifacts
// ============================================
export interface EvaluatorResult {
  score: number;             // 0-1
  criteria: Record<string, number>;  // criterion -> score
  feedback: string;
  passed: boolean;
  revisedContent?: string;
  evaluatedAt: Date;
}

// ============================================
// Approval Artifacts
// ============================================
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'timed_out';

export interface ApprovalRequest {
  id: string;
  workspaceId?: string;
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
// Run Artifacts (composite)
// ============================================
export interface RunArtifacts {
  sources?: ResearchSource[];
  findings?: ResearchFinding[];
  evaluatorResult?: EvaluatorResult;
  approvals?: ApprovalRequest[];
  routeDecisions?: RouteDecision[];
  citationMap?: Record<string, string[]>;  // claim -> sourceIds
  confidenceSummary?: {
    overall: number;
    perFinding: Record<string, number>;
  };
}

// ============================================
// Run Intelligence
// ============================================
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
  workspaceId?: string;
  name: string;
  type: string;
  config: AgentConfig;
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Task interface
export interface Task {
  id: string;
  workspaceId?: string;
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
  workspaceId?: string;
  title: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  lastRunId?: string;
  metadata?: Record<string, unknown>;
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
  workspaceId?: string;
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
  workspaceId?: string;
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
  workspaceId?: string;
  objective: string;
  status: PlanStatus;
  createdByTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  steps: PlanStep[];
}

export interface ToolPolicy {
  allowTools?: string[];
  denyTools?: string[];
  maxToolCallsPerTask?: number;
  perToolTimeoutMs?: number;
}

export interface OrchestrationSummary {
  planId: string;
  rootTaskId?: string;
  totalSteps: number;
  readySteps: number;
  executionStrategy?: OrchestrationExecutionStrategy;
  teamAgentIds?: string[];
  assignmentStrategy?: 'round_robin' | 'least_loaded';
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

// ============================================
// API Response Types
// ============================================
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
