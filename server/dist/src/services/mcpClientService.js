"use strict";
/**
 * MCP Client Service
 * Connects to external MCP Servers (like Supabase, Context7, etc.)
 * Maps their tools into Vercel AI SDK compatible functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMcpClient = getMcpClient;
exports.getMcpToolsForAgent = getMcpToolsForAgent;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const zod_1 = require("zod");
// Keep active client connections in memory
const activeClients = new Map();
/**
 * Initializes and connects to an MCP Server
 */
async function getMcpClient(serverUrl) {
    if (activeClients.has(serverUrl)) {
        return activeClients.get(serverUrl);
    }
    const transport = new sse_js_1.SSEClientTransport(new URL(serverUrl));
    const client = new index_js_1.Client({ name: "agent-orchestration-platform", version: "1.0.0" }, { capabilities: { tools: {} } });
    await client.connect(transport);
    activeClients.set(serverUrl, client);
    return client;
}
/**
 * Connects to an MCP Server, fetches its tools, and maps them to Vercel AI SDK tools
 */
async function getMcpToolsForAgent(serverUrl) {
    try {
        const client = await getMcpClient(serverUrl);
        const { tools: mcpTools } = await client.listTools();
        const mappedTools = {};
        for (const mcpTool of mcpTools) {
            // Create a Vercel AI SDK compatible tool from the MCP representation
            mappedTools[mcpTool.name] = {
                type: 'function',
                description: mcpTool.description || `Execute external tool: ${mcpTool.name}`,
                parameters: zod_1.z.record(zod_1.z.any()),
                execute: async (args) => {
                    console.log(`[MCP Router] Executing tool ${mcpTool.name} on ${serverUrl} with args:`, args);
                    const result = await client.callTool({
                        name: mcpTool.name,
                        arguments: args
                    });
                    return {
                        status: 'success',
                        response: result.content
                    };
                }
            };
        }
        return mappedTools;
    }
    catch (error) {
        console.error(`Failed to load MCP tools from ${serverUrl}:`, error);
        return {};
    }
}
//# sourceMappingURL=mcpClientService.js.map