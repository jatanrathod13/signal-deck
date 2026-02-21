/**
 * ExecutionService - Handles actual LLM Interaction
 * Uses Vercel AI SDK to communicate with OpenAI.
 */

import { generateText, tool as aiTool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getAgent } from './agentService';
import { Task } from '../../types';
import { getValue, setValue } from './sharedMemoryService';
import { getMcpToolsForAgent } from './mcpClientService';
import dotenv from 'dotenv';
dotenv.config();

export async function executeAgentTask(task: Task): Promise<any> {
  const agent = getAgent(task.agentId);

  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }

  // Extract config
  const systemPrompt = typeof agent.config.systemPrompt === 'string'
    ? agent.config.systemPrompt
    : "You are a helpful and expert AI assistant. Please complete the user's task to the best of your ability.";

  const maxTokens = typeof agent.config.maxTokens === 'number' ? agent.config.maxTokens : undefined;
  const temperature = typeof agent.config.temperature === 'number' ? agent.config.temperature : 0.7;

  // Prefer model defined in agent config, fallback to default
  const modelName = typeof agent.config.model === 'string' ? agent.config.model : 'gpt-4o';
  
  // Format the user prompt
  const userPrompt = typeof task.data.prompt === 'string'
    ? task.data.prompt
    : JSON.stringify(task.data);

  // Setup Base Tools (Shared Memory)
  const baseTools: Record<string, any> = {
    readSharedMemory: {
      type: 'function',
      description: 'Read a value from the shared memory store. Use this to retrieve context left by other agents or previous tasks.',
      parameters: z.object({
        key: z.string().describe('The memory key to lookup.')
      }),
      execute: async ({ key }: { key: string }) => {
        const val = await getValue(key);
        return { value: val || 'No data found for this key.' };
      }
    },
    writeSharedMemory: {
      type: 'function',
      description: 'Write a value into the shared memory store. Use this to leave context or pass payloads to other agents/tasks.',
      parameters: z.object({
        key: z.string().describe('The memory key to write to.'),
        value: z.string().describe('The content to store.')
      }),
      execute: async ({ key, value }: { key: string; value: string }) => {
        await setValue(key, value);
        return { status: 'success', message: `Saved to ${key}` };
      }
    }
  };

  // Add Dynamic MCP Tools if configured
  const mcpUrl = typeof agent.config.mcpServer === 'string' ? agent.config.mcpServer : undefined;
  const mcpTools: Record<string, any> = mcpUrl ? await getMcpToolsForAgent(mcpUrl) : {};

  const combinedTools = { ...baseTools, ...mcpTools };

  // Make the LLM call using Vercel AI SDK wrapper
  const { text, finishReason, usage } = await generateText({
    model: openai(modelName),
    system: systemPrompt,
    prompt: userPrompt,
    ...(maxTokens ? { maxTokens } : {}),
    temperature,
    tools: combinedTools
  });

  return {
    message: text,
    finishReason,
    metadata: {
      model: modelName,
      usage
    }
  };
}
