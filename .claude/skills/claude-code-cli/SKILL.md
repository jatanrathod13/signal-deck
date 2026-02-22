---
name: Claude Code CLI Capabilities
description: Comprehensive research on Claude Code CLI autonomous agent capabilities, file operations, git integration, scripting, project exploration, and orchestration platform integration
topics: claude-code, cli, autonomous-agent, ai-coding, agent-orchestration, mcp, anthropic
created: 2026-02-21
updated: 2026-02-21
scratchpad: .specs/scratchpad/claude-code-cli-research.md
---

# Claude Code CLI Capabilities

## Overview

Claude Code is Anthropic's AI-powered coding assistant that operates as an autonomous agentic CLI. It reads codebases, executes commands, modifies files, manages git workflows, connects to external services via MCP, and delegates complex tasks to specialized subagents. Unlike simple chat interfaces, Claude Code operates through a layered architecture that enables sophisticated automation and orchestration.

**Key Distinction**: Claude Code operates as an **agentic system**, not a chat interface with programming knowledge. It autonomously plans and executes multi-step tasks through tool invocations.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    CLAUDE CODE LAYERS                    │
├─────────────────────────────────────────────────────────┤
│  EXTENSION LAYER                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │   MCP   │  │  Hooks  │  │ Skills  │  │ Plugins │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│  External tools, deterministic automation, domain       │
│  expertise, packaged extensions                          │
├─────────────────────────────────────────────────────────┤
│  DELEGATION LAYER                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Subagents (up to 10 parallel)       │    │
│  │   Explore | Plan | General-purpose | Custom      │    │
│  └─────────────────────────────────────────────────┘    │
│  Isolated contexts for focused work, returns summaries  │
├─────────────────────────────────────────────────────────┤
│  CORE LAYER                                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Main Conversation Context                │    │
│  │   Tools: Read, Edit, Bash, Glob, Grep, etc.     │    │
│  └─────────────────────────────────────────────────┘    │
│  Your primary interaction; limited context; costs money │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Autonomous Agent Capabilities

### What Claude Code CLI Can Do

Claude Code operates autonomously to:

- **Read and write files** - Complete file operations (read, edit, create, delete)
- **Execute terminal commands** - Run any shell command, build scripts, tests
- **Search codebases** - Find files, patterns, and symbols across projects
- **Execute code** - Run and test code in various languages
- **Browse the web** - Search and fetch web content
- **Manage git** - Full git workflow integration
- **Connect to external systems** - MCP servers for databases, APIs, tools
- **Delegate to subagents** - Spawn specialized agents for parallel work

### Agent Execution Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **Interactive REPL** | `claude` | Direct conversation |
| **Task Mode** | `claude -t "task"` | Execute single task |
| **Resume Session** | `claude -c` | Continue previous session |
| **Background** | `claude --background` | Long-running tasks |

### Extended Thinking Mode

Claude Code supports extended thinking for complex reasoning:

- Toggle with `Alt+T` during sessions
- Enables deep reasoning on architectural decisions
- Use for complex bugs, design decisions, refactoring

---

## 2. File Operations

### Built-in File Tools

| Tool | Capability |
|------|------------|
| **Read** | Read complete file contents with line numbers |
| **Write** | Create or overwrite files |
| **Edit** | Precise line-based edits with uniqueness validation |
| **Glob** | Fast pattern-based file discovery |
| **mcp__filesystem** | Full filesystem operations via MCP |

### File Operations via Agent SDK

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Create a new component at src/components/MyComponent.tsx",
  options: { allowedTools: ["Write", "Glob", "Read"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Direct CLI Usage

```
# Edit specific line in file
claude edit path/to/file.ts:42 "new content"

# Read file contents
claude read path/to/file.ts

# Write new file
claude write path/to/new-file.ts "file contents"
```

---

## 3. Git Integration

### Native Git Capabilities

Claude Code has built-in git integration:

- **Status awareness** - Knows current branch, changes, staged files
- **Commit creation** - Creates commits with proper messages
- **Branch management** - Create, switch, merge branches
- **Diff viewing** - Shows changes with context
- **Commit history** - Navigates and explains history

### Git Commands in Workflow

```
> "Check git status"
> "Create a branch for this feature"
> "Commit these changes with a good message"
> "Show me the diff for this commit"
> "Rebase onto main branch"
```

### Integration via Agent SDK

```typescript
// Claude Code can execute git commands through Bash tool
for await (const message of query({
  prompt: "Create a feature branch and commit the changes",
  options: { allowedTools: ["Bash", "Read", "Glob"] }
})) {
  // Claude will run: git checkout -b feature/xyz
  // Then stage and commit changes
}
```

---

## 4. Terminal Command Execution

### Bash Tool Capabilities

The `Bash` tool executes any terminal command:

- Build systems (npm, make, cargo, etc.)
- Testing frameworks
- Docker and container operations
- System administration
- Custom scripts

### Command Execution Examples

```typescript
// Via Agent SDK
for await (const message of query({
  prompt: "Build the project and run tests",
  options: { allowedTools: ["Bash", "Glob"] }
})) {
  // Executes: npm run build && npm test
}
```

### Security: Permission System

Claude Code has a layered permission system:

| Permission Level | Description |
|-----------------|-------------|
| **Default** | Prompt for dangerous commands |
| **Allow** | Pre-approved commands |
| **Deny** | Blocked commands |
| **Bash** | Configurable per-command approval |

Configure in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["npm run *", "git *"],
    "deny": ["rm -rf /", "curl | sh"]
  }
}
```

---

## 5. Scripting and Programmatic Usage

### Claude Agent SDK (Primary Method)

The Claude Agent SDK is the official way to program Claude Code:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  for await (const message of query({
    prompt: "Find and fix the authentication bug",
    options: {
      allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep"],
      maxTurns: 50,
      maxBudgetUsd: 10.00
    }
  })) {
    if ("result" in message) {
      console.log("Result:", message.result);
      console.log("Cost:", message.total_cost_usd);
    }
  }
}
```

### Python SDK

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Analyze the codebase structure",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep", "Bash"]
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

### Session Persistence

```typescript
let sessionId: string | undefined;

for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Resume later
for await (const message of query({
  prompt: "Now add tests for it",
  options: { resume: sessionId }
})) {
  // Continues from previous session
}
```

### Programmatic Tool Calling (Advanced)

New capability for orchestrating tools through code:

```typescript
// Instead of multiple API calls, Claude writes code that:
// 1. Calls multiple tools in a loop
// 2. Processes outputs
// 3. Returns only relevant results to context

// Example: Batch file processing
const files = await glob("**/*.ts");
for (const file of files) {
  const content = await readFile(file);
  // Process and extract only what's needed
}
```

**Benefits**:
- 85% token reduction for large tool libraries
- Reduced latency (no round-trip per tool)
- Explicit control flow in code vs implicit in reasoning

---

## 6. Project Exploration and Code Understanding

### Exploration Tools

| Tool | Purpose |
|------|---------|
| **Glob** | Find files by pattern (`**/*.ts`, `src/**/*.jsx`) |
| **Grep** | Search content with regex |
| **Read** | Read specific files |
| **WebSearch** | Search the web for documentation |
| **WebFetch** | Fetch external content |

### Built-in Subagents for Exploration

Claude Code includes specialized subagents:

| Subagent | Purpose | Tools |
|----------|---------|-------|
| **Explore** | Fast codebase exploration | Glob, Grep, Read, limited Bash |
| **Plan** | Create implementation plans | All tools |
| **General-purpose** | Default agent | All allowed tools |

### Exploration Example

```
> "Explore this codebase and explain the architecture"

# Claude uses Explore subagent which:
# 1. Uses Glob to find key files
# 2. Uses Grep to find dependencies
# 3. Uses Read to understand structure
# 4. Returns summary to main context
```

### Code Understanding via Agent SDK

```typescript
for await (const message of query({
  prompt: `Analyze this codebase structure:
  1. What is the main architecture?
  2. What are the key modules?
  3. How is state managed?`,
  options: {
    allowedTools: ["Glob", "Grep", "Read", "Bash"],
    agents: {
      "explorer": {
        description: "Codebase exploration specialist",
        prompt: "You explore codebases and summarize structure...",
        tools: ["Glob", "Grep", "Read"]
      }
    }
  }
})) {
  if ("result" in message) {
    console.log(message.result);
  }
}
```

---

## 7. Integration with Orchestration Platforms

### Integration Approaches

#### A. Claude Agent SDK (Recommended)

Build custom agents using the same core as Claude Code:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

class OrchestrationPlatform {
  private agents: Map<string, AgentDefinition> = new Map();

  async executeTask(task: Task) {
    const agent = this.getOrCreateAgent(task.type);

    for await (const message of query({
      prompt: task.description,
      options: {
        allowedTools: task.allowedTools,
        agents: this.agents,
        maxTurns: task.maxTurns
      }
    })) {
      if ("result" in message) {
        return message.result;
      }
    }
  }
}
```

#### B. MCP (Model Context Protocol)

Connect Claude to external systems:

```typescript
for await (const message of query({
  prompt: "Query the database for recent orders",
  options: {
    mcpServers: {
      database: {
        command: "npx",
        args: ["@modelcontextprotocol/server-sqlite", "--db-path", "./data.db"]
      }
    }
  }
})) {}
```

**MCP Server Examples**:
- **Filesystem** - Full file operations
- **GitHub** - Issues, PRs, repos
- **Slack** - Send messages, channels
- **Playwright** - Browser automation
- **Database** - SQLite, PostgreSQL
- **Custom** - Build your own

#### C. Hooks for Deterministic Automation

Hooks guarantee execution regardless of model behavior:

```typescript
const logToolUse: HookCallback = async (input) => {
  const toolName = (input as any).tool_name;
  const toolInput = (input as any).tool_input;

  await auditLog({
    timestamp: new Date(),
    tool: toolName,
    input: toolInput
  });

  return {}; // Continue normal execution
};

for await (const message of query({
  prompt: "Refactor the authentication module",
  options: {
    hooks: {
      PostToolUse: [{ matcher: ".*", hooks: [logToolUse] }]
    }
  }
})) {}
```

**Hook Types**:
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution
- `Notification` - Async notifications
- `Stop` - When agent stops

#### D. Agent Teams (Experimental)

Coordinate multiple Claude instances:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

```typescript
// Define team members
const team = {
  "researcher": {
    description: "Gathers information",
    prompt: "You research topics thoroughly...",
    tools: ["WebSearch", "WebFetch", "Read"]
  },
  "developer": {
    description: "Implements features",
    prompt: "You write code based on requirements...",
    tools: ["Read", "Write", "Edit", "Bash"]
  },
  "reviewer": {
    description: "Reviews code",
    prompt: "You review code for issues...",
    tools: ["Read", "Glob", "Grep"]
  }
};

// Team coordinates through shared task list
```

#### E. Remote/Background Agents

Run Claude Code in background for long tasks:

```bash
# Start background task
claude --background "Process all pending items"

# Or in code
for await (const message of query({
  prompt: "Process the entire backlog",
  options: {
    background: true,
    maxDuration: 3600 // 1 hour
  }
})) {}
```

---

## 8. Skills System

Skills extend Claude Code with custom capabilities:

### Creating a Skill

```
.claude/skills/
  skill-name/
    SKILL.md          # Main skill definition
    commands/         # Custom slash commands
    scripts/          # Helper scripts
    resources/        # Templates, configs
```

### Skill Structure (SKILL.md)

```markdown
---
name: My Custom Skill
description: Does something useful
topics: topic1, topic2
---

# My Custom Skill

## Overview
[What this skill does]

## Usage
[How to invoke it]

## Examples
[Code examples]
```

### Using Skills

```
> /skill-name [arguments]
# or
> Use the my-skill to accomplish X
```

---

## 9. CLAUDE.md Configuration

Project-specific instructions:

```markdown
# Project Configuration

## Build Commands
- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run build` - Production build

## Code Conventions
- Use TypeScript strict mode
- Follow ESLint rules
- Write tests for new features

## Architecture
- [Explain your architecture]
- [Key files and their purpose]
```

Claude reads `CLAUDE.md` automatically at session start.

---

## 10. Advanced Capabilities

### Tool Search Tool (November 2025)

Dynamically discover tools without loading all definitions:

```typescript
// Traditional: 72K tokens for 50+ tools
// With Tool Search: ~8.7K tokens (85% reduction)

{
  tools: [
    { type: "tool_search_tool_regex_20251119" },
    {
      name: "github.createPullRequest",
      defer_loading: true  // Load on-demand
    }
    // ... hundreds more deferred
  ]
}
```

### Prompt Caching

Cache expensive computations:

```typescript
for await (const message of query({
  prompt: cachedPrompt,  // System prompt cached
  options: {
    cache: { prompt: true }
  }
})) {}
```

### Model Tiering

Route tasks to appropriate models:

```typescript
agents: {
  "explorer": {
    model: "haiku",  // Fast, cheap for exploration
    // ...
  },
  "architect": {
    model: "opus",   // Best for complex reasoning
    // ...
  }
}
```

| Model | Use Case |
|-------|----------|
| **Opus** | Complex reasoning, architecture |
| **Sonnet** | General work |
| **Haiku** | Fast exploration |

---

## Documentation & References

| Resource | Description | Link |
|----------|-------------|------|
| Claude Code Overview | Official documentation | https://code.claude.com/docs/en/overview |
| Agent SDK | Build custom agents | https://platform.claude.com/docs/en/agent-sdk/overview |
| TypeScript SDK | API reference | https://platform.claude.com/docs/en/agent-sdk/typescript |
| Python SDK | API reference | https://platform.claude.com/docs/en/agent-sdk/python |
| MCP Documentation | External integrations | https://modelcontextprotocol.io |
| Skills Guide | Extend Claude | https://code.claude.com/docs/en/skills |
| Best Practices | Usage patterns | https://code.claude.com/docs/en/best-practices |
| Claude Code GitHub | SDK source | https://github.com/anthropics/claude-agent-sdk-typescript |
| Advanced Tool Use | Nov 2025 features | https://www.anthropic.com/engineering/advanced-tool-use |

---

## Common Pitfalls

| Issue | Impact | Solution |
|-------|--------|----------|
| Context bloat | High cost, lost context | Use subagents for exploration |
| Tool permission errors | Task failure | Configure permissions properly |
| Session not resuming | Lost context | Save session_id correctly |
| MCP server issues | Integration failure | Check server logs, versions |
| Token limits exceeded | Task truncation | Set maxBudgetUsd, maxTurns |

---

## Recommendations for Orchestration Platform

1. **Use Claude Agent SDK** - Primary integration method, not CLI wrapping
2. **Implement hooks for audit** - Log all tool executions for debugging
3. **Use subagents for parallelism** - Up to 10 concurrent agents
4. **Configure sandbox in production** - Security isolation for automation
5. **Implement session management** - Resume capability for long workflows
6. **Use MCP for external systems** - Clean integration without custom code
7. **Leverage Tool Search Tool** - For large MCP tool libraries
8. **Model tier appropriately** - Haiku for exploration, Opus for reasoning
9. **Set budget limits** - Prevent runaway costs
10. **Handle errors gracefully** - Tool failures should retry or fallback

---

## Installation

```bash
# macOS/Linux
curl -fsSL https://claude.ai/install.sh | bash

# Windows
irm https://claude.ai/install.ps1 | iex

# Homebrew
brew install --cask claude-code

# Verify
claude doctor
```

### Authentication

```bash
# Anthropic API (standard)
export ANTHROPIC_API_KEY=your-key

# AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=1

# Google Vertex
export CLAUDE_CODE_USE_VERTEX=1

# Microsoft Foundry
export CLAUDE_CODE_USE_FOUNDRY=1
```

---

## Sources & Verification

| Source | Type | Last Verified |
|--------|------|---------------|
| https://code.claude.com/docs/en/overview | Official | 2026-02-21 |
| https://platform.claude.com/docs/en/agent-sdk/overview | Official | 2026-02-21 |
| https://blakecrosley.com/en/guides/claude-code | Community | 2026-02-21 |
| https://www.anthropic.com/engineering/advanced-tool-use | Official | 2026-02-21 |
| https://modelcontextprotocol.io | Official | 2026-02-21 |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-02-21 | Initial research - Claude Code CLI capabilities |
