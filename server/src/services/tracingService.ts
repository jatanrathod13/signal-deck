/**
 * TracingService - LangSmith Integration for Agent Observability
 * Provides full observability for agent execution including tool calls, costs, and traces.
 */

import { Client } from 'langsmith';
import dotenv from 'dotenv';
dotenv.config();

export interface TraceMetadata {
  agentId: string;
  taskId: string;
  model: string;
  temperature: number;
}

export interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  startTime: number;
  endTime: number;
}

export interface CostMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCost?: number;
}

export interface TraceResult {
  traceUrl?: string;
  runId: string;
  costMetrics: CostMetrics;
  toolCalls: ToolCallTrace[];
}

/**
 * Type for LangSmith run inputs/outputs
 */
type LangSmithKVMap = Record<string, unknown>;

/**
 * Pricing per 1M tokens (USD) for common models
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'default': { input: 2.5, output: 10.0 }
};

/**
 * Calculate estimated cost based on tokens and model
 */
function calculateCost(tokens: CostMetrics, model: string): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (tokens.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Get LangSmith client instance (singleton)
 */
let langsmithClient: Client | null = null;

function getClient(): Client | null {
  const apiKey = process.env.LANGSMITH_API_KEY;

  if (!apiKey || apiKey === 'your_langsmith_api_key') {
    console.warn('[Tracing] LangSmith API key not configured. Tracing disabled.');
    return null;
  }

  if (!langsmithClient) {
    langsmithClient = new Client({
      apiKey,
    });
  }

  return langsmithClient;
}

/**
 * Check if LangSmith tracing is enabled
 */
export function isTracingEnabled(): boolean {
  const enabled = process.env.LANGSMITH_TRACING === 'true';
  const hasApiKey = !!process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_API_KEY !== 'your_langsmith_api_key';

  return enabled && hasApiKey;
}

/**
 * Get the LangSmith project name
 */
export function getProjectName(): string {
  return process.env.LANGSMITH_PROJECT || 'agent-orchestration';
}

/**
 * Generate a unique run ID for tracking
 */
function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get trace URL for a run
 */
function getTraceUrl(runId: string): string {
  const project = getProjectName();
  return `https://smith.langchain.com/projects/${project}/runs/${runId}`;
}

/**
 * Create a trace for agent execution
 * Returns trace context with methods to log tool calls and complete trace
 */
export async function createAgentTrace(
  metadata: TraceMetadata,
  prompt: string
): Promise<{
  runId: string;
  logToolCall: (toolCall: ToolCallTrace) => void;
  completeTrace: (result: {
    response: string;
    toolCalls: Array<{ name: string; input: Record<string, unknown>; output: unknown }>;
    usage?: { promptTokens: number; completionTokens: number };
    finishReason: string;
  }) => Promise<TraceResult>;
} | null> {
  const client = getClient();

  if (!client || !isTracingEnabled()) {
    // Return a no-op trace context if tracing is disabled
    const noOpRunId = generateRunId();
    return {
      runId: noOpRunId,
      logToolCall: () => { /* no-op */ },
      completeTrace: async () => ({
        runId: noOpRunId,
        costMetrics: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: 0
        },
        toolCalls: []
      })
    };
  }

  const startTime = Date.now();
  const runId = generateRunId();

  try {
    // Create the root run for agent execution
    const run = {
      name: `agent-${metadata.agentId}`,
      run_type: 'chain',
      inputs: {
        prompt,
        agentId: metadata.agentId,
        taskId: metadata.taskId,
        model: metadata.model,
        temperature: metadata.temperature
      } as LangSmithKVMap,
      start_time: startTime
    };

    await client.createRun(run as any);

    const loggedToolCalls: ToolCallTrace[] = [];

    return {
      runId,
      logToolCall: (toolCall: ToolCallTrace) => {
        loggedToolCalls.push(toolCall);

        // Log tool call as a child run
        client?.createRun({
          name: toolCall.toolName,
          run_type: 'tool',
          parent_run_id: runId,
          inputs: toolCall.input as LangSmithKVMap,
          outputs: toolCall.output as LangSmithKVMap,
          start_time: toolCall.startTime,
          end_time: toolCall.endTime
        } as any).catch(err => console.error('[Tracing] Error logging tool call:', err));
      },
      completeTrace: async (result) => {
        const endTime = Date.now();
        const latencyMs = endTime - startTime;

        const usage = result.usage || { promptTokens: 0, completionTokens: 0 };

        const costMetrics: CostMetrics = {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.promptTokens + usage.completionTokens,
          latencyMs
        };

        // Calculate estimated cost
        costMetrics.estimatedCost = calculateCost(costMetrics, metadata.model);

        // Update the root run with final output
        try {
          await client.updateRun(runId, {
            outputs: {
              response: result.response,
              finishReason: result.finishReason,
              toolCalls: result.toolCalls.map(tc => tc.name)
            } as LangSmithKVMap,
            end_time: endTime,
            error: result.finishReason === 'error' ? 'Agent execution failed' : undefined
          } as any);
        } catch (err) {
          console.error('[Tracing] Error updating run:', err);
        }

        return {
          traceUrl: getTraceUrl(runId),
          runId,
          costMetrics,
          toolCalls: loggedToolCalls
        };
      }
    };
  } catch (error) {
    console.error('[Tracing] Error creating trace:', error);
    return null;
  }
}

/**
 * Simplified wrapper to enable LangSmith tracing with Vercel AI SDK
 * Returns provider options to pass to generateText/streamText
 */
export function getTracingProviderOptions() {
  if (!isTracingEnabled()) {
    return {};
  }

  return {
    headers: {
      'LangSmith-Dedupe': 'true',
      'LangSmith-Project': getProjectName(),
    }
  };
}

/**
 * Format trace result for response metadata
 */
export function formatTraceMetadata(result: TraceResult): Record<string, unknown> {
  return {
    traceUrl: result.traceUrl,
    runId: result.runId,
    tokens: {
      prompt: result.costMetrics.promptTokens,
      completion: result.costMetrics.completionTokens,
      total: result.costMetrics.totalTokens
    },
    latency: {
      ms: result.costMetrics.latencyMs
    },
    cost: {
      usd: result.costMetrics.estimatedCost
    },
    toolCalls: result.toolCalls.length
  };
}
