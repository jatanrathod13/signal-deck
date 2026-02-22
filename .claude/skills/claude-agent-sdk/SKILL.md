---
name: Claude Agent SDK
description: Build production AI agents with Claude's autonomous capabilities - includes tools, subagents, multi-agent orchestration, and API integration patterns
topics: claude-agent-sdk, anthropic, ai-agents, agent-orchestration, tool-use, mcp
created: 2026-02-21
updated: 2026-02-21
scratchpad: .specs/scratchpad/claude-agent-sdk-research.md
---

# Claude Agent SDK

## Overview

The Claude Agent SDK (formerly Claude Code SDK) is Anthropic's official SDK for building production AI agents. It provides the same tools, agent loop, and context management that power Claude Code, programmable in Python and TypeScript.

**Release Date**: September 29, 2025

The SDK enables agents to autonomously:
- Read and write files
- Run terminal commands
- Search codebases
- Execute code
- Browse the web
- Connect to external systems via MCP

---

## Key Concepts

- **Agent Loop**: Built-in autonomous tool execution without manual implementation
- **Built-in Tools**: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion
- **Subagents**: Lightweight child agents for parallel task execution within a session
- **Agent Teams**: Experimental feature for coordinating multiple independent Claude instances
- **Hooks**: Callback functions for custom behavior at key lifecycle points
- **MCP Integration**: Connect to Model Context Protocol servers for external capabilities
- **Sandboxing**: Security isolation for command execution

---

## Documentation & References

| Resource | Description | Link |
|----------|-------------|------|
| Agent SDK Overview | Official documentation and getting started | https://platform.claude.com/docs/en/agent-sdk/overview |
| TypeScript SDK | Complete TypeScript API reference | https://platform.claude.com/docs/en/agent-sdk/typescript |
| Python SDK | Complete Python API reference | https://platform.claude.com/docs/en/agent-sdk/python |
| Subagents | Creating and managing subagents | https://platform.claude.com/docs/en/agent-sdk/subagents |
| Hooks Guide | Customizing agent behavior | https://platform.claude.com/docs/en/agent-sdk/hooks |
| Permissions | Tool access control | https://platform.claude.com/docs/en/agent-sdk/permissions |
| Agent Teams | Multi-agent coordination | https://code.claude.com/docs/en/agent-teams |
| MCP Integration | External system connections | https://platform.claude.com/docs/en/agent-sdk/mcp |
| GitHub (TypeScript) | SDK source and issues | https://github.com/anthropics/claude-agent-sdk-typescript |
| GitHub (Python) | SDK source and issues | https://github.com/anthropics/claude-agent-sdk-python |
| Demo Examples | Sample applications | https://github.com/anthropics/claude-agent-sdk-demos |

---

## Recommended Libraries & Tools

| Name | Purpose | Maturity | Notes |
|------|---------|----------|-------|
| **@anthropic-ai/claude-agent-sdk** | TypeScript SDK | Stable | Main SDK for TypeScript/JavaScript |
| **claude-agent-sdk** | Python SDK | Stable | Main SDK for Python |
| **@modelcontextprotocol/sdk** | MCP client | Stable | For creating MCP servers |
| **zod** | Schema validation | Stable | For type-safe MCP tool definitions |

### Recommended Stack

- **Runtime**: Node.js 18+ or Bun (TypeScript), Python 3.10+ (Python)
- **API**: Anthropic API with API key authentication
- **Authentication**: Supports API Key, Amazon Bedrock, Google Vertex AI, Microsoft Azure

---

## Patterns & Best Practices

### Basic Agent Pattern

**When to use**: Simple single-turn or multi-turn agent tasks

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find and fix the bug in auth.py",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

### Subagent Pattern

**When to use**: Parallel task execution, context isolation, specialized instructions

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Review the authentication module for security issues",
  options: {
    allowedTools: ["Read", "Grep", "Glob", "Task"],
    agents: {
      "code-reviewer": {
        description: "Expert code review specialist for quality and security reviews.",
        prompt: "You are a code review specialist...",
        tools: ["Read", "Grep", "Glob"],
        model: "sonnet"
      },
      "test-runner": {
        description: "Runs and analyzes test suites.",
        prompt: "You are a test execution specialist...",
        tools: ["Bash", "Read", "Grep"],
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Hook Pattern

**When to use**: Logging, audit trails, custom permission logic, behavior modification

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { appendFile } from "fs/promises";

const logFileChange: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "unknown";
  await appendFile("./audit.log", `${new Date().toISOString()}: modified ${filePath}\n`);
  return {};
};

for await (const message of query({
  prompt: "Refactor utils.py to improve readability",
  options: {
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [logFileChange] }]
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

### MCP Integration Pattern

**When to use**: Connect to external systems (databases, browsers, APIs)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Open example.com and describe what you see",
  options: {
    mcpServers: {
      playwright: { command: "npx", args: ["@playwright/mcp@latest"] }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Session Persistence Pattern

**When to use**: Resume conversations, maintain context across requests

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;

for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Sandbox Pattern

**When to use**: Production deployments requiring security isolation

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Build and test my project",
  options: {
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      network: {
        allowLocalBinding: true
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

---

## Similar Implementations

### Agent Teams (Experimental)

- **Source**: https://code.claude.com/docs/en/agent-teams
- **Approach**: Coordinate multiple Claude Code instances as a team with shared task list
- **Applicability**: Complex multi-agent workflows requiring inter-agent communication
- **Note**: Requires enabling `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

### Claude Client SDK

- **Source**: https://platform.claude.com/docs/en/api/client-sdks
- **Approach**: Direct API access with manual tool loop implementation
- **Applicability**: Custom agent frameworks requiring full control

### CrewAI / LangChain

- **Source**: https://github.com/crewAIInc/crewAI, https://github.com/langchain-ai/langchain
- **Approach**: Multi-agent frameworks with role-based agents
- **Applicability**: When needing more orchestration features than Claude Agent SDK provides

---

## Common Pitfalls & Solutions

| Issue | Impact | Solution |
|-------|--------|----------|
| Missing Task tool | Medium | Subagents require `Task` in allowedTools |
| Tool permissions denied | High | Configure permissionMode or canUseTool handler |
| Subagent not delegating | Medium | Use explicit prompting ("Use the X agent to...") |
| Windows prompt length limits | Medium | Keep prompts concise or use filesystem-based agents |
| Session resumption fails | Medium | Ensure session_id is correctly passed |
| Sandbox blocking needed commands | Medium | Use excludedCommands or allowUnsandboxedCommands |
| Token cost too high | Medium | Use subagents instead of agent teams; limit tools |

---

## Recommendations

1. **Start with basic query()**: Understand the agent loop before adding complexity
2. **Use subagents for parallel work**: They provide context isolation and can run concurrently
3. **Implement hooks for production**: Add logging, auditing, and permission controls
4. **Configure sandbox for security**: Enable in production deployments
5. **Use MCP for external systems**: Connect to databases, APIs, and tools cleanly
6. **Enable agent teams for complex coordination**: When teammates need to communicate directly
7. **Control tool access**: Use allowedTools/disallowedTools for least privilege
8. **Handle sessions for continuity**: Maintain context across multi-turn conversations

---

## Implementation Guidance

### Installation

```bash
# TypeScript
npm install @anthropic-ai/claude-agent-sdk

# Python
pip install claude-agent-sdk
```

### Configuration

**Environment Variables**:
```bash
export ANTHROPIC_API_KEY=your-api-key
```

**Supported Authentication**:
- Anthropic API Key (standard)
- Amazon Bedrock (`CLAUDE_CODE_USE_BEDROCK=1`)
- Google Vertex AI (`CLAUDE_CODE_USE_VERTEX=1`)
- Microsoft Azure (`CLAUDE_CODE_USE_FOUNDRY=1`)

### Core API: query() Function

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

Returns an async generator that streams messages:
- `SDKAssistantMessage` - Claude's responses
- `SDKResultMessage` - Final result with cost, usage stats
- `SDKSystemMessage` - Session initialization info

### Key Options (ClaudeAgentOptions)

| Option | Type | Description |
|--------|------|-------------|
| allowedTools | string[] | Tools the agent can use |
| agents | Record<string, AgentDefinition> | Subagent definitions |
| hooks | Partial<Record<HookEvent, HookCallbackMatcher[]>> | Lifecycle hooks |
| mcpServers | Record<string, McpServerConfig> | MCP server connections |
| permissionMode | PermissionMode | Tool access control |
| sandbox | SandboxSettings | Security isolation |
| resume | string | Session ID to resume |
| maxTurns | number | Limit conversation turns |
| maxBudgetUsd | number | Budget limit |

---

## Code Examples

### Multi-Agent Research System

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const RESEARCH_PROMPT = `
Create a comprehensive research report on {topic}.

Use the following subagents:
- research-gatherer: Find and summarize key information
- analyst: Analyze findings and identify patterns
- writer: Compile final report
`;

for await (const message of query({
  prompt: RESEARCH_PROMPT,
  options: {
    allowedTools: ["Read", "Write", "Glob", "Grep", "Task"],
    agents: {
      "research-gatherer": {
        description: "Research specialist for finding information",
        prompt: "Search and gather relevant information on the given topic...",
        tools: ["WebSearch", "WebFetch", "Read", "Write"]
      },
      "analyst": {
        description: "Analysis specialist for identifying patterns",
        prompt: "Analyze gathered information and identify key patterns...",
        tools: ["Read", "Grep", "Glob"]
      },
      "writer": {
        description: "Technical writer for documentation",
        prompt: "Compile findings into a comprehensive report...",
        tools: ["Write", "Read"]
      }
    }
  }
})) {
  if ("result" in message) {
    console.log("Report:", message.result);
    console.log("Cost:", message.total_cost_usd);
  }
}
```

### Custom Tool with MCP

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Define a custom tool
const databaseTool = tool(
  "query_database",
  "Execute a read-only database query",
  {
    sql: z.string().describe("SQL query to execute"),
    limit: z.number().optional().default(10)
  },
  async ({ sql, limit }) => {
    // Implement database query
    const results = await db.query(sql, { limit });
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

// Create MCP server with custom tools
const mcpServer = createSdkMcpServer({
  name: "database-server",
  version: "1.0.0",
  tools: [databaseTool]
});

// Use in agent
for await (const message of query({
  prompt: "Show me recent users from the database",
  options: {
    mcpServers: {
      database: { type: "sdk", name: "database-server", instance: mcpServer }
    }
  }
})) {
  console.log(message);
}
```

---

## Sources & Verification

| Source | Type | Last Verified |
|--------|------|---------------|
| https://platform.claude.com/docs/en/agent-sdk/overview | Official | 2026-02-21 |
| https://platform.claude.com/docs/en/agent-sdk/typescript | Official | 2026-02-21 |
| https://platform.claude.com/docs/en/agent-sdk/subagents | Official | 2026-02-21 |
| https://code.claude.com/docs/en/agent-teams | Official | 2026-02-21 |
| https://github.com/anthropics/claude-agent-sdk-typescript | GitHub | 2026-02-21 |
| https://github.com/anthropics/claude-agent-sdk-demos | GitHub | 2026-02-21 |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-02-21 | Initial creation - Comprehensive Claude Agent SDK research |
