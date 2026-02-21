"use strict";
/**
 * ExecutionService - Handles actual LLM Interaction
 * Uses Vercel AI SDK to communicate with OpenAI.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeAgentTask = executeAgentTask;
const ai_1 = require("ai");
const openai_1 = require("@ai-sdk/openai");
const zod_1 = require("zod");
const agentService_1 = require("./agentService");
const sharedMemoryService_1 = require("./sharedMemoryService");
const mcpClientService_1 = require("./mcpClientService");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function executeAgentTask(task) {
    const agent = (0, agentService_1.getAgent)(task.agentId);
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
    const baseTools = {
        readSharedMemory: {
            type: 'function',
            description: 'Read a value from the shared memory store. Use this to retrieve context left by other agents or previous tasks.',
            parameters: zod_1.z.object({
                key: zod_1.z.string().describe('The memory key to lookup.')
            }),
            execute: async ({ key }) => {
                const val = await (0, sharedMemoryService_1.getValue)(key);
                return { value: val || 'No data found for this key.' };
            }
        },
        writeSharedMemory: {
            type: 'function',
            description: 'Write a value into the shared memory store. Use this to leave context or pass payloads to other agents/tasks.',
            parameters: zod_1.z.object({
                key: zod_1.z.string().describe('The memory key to write to.'),
                value: zod_1.z.string().describe('The content to store.')
            }),
            execute: async ({ key, value }) => {
                await (0, sharedMemoryService_1.setValue)(key, value);
                return { status: 'success', message: `Saved to ${key}` };
            }
        }
    };
    // Add Dynamic MCP Tools if configured
    const mcpUrl = typeof agent.config.mcpServer === 'string' ? agent.config.mcpServer : undefined;
    const mcpTools = mcpUrl ? await (0, mcpClientService_1.getMcpToolsForAgent)(mcpUrl) : {};
    const combinedTools = { ...baseTools, ...mcpTools };
    // Make the LLM call using Vercel AI SDK wrapper
    const { text, finishReason, usage } = await (0, ai_1.generateText)({
        model: (0, openai_1.openai)(modelName),
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
//# sourceMappingURL=executionService.js.map