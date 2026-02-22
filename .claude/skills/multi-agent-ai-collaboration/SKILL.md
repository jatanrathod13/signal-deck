---
name: Multi-Agent AI Collaboration
description: Production multi-agent AI systems patterns and architectures - frameworks like CrewAI, LangGraph, AutoGen, communication patterns, context sharing, and real-world use cases
topics: multi-agent-systems, crewai, langgraph, autogen, agent-collaboration, agent-communication, agent-delegation
created: 2026-02-21
updated: 2026-02-21
scratchpad: .specs/scratchpad/multi-agent-research.md
---

# Multi-Agent AI Collaboration

## Overview

Multi-agent AI systems enable multiple AI agents to collaborate on complex tasks, dividing work based on specialized roles and capabilities. This skill covers production frameworks, communication patterns, context sharing mechanisms, and real-world architectures for building collaborative AI agent systems.

---

## Key Concepts

- **Agent**: An AI entity with specific role, goal, and capabilities that can take actions
- **Crew**: A team of agents working together on complex tasks (CrewAI concept)
- **Swarm**: Multi-agent architecture where agents dynamically hand off to specialists (LangGraph Swarm)
- **Graph Orchestration**: State-based workflow where agents are nodes in a graph (LangGraph)
- **Group Chat**: Conversational collaboration where agents take turns (AutoGen)
- **Context Passing**: Transferring relevant information between agents during delegation

---

## Documentation & References

| Resource | Description | Link |
|----------|-------------|------|
| CrewAI Documentation | Multi-agent framework with crews and flows | https://docs.crewai.com |
| LangGraph Documentation | Graph-based agent orchestration | https://langchain-ai.github.io/langgraph/ |
| AutoGen Documentation | Microsoft's multi-agent conversation framework | https://microsoft.github.io/autogen/ |
| LangGraph Swarm | Swarm-style multi-agent with handoffs | https://github.com/langchain-ai/langgraph-swarm-py |
| MetaGPT | Multi-agent for software development | https://deepwisdom.ai/ |

---

## Framework Comparison

| Framework | Architecture | Communication | Context Storage | Best For |
|-----------|-------------|----------------|-----------------|----------|
| **CrewAI** | Hierarchical Crews | Role-based delegation | Task context, memory | Structured workflows |
| **LangGraph** | Graph State Machine | Node-based messaging | Graph state with checkpoints | Flexible orchestration |
| **AutoGen** | Conversational | Dynamic message passing | Conversation history | Open-ended collaboration |
| **LangGraph Swarm** | Dynamic Handoffs | Agent-to-agent transfers | State passed on handoff | Distributed specializations |
| **MetaGPT** | Role-based Squads | Document-based | Shared docs/memory | Software development |
| **Claude CLI & Vercel AI Orchestrator** | Parallel Team | Round-Robin + Dependencies | PubSub + Context JSON | Local autonomy & ToolLoop |

---

## Communication Patterns

### 1. Hierarchical Delegation (CrewAI)

A manager agent delegates tasks to specialized sub-agents based on their roles.

**When to use**: Well-defined roles with clear reporting structure

```python
from crewai import Agent, Task, Crew, Process

# Define specialized agents
researcher = Agent(
    role='Researcher',
    goal='Conduct in-depth analysis',
    backstory='Expert data analyst...',
    allow_delegation=False
)

writer = Agent(
    role='Writer',
    goal='Create engaging content',
    backstory='Creative writer...',
    allow_delegation=False
)

# Manager agent coordinates
manager = Agent(
    role="Project Manager",
    goal="Efficiently manage the crew",
    allow_delegation=True  # Can delegate to researcher, writer
)

# Create crew with hierarchical process
crew = Crew(
    agents=[researcher, writer, manager],
    tasks=[...],
    process=Process.hierarchical,
    manager_agent=manager
)

result = crew.kickoff()
```

### 2. Sequential Pipeline

Agents process tasks in sequence, passing output to the next agent.

**When to use**: Linear workflows where each step builds on the previous

```python
from crewai import Crew, Process

# Sequential: tasks execute in order
crew = Crew(
    agents=[researcher, writer, editor],
    tasks=[research_task, write_task, edit_task],
    process=Process.sequential
)
```

### 3. Graph State Machine (LangGraph)

Agents are nodes in a graph with centralized state.

**When to use**: Complex workflows requiring checkpointing, branching, and state persistence

```python
from langgraph.graph import START, StateGraph
from typing_extensions import TypedDict

class State(TypedDict):
    messages: list
    counter: int

def node_a(state: State):
    return {"messages": ["Processed by A"], "counter": state["counter"] + 1}

def node_b(state: State):
    return {"messages": ["Processed by B"], "counter": state["counter"] + 1}

builder = StateGraph(State)
builder.add_node("node_a", node_a)
builder.add_node("node_b", node_b)
builder.add_edge(START, "node_a")
builder.add_edge("node_a", "node_b")

graph = builder.compile()
result = graph.invoke({"messages": [], "counter": 0})
```

### 4. Group Chat (AutoGen)

Multiple agents converse dynamically with a manager selecting the next speaker.

**When to use**: Collaborative tasks requiring diverse perspectives

```python
# AutoGen group chat with topic subscriptions
await runtime.add_subscription(TypeSubscription(topic_type="writer", agent_type=writer_type))
await runtime.add_subscription(TypeSubscription(topic_type="editor", agent_type=editor_type))
await runtime.add_subscription(TypeSubscription(topic_type="group_chat", agent_type=writer_type))
await runtime.add_subscription(TypeSubscription(topic_type="group_chat", agent_type=editor_type))

# GroupChatManager selects next speaker
class GroupChatManager(RoutedAgent):
    async def handle_message(self, message: GroupChatMessage, ctx: MessageContext):
        # Select next agent based on conversation history
        selected = await self.select_next_speaker()
        await self.publish_message(RequestToSpeak(), topic_id=selected)
```

### 5. Swarm Handoffs (LangGraph Swarm)

Agents dynamically transfer control to other specialists.

**When to use**: Open-ended tasks requiring multiple specializations

```python
from langgraph_swarm import create_swarm, create_handoff_tool

alice = create_agent(
    model,
    tools=[add, create_handoff_tool(agent_name="Bob")],
    system_prompt="You are Alice, an addition expert.",
    name="Alice"
)

bob = create_agent(
    model,
    tools=[create_handoff_tool(agent_name="Alice")],
    system_prompt="You are Bob, transfer to Alice for math.",
    name="Bob"
)

workflow = create_swarm([alice, bob], default_active_agent="Alice")
app = workflow.compile()

# Dynamic handoff during execution
result = app.invoke({"messages": [{"role": "user", "content": "Talk to Bob about math"}]})
```

---

## Context Sharing Mechanisms

| Mechanism | Framework | Description |
|-----------|-----------|-------------|
| **Graph State** | LangGraph | Centralized state passed between nodes |
| **Conversation History** | AutoGen | Chat-style message accumulation |
| **Task Context** | CrewAI | Passed during delegation with task description |
| **Checkpointing** | LangGraph | Persist and resume state at any point |
| **Tool Messages** | LangGraph Swarm | State updates in ToolMessage on handoff |
| **Shared Memory** | All | Vector databases for semantic retrieval |
| **Document Passing** | MetaGPT | Structured documents as communication medium |

---

## Best Practices

### Define Clear Agent Roles

```python
# Good: Specific, focused roles
researcher = Agent(
    role='Senior Market Research Analyst',
    goal='Analyze market trends and competitor strategies',
    backstory='10 years in financial analysis...'
)

# Avoid: Vague roles
researcher = Agent(role='Helper', goal='Help', backstory='I help things')
```

### Implement Error Handling

```python
# Use try-catch in agent tools
@tool
def risky_operation(data):
    try:
        return {"success": True, "result": process(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### Use Checkpointing for Long Workflows

```python
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()
graph = builder.compile(checkpointer=checkpointer)

# Resume from checkpoint
config = {"configurable": {"thread_id": "workflow-123"}}
result = graph.invoke(initial_state, config)
```

### Limit Agent Count

- Start with 2-3 agents, add more only when necessary
- Each agent should have a distinct, non-overlapping purpose
- Too many agents = coordination overhead, context pollution

---

## Common Pitfalls & Solutions

| Issue | Impact | Solution |
|-------|--------|----------|
| **Context overflow** | Agents lose track of conversation | Use summarization, selective context |
| **Infinite loops** | Agents repeatedly delegate to each other | Set max iterations, cycle detection |
| **Debugging difficulty** | Hard to trace errors | Structured logging, checkpointing |
| **Role confusion** | Agents step on each other's tasks | Clear goal definitions, minimal overlap |
| **Tool conflicts** | Multiple agents use same resource | Rate limiting, agent-specific tool sets |
| **Failure cascades** | One agent failure breaks workflow | Error boundaries, fallback agents |

---

## Real-World Use Cases

| Use Case | Framework | Pattern | Outcome |
|----------|-----------|---------|---------|
| **Software Development** | MetaGPT, CrewAI | Sequential | Code + review + test agents |
| **Customer Support Triage** | LangGraph, AutoGen | Hierarchical | Router -> Specialist -> Resolver |
| **Research Pipeline** | CrewAI | Hierarchical Crew | Research -> Analyze -> Write -> Edit |
| **Content Production** | AutoGen Group Chat | Conversational | Writer/Editor/Illustrator collaborate |
| **Data ETL Pipeline** | LangGraph | Graph State | Extract -> Transform -> Load with checkpointing |
| **Enterprise Automation** | CrewAI + Flows | Layered | Flow orchestrates multiple crews |

---

## Recommendations

1. **Start with CrewAI** for structured, role-based workflows with clear hierarchies
2. **Use LangGraph** when you need checkpointing, complex branching, or stateful workflows
3. **Choose AutoGen** for open-ended group collaboration scenarios
4. **Use LangGraph Swarm** for dynamic, distributed systems with frequent handoffs
5. **Implement structured logging** at every agent decision point
6. **Design for failure** - every agent should handle errors gracefully
7. **Monitor context usage** - track token consumption across agents
8. **Use Flows + Crews** in production: Flow manages overall structure, Crew handles multi-agent tasks

---

## Installation

```bash
# CrewAI
pip install crewai==0.80.0

# LangGraph
pip install langgraph==0.2.74

# LangGraph Swarm
pip install langgraph-swarm

# AutoGen
pip install pyautogen==0.2.36

# For memory/vector store (context sharing)
pip install chromadb faiss-cpu
```

---

## Sources & Verification

| Source | Type | Last Verified |
|--------|------|---------------|
| https://docs.crewai.com | Official | 2026-02-21 |
| https://github.com/langchain-ai/langgraph | GitHub | 2026-02-21 |
| https://github.com/microsoft/autogen | GitHub | 2026-02-21 |
| https://github.com/langchain-ai/langgraph-swarm-py | GitHub | 2026-02-21 |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-02-21 | Initial creation - Multi-agent collaboration patterns research |
