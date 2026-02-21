/**
 * MCP Client Service
 * Connects to external MCP Servers (like Supabase, Context7, etc.)
 * Maps their tools into Vercel AI SDK compatible functions.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
export interface McpServerConfig {
    url: string;
    name: string;
}
/**
 * Initializes and connects to an MCP Server
 */
export declare function getMcpClient(serverUrl: string): Promise<Client>;
/**
 * Connects to an MCP Server, fetches its tools, and maps them to Vercel AI SDK tools
 */
export declare function getMcpToolsForAgent(serverUrl: string): Promise<Record<string, unknown>>;
//# sourceMappingURL=mcpClientService.d.ts.map