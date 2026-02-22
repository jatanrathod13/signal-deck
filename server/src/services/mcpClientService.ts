/**
 * MCP Client Service
 * Connects to external MCP Servers (like filesystem, context7, etc.)
 * Maps their tools into Vercel AI SDK compatible functions.
 */

import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import type { Tool } from 'ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * MCP Server Configuration
 */
export interface McpServerConfig {
  url: string;
  name: string;
  transport?: 'stdio' | 'http';
  command?: string;
  args?: string[];
}

/**
 * MCP Tool definition from ListToolsRequest
 */
interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Client wrapper with connection caching
 */
class McpClientWrapper {
  private client: Client | null = null;
  private activeTransport:
    | StdioClientTransport
    | StreamableHTTPClientTransport
    | null = null;
  private serverUrl: string;
  private transport: 'stdio' | 'http';
  private command?: string;
  private args?: string[];
  private connected = false;

  constructor(
    serverUrl: string,
    transport: 'stdio' | 'http' = 'http',
    command?: string,
    args?: string[]
  ) {
    this.serverUrl = serverUrl;
    this.transport = transport;
    this.command = command;
    this.args = args;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    try {
      this.client = new Client(
        { name: 'agent-orchestration-client', version: '1.0.0' },
        { capabilities: {} }
      );

      if (this.transport === 'stdio') {
        if (!this.command) {
          throw new Error(`Missing command for stdio MCP server ${this.serverUrl}`);
        }

        const stdioTransport = new StdioClientTransport({
          command: this.command,
          args: this.args ?? [],
          env: Object.fromEntries(
            Object.entries(process.env).filter(
              (_entry): _entry is [string, string] => typeof _entry[1] === 'string'
            )
          )
        });
        await this.client.connect(stdioTransport);
        this.activeTransport = stdioTransport;
      } else {
        const httpTransport = new StreamableHTTPClientTransport(
          new URL(this.serverUrl)
        );
        await this.client.connect(httpTransport);
        this.activeTransport = httpTransport;
      }

      this.connected = true;
      console.log(`[MCP] Connected to ${this.serverUrl}`);
    } catch (error) {
      console.error(`[MCP] Failed to connect to ${this.serverUrl}:`, error);
      throw error;
    }
  }

  /**
   * Get list of available tools from the MCP server
   */
  async listTools(): Promise<McpTool[]> {
    if (!this.client) {
      await this.connect();
    }

    try {
      const response = await this.client!.listTools();
      return (response.tools ?? []) as McpTool[];
    } catch (error) {
      console.error(`[MCP] Failed to list tools from ${this.serverUrl}:`, error);
      throw error;
    }
  }

  /**
   * Call an MCP tool with the given parameters
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      await this.connect();
    }

    try {
      const response = await this.client!.callTool({
        name: toolName,
        arguments: args
      });

      // Return the tool result
      return response.content ?? response;
    } catch (error) {
      console.error(`[MCP] Failed to call tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.activeTransport) {
      try {
        await this.activeTransport.close();
      } catch (error) {
        console.error(`[MCP] Error closing connection to ${this.serverUrl}:`, error);
      }
    }

    this.activeTransport = null;
    this.client = null;
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Keep active client connections in memory with caching
const clientCache = new Map<string, McpClientWrapper>();

/**
 * Clear a specific client from cache
 */
export function clearMcpClient(serverUrl: string): void {
  const cached = clientCache.get(serverUrl);
  if (cached) {
    cached.close();
    clientCache.delete(serverUrl);
  }
}

/**
 * Clear all cached MCP clients
 */
export function clearAllMcpClients(): void {
  for (const [url, client] of clientCache) {
    client.close();
  }
  clientCache.clear();
}

/**
 * Convert MCP inputSchema to Zod schema
 */
function convertMcpSchemaToZod(inputSchema: McpTool['inputSchema']): z.ZodType<any> {
  const properties = inputSchema.properties || {};
  const required = inputSchema.required || [];

  const zodProperties: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const propDef = prop as any;

    // Convert JSON schema types to Zod types
    switch (propDef.type) {
      case 'string':
        if (propDef.enum) {
          zodProperties[key] = z.enum(propDef.enum as [string, ...string[]]);
        } else {
          zodProperties[key] = z.string();
        }
        break;
      case 'number':
      case 'integer':
        zodProperties[key] = z.number();
        break;
      case 'boolean':
        zodProperties[key] = z.boolean();
        break;
      case 'array':
        zodProperties[key] = z.array(z.any());
        break;
      case 'object':
        zodProperties[key] = z.record(z.string(), z.any());
        break;
      default:
        zodProperties[key] = z.any();
    }

    // Add description if available
    if (propDef.description) {
      zodProperties[key] = zodProperties[key].describe(propDef.description);
    }
  }

  // Build the schema with required fields
  const requiredFields = required as [string, ...string[]];
  if (requiredFields.length > 0) {
    return z.object(zodProperties).partial().extend(
      requiredFields.reduce((acc, key) => {
        acc[key] = zodProperties[key];
        return acc;
      }, {} as Record<string, z.ZodTypeAny>)
    );
  }

  return z.object(zodProperties);
}

/**
 * Map an MCP tool to Vercel AI SDK tool format
 */
function mapMcpToolToAiTool(mcpTool: McpTool, executeFn: (args: any) => Promise<any>): Tool {
  return tool({
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    inputSchema: zodSchema(convertMcpSchemaToZod(mcpTool.inputSchema)),
    execute: executeFn
  });
}

/**
 * Get or create an MCP client wrapper
 */
async function getMcpClient(serverUrl: string, config?: McpServerConfig): Promise<McpClientWrapper> {
  // Check cache first
  if (clientCache.has(serverUrl)) {
    const cached = clientCache.get(serverUrl)!;
    if (cached.isConnected()) {
      return cached;
    }
  }

  // Determine transport type
  const transport = config?.transport || (serverUrl.startsWith('http') ? 'http' : 'stdio');
  const command = config?.command;
  const args = config?.args;

  // Create new client wrapper
  const clientWrapper = new McpClientWrapper(serverUrl, transport, command, args);

  // Attempt to connect (may fail, but we cache anyway for retry)
  try {
    await clientWrapper.connect();
  } catch (error) {
    console.warn(`[MCP] Initial connection failed for ${serverUrl}, caching anyway for retry:`, error);
  }

  clientCache.set(serverUrl, clientWrapper);
  return clientWrapper;
}

/**
 * Get MCP tools for an agent
 * Connects to MCP server, discovers tools, and maps them to Vercel AI SDK format
 */
export async function getMcpToolsForAgent(serverUrl: string, config?: McpServerConfig): Promise<Record<string, Tool>> {
  if (!serverUrl) {
    console.log('[MCP] No server URL provided, returning empty tools');
    return {};
  }

  try {
    console.log(`[MCP] Loading tools from ${serverUrl}...`);

    // Get or create client connection
    const clientWrapper = await getMcpClient(serverUrl, config);

    // List available tools from MCP server
    const mcpTools = await clientWrapper.listTools();

    console.log(`[MCP] Discovered ${mcpTools.length} tools from ${serverUrl}`);

    // Map MCP tools to Vercel AI SDK format
    const aiTools: Record<string, Tool> = {};

    for (const mcpTool of mcpTools) {
      const toolName = mcpTool.name;

      // Create execution function that calls the MCP tool
      const executeFn = async (args: Record<string, unknown>): Promise<unknown> => {
        try {
          const result = await clientWrapper.callTool(toolName, args);
          return result;
        } catch (error) {
          console.error(`[MCP] Error executing tool ${toolName}:`, error);
          throw error;
        }
      };

      // Map to AI SDK tool format
      aiTools[toolName] = mapMcpToolToAiTool(mcpTool, executeFn);

      console.log(`[MCP] Mapped tool: ${toolName}`);
    }

    console.log(`[MCP] Successfully loaded ${Object.keys(aiTools).length} tools from ${serverUrl}`);
    return aiTools;

  } catch (error) {
    console.error(`[MCP] Failed to load MCP tools from ${serverUrl}:`, error);
    // Return empty tools but don't throw - allow agent to continue with other tools
    return {};
  }
}

/**
 * Get MCP tools from multiple servers
 */
export async function getMcpToolsFromServers(
  servers: Array<{ url: string; config?: McpServerConfig }>
): Promise<Record<string, Tool>> {
  const allTools: Record<string, Tool> = {};

  for (const server of servers) {
    const tools = await getMcpToolsForAgent(server.url, server.config);

    // Merge tools, avoiding name collisions
    for (const [name, tool] of Object.entries(tools)) {
      if (allTools[name]) {
        console.warn(`[MCP] Tool name collision: ${name} from ${server.url} already exists, skipping`);
        continue;
      }
      allTools[name] = tool;
    }
  }

  return allTools;
}

/**
 * Check MCP server connectivity
 */
export async function checkMcpConnection(serverUrl: string): Promise<boolean> {
  try {
    const client = await getMcpClient(serverUrl);
    await client.listTools();
    return true;
  } catch (error) {
    console.error(`[MCP] Connection check failed for ${serverUrl}:`, error);
    return false;
  }
}
