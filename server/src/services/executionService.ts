/**
 * ExecutionService - Handles LLM interactions and tool-loop execution.
 * Adds tool governance, memory tier access, and trace/metrics integration.
 */

import { ToolLoopAgent, hasToolCall, tool, zodSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getAgent } from './agentService';
import { Task, ToolPolicy } from '../../types';
import {
  getTieredValue,
  getValue,
  setTieredValue,
  setValue
} from './sharedMemoryService';
import { getMcpToolsForAgent, getMcpToolsFromServers } from './mcpClientService';
import { createAgentTrace, formatTraceMetadata, isTracingEnabled } from './tracingService';
import { applyToolPolicies, clearTaskToolBudget } from './toolPolicyService';
import dotenv from 'dotenv';

dotenv.config();

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

async function buildTools(
  task: Task,
  agentConfig: Record<string, unknown>,
  traceContext: Awaited<ReturnType<typeof createAgentTrace>> | null
): Promise<Record<string, any>> {
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

  return applyToolPolicies(task.id, merged, policy);
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

/**
 * Execute an agent task using ToolLoopAgent for multi-step tool execution.
 */
export async function executeAgentTask(task: Task): Promise<any> {
  const agent = getAgent(task.agentId);

  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }

  const systemPrompt = typeof agent.config.systemPrompt === 'string'
    ? agent.config.systemPrompt
    : "You are a helpful and expert AI assistant. Please complete the user's task to the best of your ability.";

  const temperature = typeof agent.config.temperature === 'number' ? agent.config.temperature : 0.7;
  const modelName = typeof agent.config.model === 'string' ? agent.config.model : 'gpt-4o';

  const userPrompt = typeof task.data.prompt === 'string'
    ? task.data.prompt
    : JSON.stringify(task.data);

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

  const combinedTools = await buildTools(task, agent.config as Record<string, unknown>, traceContext);

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

  const systemPrompt = typeof agent.config.systemPrompt === 'string'
    ? agent.config.systemPrompt
    : "You are a helpful and expert AI assistant. Please complete the user's task to the best of your ability.";

  const temperature = typeof agent.config.temperature === 'number' ? agent.config.temperature : 0.7;
  const modelName = typeof agent.config.model === 'string' ? agent.config.model : 'gpt-4o';
  const userPrompt = typeof task.data.prompt === 'string' ? task.data.prompt : JSON.stringify(task.data);

  const combinedTools = await buildTools(task, agent.config as Record<string, unknown>, null);

  const toolAgent = new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: combinedTools,
    temperature,
    stopWhen: hasToolCall('finalAnswer')
  });

  return toolAgent.stream({ prompt: userPrompt });
}
