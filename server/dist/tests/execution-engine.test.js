"use strict";
/**
 * Manual Test: OpenAI Execution Service Test
 * Ensures that the executeAgentTask function correctly builds prompts and queries OpenAI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const executionService_1 = require("../src/services/executionService");
const agentService_1 = require("../src/services/agentService");
async function testOpenAIExecution() {
    console.log('--- Starting OpenAI Execution Engine Test ---');
    // 1. Deploy a mock agent with a specialized prompt
    const agent = (0, agentService_1.deployAgent)('test-ai-agent', 'assistant', {
        systemPrompt: 'You are a poetic assistant. Answer all prompts with a 2-line haiku.',
        model: 'gpt-4o',
        temperature: 0.8
    });
    console.log(`Deployed Agent ID: ${agent.id}`);
    // 2. Create a mock task pointing to this agent
    const mockTask = {
        id: 'test-task-123',
        agentId: agent.id,
        type: 'generate_text',
        data: {
            prompt: 'Explain what an AI agent is.'
        },
        status: 'processing',
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    console.log('Task submitted. Waiting for LLM execution...');
    try {
        const start = Date.now();
        // 3. Execute the payload
        const result = await (0, executionService_1.executeAgentTask)(mockTask);
        const latency = Date.now() - start;
        console.log(`\nExecution Successful! (${latency}ms)`);
        console.log('====== RESULT ======');
        console.log(result.message);
        console.log('====================\n');
        console.log('Metadata:', result.metadata);
    }
    catch (error) {
        console.error('Execution Failed:', error);
    }
}
// Run the script if called directly
if (require.main === module) {
    testOpenAIExecution().then(() => process.exit(0));
}
//# sourceMappingURL=execution-engine.test.js.map