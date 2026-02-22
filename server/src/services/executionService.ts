/**
 * ExecutionService - Handles actual LLM Interaction
 * Uses Vercel AI SDK with ToolLoopAgent for multi-step tool execution.
 */

import { ToolLoopAgent, hasToolCall, tool, zodSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getAgent } from './agentService';
import { Task } from '../../types';
import { getValue, setValue } from './sharedMemoryService';
import { getMcpToolsForAgent, getMcpToolsFromServers } from './mcpClientService';
import { createAgentTrace, formatTraceMetadata, isTracingEnabled } from './tracingService';
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

  // Backward compatibility for previous single-server config key
  const legacyMcpUrl = typeof config.mcpServer === 'string'
    ? config.mcpServer
    : undefined;

  return legacyMcpUrl ? getMcpToolsForAgent(legacyMcpUrl) : {};
}

/**
 * Execute an agent task using ToolLoopAgent for multi-step tool execution
 */
export async function executeAgentTask(task: Task): Promise<any> {
  const agent = getAgent(task.agentId);

  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }

  // Extract config
  const systemPrompt = typeof agent.config.systemPrompt === 'string'
    ? agent.config.systemPrompt
    : "You are a helpful and expert AI assistant. Please complete the user's task to the best of your ability.";

  const temperature = typeof agent.config.temperature === 'number' ? agent.config.temperature : 0.7;

  // Prefer model defined in agent config, fallback to default
  const modelName = typeof agent.config.model === 'string' ? agent.config.model : 'gpt-4o';

  // Format the user prompt
  const userPrompt = typeof task.data.prompt === 'string'
    ? task.data.prompt
    : JSON.stringify(task.data);

  // Setup Base Tools (Shared Memory) using the 'tool' function from AI SDK
  const baseTools = {
    readSharedMemory: tool({
      description: 'Read a value from the shared memory store. Use this to retrieve context left by other agents or previous tasks.',
      inputSchema: zodSchema(z.object({
        key: z.string().describe('The memory key to lookup.')
      })),
      execute: async ({ key }: { key: string }) => {
        const toolStartTime = Date.now();
        const val = await getValue(key);
        const toolEndTime = Date.now();

        // Log tool call if tracing is enabled
        if (traceContext) {
          traceContext.logToolCall({
            toolName: 'readSharedMemory',
            input: { key },
            output: { value: val || 'No data found for this key.' },
            startTime: toolStartTime,
            endTime: toolEndTime
          });
        }

        return { value: val || 'No data found for this key.' };
      }
    }),
    writeSharedMemory: tool({
      description: 'Write a value into the shared memory store. Use this to leave context or pass payloads to other agents/tasks.',
      inputSchema: zodSchema(z.object({
        key: z.string().describe('The memory key to write to.'),
        value: z.string().describe('The content to store.')
      })),
      execute: async ({ key, value }: { key: string; value: string }) => {
        const toolStartTime = Date.now();
        await setValue(key, value);
        const toolEndTime = Date.now();

        // Log tool call if tracing is enabled
        if (traceContext) {
          traceContext.logToolCall({
            toolName: 'writeSharedMemory',
            input: { key, value },
            output: { status: 'success', message: `Saved to ${key}` },
            startTime: toolStartTime,
            endTime: toolEndTime
          });
        }

        return { status: 'success', message: `Saved to ${key}` };
      }
    }),
    // finalAnswer tool to signal completion
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

  // Add Dynamic MCP Tools if configured
  const mcpTools: Record<string, any> = await loadMcpTools(
    agent.config as Record<string, unknown>
  );

  const combinedTools = { ...baseTools, ...mcpTools };

  // Create trace context if tracing is enabled
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

  // Create ToolLoopAgent with model, instructions, tools, and stop condition
  const toolAgent = new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: combinedTools,
    temperature,
    stopWhen: hasToolCall('finalAnswer')
  });

  // Execute using agent.generate()
  const result = await toolAgent.generate({
    prompt: userPrompt
  }) as any;

  // Extract the text from the result
  // ToolLoopAgent might return text in different places depending on execution
  let text = result.text || '';

  // If text is empty, check steps for content
  if (!text && result.steps && result.steps.length > 0) {
    // Try to get text from the last step's result
    const lastStep = result.steps[result.steps.length - 1];
    if (lastStep?.result?.text) {
      text = lastStep.result.text;
    } else if (lastStep?.result?.answer) {
      // Check for answer from finalAnswer tool
      text = lastStep.result.answer;
    }
  }

  // If still empty, check toolResults for finalAnswer
  if (!text && result.toolResults && result.toolResults.length > 0) {
    const finalAnswerResult = result.toolResults.find(
      (tr: any) => tr.toolName === 'finalAnswer'
    );
    if (finalAnswerResult?.output?.answer) {
      text = finalAnswerResult.output.answer;
    }
  }

  // Determine finish reason based on tool calls
  const finishReason = result.finishReason;

  // Complete the trace and get metrics
  let traceMetadata: Record<string, unknown> = {};

  if (traceContext) {
    // Map tool results to get tool call outputs
    const toolCallsForTrace = result.toolResults?.map((tr: any) => ({
      name: tr.toolName,
      input: tr.input as Record<string, unknown>,
      output: tr.output
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
}

/**
 * Stream agent task execution using ToolLoopAgent
 * Provides real-time streaming of agent execution
 */
export async function streamAgentTask(task: Task): Promise<any> {
  const agent = getAgent(task.agentId);

  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }

  // Extract config
  const systemPrompt = typeof agent.config.systemPrompt === 'string'
    ? agent.config.systemPrompt
    : "You are a helpful and expert AI assistant. Please complete the user's task to the best of your ability.";

  const temperature = typeof agent.config.temperature === 'number' ? agent.config.temperature : 0.7;

  // Prefer model defined in agent config, fallback to default
  const modelName = typeof agent.config.model === 'string' ? agent.config.model : 'gpt-4o';

  // Format the user prompt
  const userPrompt = typeof task.data.prompt === 'string'
    ? task.data.prompt
    : JSON.stringify(task.data);

  // Setup Base Tools (Shared Memory) using the 'tool' function from AI SDK
  const baseTools = {
    readSharedMemory: tool({
      description: 'Read a value from the shared memory store. Use this to retrieve context left by other agents or previous tasks.',
      inputSchema: zodSchema(z.object({
        key: z.string().describe('The memory key to lookup.')
      })),
      execute: async ({ key }: { key: string }) => {
        const val = await getValue(key);
        return { value: val || 'No data found for this key.' };
      }
    }),
    writeSharedMemory: tool({
      description: 'Write a value into the shared memory store. Use this to leave context or pass payloads to other agents/tasks.',
      inputSchema: zodSchema(z.object({
        key: z.string().describe('The memory key to write to.'),
        value: z.string().describe('The content to store.')
      })),
      execute: async ({ key, value }: { key: string; value: string }) => {
        await setValue(key, value);
        return { status: 'success', message: `Saved to ${key}` };
      }
    }),
    // finalAnswer tool to signal completion
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

  // Add Dynamic MCP Tools if configured
  const mcpTools: Record<string, any> = await loadMcpTools(
    agent.config as Record<string, unknown>
  );

  const combinedTools = { ...baseTools, ...mcpTools };

  // Create ToolLoopAgent with model, instructions, tools, and stop condition
  const toolAgent = new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: combinedTools,
    temperature,
    stopWhen: hasToolCall('finalAnswer')
  });

  // Stream using agent.stream()
  const streamResult = await toolAgent.stream({
    prompt: userPrompt
  });

  // Return the stream result directly - it has text, finishReason, etc.
  // The consumer can iterate over streamResult.text as a TextStream
  return streamResult;
}
