/**
 * ExecutionService - Handles LLM interactions and tool-loop execution.
 * Adds tool governance, memory tier access, trace/metrics integration,
 * model routing (WP-02), evaluator loop (WP-08), deep research (WP-04),
 * and governance approvals (WP-09).
 */

import { ToolLoopAgent, hasToolCall, tool, zodSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getAgent } from './agentService';
import {
  Task,
  TaskExecutionMode,
  ToolPolicy,
  ExecutionProfile,
  ResearchConfig,
  EvaluationPolicy,
  GovernancePolicy,
  getFeatureFlags
} from '../../types';
import {
  getTieredValue,
  getValue,
  setTieredValue,
  setValue
} from './sharedMemoryService';
import { getMcpToolsForAgent, getMcpToolsFromServers } from './mcpClientService';
import { createAgentTrace, formatTraceMetadata, isTracingEnabled } from './tracingService';
import { applyToolPolicies, clearTaskToolBudget } from './toolPolicyService';
import { appendRunEvent } from './conversationService';
import { createAndStartPlan } from './orchestratorService';
import { executeClaudeCliTask } from './claudeCliService';
import { selectModel, logRouteDecision } from './modelRoutingService';
import { evaluateOutput } from './evaluatorService';
import { executeDeepResearch } from './deepResearchService';
import { requiresApproval, requestApproval } from './governanceService';
import dotenv from 'dotenv';

dotenv.config();

interface ToolCatalogItem {
  name: string;
  description: string;
  source: 'builtin' | 'mcp' | 'provider';
  enabled: boolean;
}

const BUILTIN_TOOL_CATALOG: ToolCatalogItem[] = [
  {
    name: 'readSharedMemory',
    description: 'Read a value from shared memory by key.',
    source: 'builtin',
    enabled: true
  },
  {
    name: 'writeSharedMemory',
    description: 'Write a value into shared memory by key.',
    source: 'builtin',
    enabled: true
  },
  {
    name: 'readTieredMemory',
    description: 'Read value from a memory tier (working|episodic|shared).',
    source: 'builtin',
    enabled: true
  },
  {
    name: 'writeTieredMemory',
    description: 'Write value to a memory tier (working|episodic|shared).',
    source: 'builtin',
    enabled: true
  },
  {
    name: 'createOrchestrationPlan',
    description: 'Create and start a multi-step orchestration plan from an objective.',
    source: 'builtin',
    enabled: true
  },
  {
    name: 'finalAnswer',
    description: 'Provide the final answer to the user.',
    source: 'builtin',
    enabled: true
  }
];

function createModelProvider() {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayApiKey) {
    return createOpenAI({
      apiKey: gatewayApiKey,
      baseURL: process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1'
    });
  }

  return createOpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

const openai = createModelProvider();

async function loadMcpTools(config: Record<string, unknown>): Promise<Record<string, any>> {
  const flags = getFeatureFlags();
  if (!flags.FEATURE_MCP_SDK_CLIENT) {
    return {};
  }

  const mcpServers = Array.isArray(config.mcpServers)
    ? config.mcpServers.filter((server): server is { url: string } => {
      if (!server || typeof server !== 'object') {
        return false;
      }

      const maybeUrl = (server as { url?: unknown }).url;
      return typeof maybeUrl === 'string' && maybeUrl.length > 0;
    })
    : [];

  if (mcpServers.length > 0) {
    return getMcpToolsFromServers(
      mcpServers.map((server) => {
        const raw = server as Record<string, unknown>;
        return {
          url: server.url,
          config: {
            url: server.url,
            name: typeof raw.name === 'string' ? raw.name : server.url,
            transport: raw.transport === 'stdio' ? 'stdio' : 'http',
            command: typeof raw.command === 'string' ? raw.command : undefined,
            args: Array.isArray(raw.args)
              ? raw.args.filter((arg): arg is string => typeof arg === 'string')
              : undefined
          }
        };
      })
    );
  }

  const legacyMcpUrl = typeof config.mcpServer === 'string' ? config.mcpServer : undefined;
  return legacyMcpUrl ? getMcpToolsForAgent(legacyMcpUrl) : {};
}

function getToolPolicy(config: Record<string, unknown>): ToolPolicy {
  const rawPolicy = (config.toolPolicy ?? {}) as Record<string, unknown>;

  const allowTools = Array.isArray(rawPolicy.allowTools)
    ? rawPolicy.allowTools.filter((value): value is string => typeof value === 'string')
    : undefined;
  const denyTools = Array.isArray(rawPolicy.denyTools)
    ? rawPolicy.denyTools.filter((value): value is string => typeof value === 'string')
    : undefined;

  return {
    allowTools,
    denyTools,
    maxToolCallsPerTask: typeof rawPolicy.maxToolCallsPerTask === 'number'
      ? rawPolicy.maxToolCallsPerTask
      : 40,
    perToolTimeoutMs: typeof rawPolicy.perToolTimeoutMs === 'number'
      ? rawPolicy.perToolTimeoutMs
      : 30_000
  };
}

function getEvaluationPolicy(config: Record<string, unknown>): EvaluationPolicy {
  const raw = (config.evaluationPolicy ?? {}) as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    minScoreThreshold: typeof raw.minScoreThreshold === 'number' ? raw.minScoreThreshold : 0.5,
    maxRevisionAttempts: typeof raw.maxRevisionAttempts === 'number' ? raw.maxRevisionAttempts : 2,
    evaluationModel: typeof raw.evaluationModel === 'string' ? raw.evaluationModel : undefined,
    criteria: Array.isArray(raw.criteria) ? raw.criteria.filter((c): c is string => typeof c === 'string') : undefined
  };
}

function getGovernancePolicy(config: Record<string, unknown>): GovernancePolicy {
  const raw = (config.governancePolicy ?? {}) as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    requireApprovalTools: Array.isArray(raw.requireApprovalTools)
      ? raw.requireApprovalTools.filter((t): t is string => typeof t === 'string')
      : undefined,
    requireApprovalActions: Array.isArray(raw.requireApprovalActions)
      ? raw.requireApprovalActions.filter((a): a is string => typeof a === 'string')
      : undefined,
    autoApproveTimeout: typeof raw.autoApproveTimeout === 'number' ? raw.autoApproveTimeout : 60_000,
    notifyOnApproval: raw.notifyOnApproval === true
  };
}

function isToolEnabledByPolicy(toolName: string, policy: ToolPolicy): boolean {
  if (policy.denyTools?.includes(toolName)) {
    return false;
  }

  if (policy.allowTools && policy.allowTools.length > 0) {
    return policy.allowTools.includes(toolName);
  }

  return true;
}

export async function getToolCatalog(agentId?: string): Promise<{
  agentId?: string;
  tools: ToolCatalogItem[];
  policy: ToolPolicy;
  mcpServers: Array<{ name: string; url?: string; transport?: string }>;
}> {
  if (!agentId) {
    return {
      tools: BUILTIN_TOOL_CATALOG,
      policy: {
        maxToolCallsPerTask: 40,
        perToolTimeoutMs: 30_000
      },
      mcpServers: []
    };
  }

  const agent = getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const config = agent.config as Record<string, unknown>;
  const policy = getToolPolicy(config);
  const declaredServers = Array.isArray(config.mcpServers)
    ? config.mcpServers
      .filter((server): server is Record<string, unknown> => typeof server === 'object' && server !== null)
      .map((server) => ({
        name: typeof server.name === 'string' ? server.name : 'mcp-server',
        url: typeof server.url === 'string' ? server.url : undefined,
        transport: typeof server.transport === 'string' ? server.transport : undefined
      }))
    : [];

  const mcpTools = await loadMcpTools(config);
  const mcpCatalog: ToolCatalogItem[] = Object.entries(mcpTools).map(([name, definition]) => ({
    name,
    description: definition?.description ?? 'MCP tool',
    source: 'mcp',
    enabled: isToolEnabledByPolicy(name, policy)
  }));

  const flags = getFeatureFlags();
  const providerConfig = (config.providerTools ?? {}) as Record<string, unknown>;
  const providerEnabled = (
    flags.FEATURE_PROVIDER_TOOLS &&
    flags.FEATURE_EXTERNAL_AI_PROVIDERS &&
    providerConfig.enabled === true
  );
  const allowedProviders = Array.isArray(providerConfig.allowedProviders)
    ? providerConfig.allowedProviders.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : ['openai', 'anthropic', 'google', 'ollama'];
  const deniedProviders = new Set(
    Array.isArray(providerConfig.deniedProviders)
      ? providerConfig.deniedProviders.filter((value): value is string => typeof value === 'string')
      : []
  );

  const providerCatalog: ToolCatalogItem[] = providerEnabled
    ? allowedProviders
      .filter((provider) => !deniedProviders.has(provider))
      .map((provider) => {
        const toolName = `provider.${provider}.nativeTools`;
        return {
          name: toolName,
          description: `Native ${provider} provider tools`,
          source: 'provider',
          enabled: isToolEnabledByPolicy(toolName, policy)
        };
      })
    : [];

  const builtinCatalog = BUILTIN_TOOL_CATALOG.map((tool) => ({
    ...tool,
    enabled: isToolEnabledByPolicy(tool.name, policy)
  }));

  return {
    agentId: agent.id,
    tools: [...builtinCatalog, ...mcpCatalog, ...providerCatalog],
    policy,
    mcpServers: declaredServers
  };
}

async function buildTools(
  task: Task,
  agentConfig: Record<string, unknown>,
  traceContext: Awaited<ReturnType<typeof createAgentTrace>> | null,
  governancePolicy?: GovernancePolicy
): Promise<Record<string, any>> {
  const emitToolEvent = (type: 'tool.call' | 'tool.result' | 'tool.error', payload: Record<string, unknown>): void => {
    if (!task.runId || !task.conversationId) {
      return;
    }

    appendRunEvent({
      runId: task.runId,
      conversationId: task.conversationId,
      type,
      payload
    });
  };

  const baseTools = {
    readSharedMemory: tool({
      description: 'Read a value from shared memory by key.',
      inputSchema: zodSchema(z.object({
        key: z.string().describe('The memory key to lookup.')
      })),
      execute: async ({ key }: { key: string }) => {
        const toolStartTime = Date.now();
        const val = await getValue(key);
        const output = { value: val || 'No data found for this key.' };

        if (traceContext) {
          traceContext.logToolCall({
            toolName: 'readSharedMemory',
            input: { key },
            output,
            startTime: toolStartTime,
            endTime: Date.now()
          });
        }

        return output;
      }
    }),
    writeSharedMemory: tool({
      description: 'Write a value into shared memory by key.',
      inputSchema: zodSchema(z.object({
        key: z.string().describe('The memory key to write to.'),
        value: z.string().describe('The content to store.')
      })),
      execute: async ({ key, value }: { key: string; value: string }) => {
        const toolStartTime = Date.now();
        await setValue(key, value);
        const output = { status: 'success', message: `Saved to ${key}` };

        if (traceContext) {
          traceContext.logToolCall({
            toolName: 'writeSharedMemory',
            input: { key, value },
            output,
            startTime: toolStartTime,
            endTime: Date.now()
          });
        }

        return output;
      }
    }),
    readTieredMemory: tool({
      description: 'Read value from a memory tier (working|episodic|shared).',
      inputSchema: zodSchema(z.object({
        tier: z.enum(['working', 'episodic', 'shared']),
        key: z.string()
      })),
      execute: async ({ tier, key }: { tier: 'working' | 'episodic' | 'shared'; key: string }) => {
        const val = await getTieredValue(tier, key);
        return { value: val || 'No data found for this key.' };
      }
    }),
    writeTieredMemory: tool({
      description: 'Write value to a memory tier (working|episodic|shared).',
      inputSchema: zodSchema(z.object({
        tier: z.enum(['working', 'episodic', 'shared']),
        key: z.string(),
        value: z.string(),
        ttl: z.number().optional()
      })),
      execute: async (
        { tier, key, value, ttl }: { tier: 'working' | 'episodic' | 'shared'; key: string; value: string; ttl?: number }
      ) => {
        await setTieredValue(tier, key, value, ttl);
        return { status: 'success', message: `Saved to ${tier}:${key}` };
      }
    }),
    createOrchestrationPlan: tool({
      description: 'Create and start a multi-step orchestration plan from an objective.',
      inputSchema: zodSchema(z.object({
        objective: z.string().describe('High-level objective to execute through multiple steps.'),
        defaultAgentId: z.string().optional().describe('Agent ID to run steps. Defaults to the current task agent.'),
        stepPrompts: z.array(z.string()).optional().describe('Optional explicit prompts for each orchestration step.'),
        maxSteps: z.number().int().min(2).max(10).optional().describe('Optional limit for auto-generated steps.')
      })),
      execute: async (
        {
          objective,
          defaultAgentId,
          stepPrompts,
          maxSteps
        }: {
          objective: string;
          defaultAgentId?: string;
          stepPrompts?: string[];
          maxSteps?: number;
        }
      ) => {
        const summary = await createAndStartPlan({
          objective,
          defaultAgentId: defaultAgentId ?? task.agentId,
          stepPrompts,
          maxSteps,
          conversationId: task.conversationId,
          runId: task.runId,
          metadata: {
            createdByTaskId: task.id,
            origin: 'createOrchestrationPlanTool',
            workspaceId: task.workspaceId
          }
        });

        return {
          status: 'started',
          ...summary
        };
      }
    }),
    finalAnswer: tool({
      description: 'Provide the final answer to the user. Use this tool when the task is complete.',
      inputSchema: zodSchema(z.object({
        answer: z.string().describe('The final answer to provide to the user.')
      })),
      execute: async ({ answer }: { answer: string }) => {
        return { answer };
      }
    })
  };

  const mcpTools = await loadMcpTools(agentConfig);
  const merged = { ...baseTools, ...mcpTools };
  const policy = getToolPolicy(agentConfig);

  const flags = getFeatureFlags();
  const governanceEnabled = flags.FEATURE_APPROVAL_GATES && governancePolicy?.enabled;
  const toolsWithGovernance = governanceEnabled
    ? Object.fromEntries(
      Object.entries(merged).map(([toolName, toolDef]) => [
        toolName,
        {
          ...toolDef,
          execute: async (args: Record<string, unknown>) => {
            const executeFn = toolDef?.execute as ((input: Record<string, unknown>) => Promise<unknown>) | undefined;
            if (!executeFn) {
              throw new Error(`Tool ${toolName} is missing execute function`);
            }

            if (!requiresApproval(toolName, governancePolicy) || !task.runId || !task.conversationId) {
              return executeFn(args);
            }

            const approval = await requestApproval(toolName, args, {
              runId: task.runId,
              conversationId: task.conversationId,
              reason: `Execution of ${toolName} requires approval`,
              policy: governancePolicy
            });

            if (!approval.approved) {
              throw new Error(`Tool ${toolName} execution denied (approval ${approval.approvalId})`);
            }

            return executeFn(args);
          }
        }
      ])
    )
    : merged;

  return applyToolPolicies(task.id, toolsWithGovernance, policy, {
    onToolStart: (toolName, input) => {
      emitToolEvent('tool.call', { toolName, input });
    },
    onToolResult: (toolName, output) => {
      emitToolEvent('tool.result', { toolName, output });
    },
    onToolError: (toolName, error) => {
      emitToolEvent('tool.error', { toolName, error });
    }
  });
}

function extractFinalMessage(result: any): string {
  let text = result.text || '';

  if (!text && result.steps && result.steps.length > 0) {
    const lastStep = result.steps[result.steps.length - 1];
    if (lastStep?.result?.text) {
      text = lastStep.result.text;
    } else if (lastStep?.result?.answer) {
      text = lastStep.result.answer;
    }
  }

  if (!text && result.toolResults && result.toolResults.length > 0) {
    const finalAnswerResult = result.toolResults.find((toolResult: any) => toolResult.toolName === 'finalAnswer');
    if (finalAnswerResult?.output?.answer) {
      text = finalAnswerResult.output.answer;
    }
  }

  return text;
}

function resolveDefaultModel(): string {
  if (process.env.AI_GATEWAY_API_KEY) {
    return process.env.DEFAULT_MODEL || 'gpt-4o-mini';
  }

  return process.env.DEFAULT_MODEL || 'gpt-4o-mini';
}

function resolveModelName(agentModel: unknown): string {
  const configuredModel = typeof agentModel === 'string' ? agentModel : resolveDefaultModel();

  if (!process.env.AI_GATEWAY_API_KEY && configuredModel === 'openai/o4-mini') {
    return 'gpt-4o-mini';
  }

  return configuredModel;
}

function hasModelCredentials(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY);
}

function allowMockFallback(): boolean {
  return process.env.MOCK_AGENT_FALLBACK !== 'false';
}

function normalizeExecutionMode(value: unknown): TaskExecutionMode | undefined {
  if (value === 'claude_cli' || value === 'tool_loop') {
    return value;
  }

  return undefined;
}

function resolveTaskExecutionMode(task: Task, agentConfig: Record<string, unknown>): TaskExecutionMode {
  const taskDataMode = normalizeExecutionMode((task.data as { executionMode?: unknown }).executionMode);
  const taskMode = normalizeExecutionMode(task.executionMode);
  const agentMode = normalizeExecutionMode(agentConfig.executionMode);

  return taskMode ?? taskDataMode ?? agentMode ?? 'tool_loop';
}

function resolveExecutionProfile(task: Task): ExecutionProfile {
  const profile = (task.data as { executionProfile?: unknown }).executionProfile;
  if (profile === 'deep_research') {
    return 'deep_research';
  }
  return 'standard';
}

function resolveResearchConfig(task: Task): ResearchConfig | undefined {
  const research = (task.data as { research?: unknown }).research;
  if (!research || typeof research !== 'object') {
    return undefined;
  }

  const raw = research as Record<string, unknown>;
  const depth = raw.depth;
  if (depth !== 'quick' && depth !== 'standard' && depth !== 'deep') {
    return undefined;
  }

  return {
    depth,
    parallelism: typeof raw.parallelism === 'number' ? raw.parallelism : undefined,
    requireCitations: typeof raw.requireCitations === 'boolean' ? raw.requireCitations : undefined,
    maxSources: typeof raw.maxSources === 'number' ? raw.maxSources : undefined
  };
}

async function executeMockTask(task: Task): Promise<{
  message: string;
  finishReason: string;
  metadata: Record<string, unknown>;
}> {
  const prompt = typeof task.data.prompt === 'string' ? task.data.prompt : JSON.stringify(task.data);
  const normalizedPrompt = prompt.toLowerCase();
  let toolCalls = 0;
  let message = `Mock execution completed: ${prompt.slice(0, 200)}`;

  const maybeMemoryKey = prompt.match(/key\\s+([a-zA-Z0-9._:-]+)/i)?.[1];
  const greetingValue = 'Hello from the orchestrator demo.';

  if (normalizedPrompt.includes('writesharedmemory') || normalizedPrompt.includes('shared memory')) {
    const key = maybeMemoryKey ?? 'mock.default';

    if (task.runId && task.conversationId) {
      appendRunEvent({
        runId: task.runId,
        conversationId: task.conversationId,
        type: 'tool.call',
        payload: {
          toolName: 'writeSharedMemory',
          input: { key, value: greetingValue }
        }
      });
    }

    await setValue(key, greetingValue);
    toolCalls += 1;

    if (task.runId && task.conversationId) {
      appendRunEvent({
        runId: task.runId,
        conversationId: task.conversationId,
        type: 'tool.result',
        payload: {
          toolName: 'writeSharedMemory',
          output: { status: 'success', message: `Saved to ${key}` }
        }
      });
    }

    message = `Stored greeting in shared memory at ${key}: ${greetingValue}`;
  } else if (normalizedPrompt.includes('create') && normalizedPrompt.includes('plan')) {
    const summary = await createAndStartPlan({
      objective: prompt,
      defaultAgentId: task.agentId,
      conversationId: task.conversationId,
      runId: task.runId,
      metadata: {
        createdByTaskId: task.id,
        origin: 'mockExecution',
        workspaceId: task.workspaceId
      }
    });

    toolCalls += 1;
    message = `Created plan ${summary.planId} with ${summary.totalSteps} steps.`;
  }

  return {
    message,
    finishReason: 'mock-fallback',
    metadata: {
      model: 'mock-agent',
      steps: 1,
      toolCalls,
      mockFallback: true
    }
  };
}

/**
 * Execute an agent task using ToolLoopAgent for multi-step tool execution.
 * Now integrates model routing (WP-02), evaluator loop (WP-08),
 * deep research (WP-04), and governance (WP-09).
 */
export async function executeAgentTask(task: Task): Promise<any> {
  const agent = getAgent(task.agentId);

  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }

  const agentConfig = agent.config as Record<string, unknown>;
  const executionMode = resolveTaskExecutionMode(task, agentConfig);
  if (executionMode === 'claude_cli') {
    return executeClaudeCliTask(task, agentConfig);
  }

  const systemPrompt = typeof agent.config.systemPrompt === 'string'
    ? agent.config.systemPrompt
    : "You are a helpful and expert AI assistant. Please complete the user's task to the best of your ability.";

  const temperature = typeof agent.config.temperature === 'number' ? agent.config.temperature : 0.7;
  const userPrompt = typeof task.data.prompt === 'string'
    ? task.data.prompt
    : JSON.stringify(task.data);

  // WP-04: Check for deep research execution profile
  const executionProfile = resolveExecutionProfile(task);
  const researchConfig = resolveResearchConfig(task);
  const flags = getFeatureFlags();

  if (executionProfile === 'deep_research' && flags.FEATURE_DEEP_RESEARCH && researchConfig) {
    // Execute deep research pipeline before standard execution
    if (task.runId && task.conversationId) {
      const artifacts = await executeDeepResearch(userPrompt, researchConfig, {
        runId: task.runId,
        conversationId: task.conversationId
      });

      // Store artifacts in run metadata for later retrieval
      return {
        message: `Deep research completed with ${artifacts.sources?.length ?? 0} sources and ${artifacts.findings?.length ?? 0} findings. Overall confidence: ${(artifacts.confidenceSummary?.overall ?? 0).toFixed(2)}`,
        finishReason: 'deep_research_complete',
        metadata: {
          executionProfile: 'deep_research',
          sourceCount: artifacts.sources?.length ?? 0,
          findingCount: artifacts.findings?.length ?? 0,
          overallConfidence: artifacts.confidenceSummary?.overall,
          artifacts
        }
      };
    }
  }

  // WP-02: Resolve model via routing service
  const modelRoutingConfig = typeof agentConfig.modelRouting === 'object' && agentConfig.modelRouting
    ? agentConfig.modelRouting as any
    : undefined;

  const configuredModel = typeof agent.config.model === 'string'
    ? resolveModelName(agent.config.model)
    : undefined;
  const routeDecision = selectModel(
    userPrompt,
    modelRoutingConfig,
    modelRoutingConfig ? undefined : configuredModel
  );

  const modelName = resolveModelName(routeDecision.selectedModel);

  // Log route decision
  logRouteDecision(routeDecision, {
    runId: task.runId,
    conversationId: task.conversationId
  });

  if (!hasModelCredentials() && allowMockFallback()) {
    return executeMockTask(task);
  }

  const traceEnabled = isTracingEnabled();
  let traceContext: Awaited<ReturnType<typeof createAgentTrace>> | null = null;

  if (traceEnabled) {
    traceContext = await createAgentTrace(
      {
        agentId: task.agentId,
        taskId: task.id,
        model: modelName,
        temperature
      },
      userPrompt
    );
  }

  const governancePolicy = getGovernancePolicy(agentConfig);
  const combinedTools = await buildTools(task, agentConfig, traceContext, governancePolicy);

  const toolAgent = new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: combinedTools,
    temperature,
    stopWhen: hasToolCall('finalAnswer')
  });

  try {
    const result = await toolAgent.generate({ prompt: userPrompt }) as any;
    let text = extractFinalMessage(result);
    const finishReason = result.finishReason;

    // WP-08: Evaluator loop
    const evaluationPolicy = getEvaluationPolicy(agentConfig);
    let evaluatorMetadata: Record<string, unknown> = {};

    if (flags.FEATURE_EVALUATOR_LOOP && evaluationPolicy.enabled && text) {
      const evalResult = await evaluateOutput(text, userPrompt, evaluationPolicy, {
        runId: task.runId,
        conversationId: task.conversationId
      });

      evaluatorMetadata = {
        evaluatorScore: evalResult.score,
        evaluatorPassed: evalResult.passed,
        evaluatorFeedback: evalResult.feedback,
        evaluatorCriteria: evalResult.criteria
      };

      if (!evalResult.passed) {
        evaluatorMetadata.evaluatorFailed = true;
      }
    }

    let traceMetadata: Record<string, unknown> = {};

    if (traceContext) {
      const toolCallsForTrace = result.toolResults?.map((toolResult: any) => ({
        name: toolResult.toolName,
        input: toolResult.input as Record<string, unknown>,
        output: toolResult.output
      })) || [];

      const traceResult = await traceContext.completeTrace({
        response: text,
        toolCalls: toolCallsForTrace,
        usage: {
          promptTokens: result.usage?.inputTokens || 0,
          completionTokens: result.usage?.outputTokens || 0
        },
        finishReason
      });

      traceMetadata = formatTraceMetadata(traceResult);
    }

    return {
      message: text,
      finishReason,
      metadata: {
        model: modelName,
        steps: result.steps?.length || 0,
        toolCalls: result.toolCalls?.length || 0,
        routeDecision: {
          selectedModel: routeDecision.selectedModel,
          reason: routeDecision.reason,
          taskClass: routeDecision.taskClass
        },
        ...evaluatorMetadata,
        ...traceMetadata
      }
    };
  } finally {
    clearTaskToolBudget(task.id);
  }
}

/**
 * Stream agent task execution using ToolLoopAgent.
 */
export async function streamAgentTask(task: Task): Promise<any> {
  const agent = getAgent(task.agentId);

  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }

  const agentConfig = agent.config as Record<string, unknown>;
  const executionMode = resolveTaskExecutionMode(task, agentConfig);
  if (executionMode === 'claude_cli') {
    const result = await executeClaudeCliTask(task, agentConfig);
    return {
      text: result.stdout || result.message,
      finishReason: result.finishReason,
      steps: [
        {
          result: {
            text: result.stdout || result.message
          }
        }
      ],
      toolCalls: [],
      metadata: result.metadata
    };
  }

  const systemPrompt = typeof agent.config.systemPrompt === 'string'
    ? agent.config.systemPrompt
    : "You are a helpful and expert AI assistant. Please complete the user's task to the best of your ability.";

  const temperature = typeof agent.config.temperature === 'number' ? agent.config.temperature : 0.7;

  // WP-02: Use model routing for streaming too
  const modelRoutingConfig = typeof agentConfig.modelRouting === 'object' && agentConfig.modelRouting
    ? agentConfig.modelRouting as any
    : undefined;

  const userPrompt = typeof task.data.prompt === 'string' ? task.data.prompt : JSON.stringify(task.data);
  const configuredModel = typeof agent.config.model === 'string'
    ? resolveModelName(agent.config.model)
    : undefined;
  const routeDecision = selectModel(
    userPrompt,
    modelRoutingConfig,
    modelRoutingConfig ? undefined : configuredModel
  );
  const modelName = resolveModelName(routeDecision.selectedModel);

  logRouteDecision(routeDecision, {
    runId: task.runId,
    conversationId: task.conversationId
  });

  if (!hasModelCredentials() && allowMockFallback()) {
    const mock = await executeMockTask(task);
    return {
      text: mock.message,
      finishReason: mock.finishReason,
      steps: [
        {
          result: {
            text: mock.message
          }
        }
      ],
      toolCalls: [],
      metadata: mock.metadata
    };
  }

  const combinedTools = await buildTools(task, agentConfig, null);

  const toolAgent = new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: combinedTools,
    temperature,
    stopWhen: hasToolCall('finalAnswer')
  });

  return toolAgent.stream({ prompt: userPrompt });
}
