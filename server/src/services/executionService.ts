/**
 * ExecutionService - Handles LLM interactions and tool-loop execution.
 * Adds tool governance, memory tier access, and trace/metrics integration.
 */

import { ToolLoopAgent, hasToolCall, tool, zodSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getAgent } from './agentService';
import { Task, TaskExecutionMode, ToolPolicy } from '../../types';
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
import dotenv from 'dotenv';

dotenv.config();

interface ToolCatalogItem {
  name: string;
  description: string;
  source: 'builtin' | 'mcp';
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

  const builtinCatalog = BUILTIN_TOOL_CATALOG.map((tool) => ({
    ...tool,
    enabled: isToolEnabledByPolicy(tool.name, policy)
  }));

  return {
    agentId: agent.id,
    tools: [...builtinCatalog, ...mcpCatalog],
    policy,
    mcpServers: declaredServers
  };
}

async function buildTools(
  task: Task,
  agentConfig: Record<string, unknown>,
  traceContext: Awaited<ReturnType<typeof createAgentTrace>> | null
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
            origin: 'createOrchestrationPlanTool'
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

  return applyToolPolicies(task.id, merged, policy, {
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
        origin: 'mockExecution'
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
  const modelName = resolveModelName(agent.config.model);

  const userPrompt = typeof task.data.prompt === 'string'
    ? task.data.prompt
    : JSON.stringify(task.data);

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

  const combinedTools = await buildTools(task, agentConfig, traceContext);

  const toolAgent = new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: combinedTools,
    temperature,
    stopWhen: hasToolCall('finalAnswer')
  });

  try {
    const result = await toolAgent.generate({ prompt: userPrompt }) as any;
    const text = extractFinalMessage(result);
    const finishReason = result.finishReason;

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
  const modelName = resolveModelName(agent.config.model);
  const userPrompt = typeof task.data.prompt === 'string' ? task.data.prompt : JSON.stringify(task.data);

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
