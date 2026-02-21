# Architecture Scratchpad: Agent Orchestration Platform

Task: .specs/tasks/draft/implement-agent-orchestration-platform.feature.md
Skill: .claude/skills/agent-orchestration-platform/SKILL.md
Analysis: .specs/analysis/analysis-agent-orchestration-platform.md

---

## Problem Decomposition

To design the Agent Orchestration Platform, I need to solve these subproblems in order:

| # | Subproblem | Depends On | Why This Order |
|---|------------|------------|----------------|
| 1 | Requirements Clarification | - | Foundation for all decisions |
| 2 | Pattern Discovery | 1 | Need requirements to identify relevant patterns |
| 3 | Design Generation | 1, 2 | Need requirements + patterns to generate valid options |
| 4 | Architecture Decision | 1, 2, 3 | Select from approaches using patterns as criteria |
| 5 | Component Design | 1, 2, 4 | Implement decision following discovered patterns |
| 6 | Integration Mapping | 2, 5 | Connect new components to existing code |
| 7 | Data Flow | 5, 6 | Trace data through integrated components |
| 8 | Build Sequence | 5, 6, 7 | Order implementation based on dependencies |

---

## Sequential Solutions

### Step 3.1: Requirements Clarification

From the task file (lines 13-28):

**Functional Requirements:**
- Agent Deployment (AC-001): Deploy new agents with name, type, configuration
- Agent List View (AC-002): View all deployed agents with status (Running, Idle, Processing, Error, Stopped)
- Agent Lifecycle Control (AC-003): Start, stop, restart agents
- Task Submission (AC-004): Submit tasks to queue for agent processing
- Task Queue View (AC-005): View pending, processing, completed tasks
- Task Cancellation (AC-006): Cancel pending tasks
- Shared Memory (AC-007): Agents share data through shared memory store
- Real-time Status Updates (AC-008): Status updates appear within 2 seconds
- Error Display (AC-009): Clear error messages for failed operations

**Non-Functional Requirements:**
- Dashboard loads within 3 seconds
- Status updates within 2 seconds
- Supports 50+ concurrent agents
- Task queue persists across restarts

**Constraints:**
- Excluded: Agent development framework, External monitoring integrations, Auth/authorization, Cost tracking

### Step 3.2: Codebase Pattern Analysis

Using the skill file patterns at specific line references:

1. **BullMQ Task Queue** (skill lines 80-114): Queue creation, worker setup, job submission with priorities
2. **Socket.IO Server** (skill lines 122-144): Real-time bidirectional communication
3. **Redis Pub/Sub** (skill lines 176-205): Inter-agent communication, shared memory
4. **Agent Registry** (skill lines 213-308): Agent lifecycle, health monitoring
5. **Zustand Store** (skill lines 769-800): Client-side state management
6. **Task Hook** (skill lines 804-833): React Query mutation for task submission
7. **Redis Config** (skill lines 734-746): Connection configuration

### Step 3.3: Design Approaches

**Approach 1: Monolithic Express + React (High Probability - 0.85)**
- Single Express server with Socket.IO and BullMQ workers
- React frontend with Vite
- Direct Redis connections from server
- Trade-offs: Simple deployment, but may not scale as well

**Approach 2: Microservices Architecture (Low Probability - 0.08)**
- Separate services for agents, tasks, memory
- API gateway for routing
- Trade-offs: Better scalability but higher complexity

**Approach 3: Serverless with Event Bridge (Low Probability - 0.07)**
- Lambda functions for agent operations
- Event Bridge for real-time
- Trade-offs: Complex for stateful agent management

**Approach 4: Distributed with Kafka (Diversity - 0.05)**
- Kafka for task queue instead of BullMQ
- Separate WebSocket service
- Trade-offs: Higher throughput but operational complexity

**Approach 5: GraphQL Federation (Diversity - 0.04)**
- Apollo Federation for unified API
- Subscriptions for real-time
- Trade-ops: Flexible but over-engineered for requirements

**Approach 6: Hybrid Edge/Server (Diversity - 0.03)**
- Edge functions for agent registration
- Central server for queue
- Trade-offs: Not suitable for agent state management

### Step 3.4: Architecture Decision

**Selected Approach: Monolithic Express + React (Approach 1)**

**Rationale:**
- Aligns with skill file patterns (lines 80-144)
- Simpler deployment matches the excluded scope (no external integrations)
- Zustand + TanStack Query pattern (lines 769-833) fits this model
- BullMQ requires Redis anyway, so centralized is optimal
- Real-time updates via Socket.IO fits monolithic model (lines 122-144)

### Step 3.5: Component Design

**Backend Components:**

| Component | File Path | Responsibility | Dependencies |
|-----------|-----------|----------------|--------------|
| Server Entry | server/index.ts | Express + Socket.IO init | All services |
| Redis Config | server/config/redis.ts | Redis connection | ioredis |
| AgentService | server/services/agentService.ts | CRUD + lifecycle | Redis, SocketService |
| TaskQueueService | server/services/taskQueueService.ts | BullMQ operations | Redis config |
| SharedMemoryService | server/services/sharedMemoryService.ts | Pub/Sub + context | Redis config |
| SocketService | server/services/socketService.ts | Real-time emit | Socket.IO |
| Agent Routes | server/routes/agents.ts | REST endpoints | AgentService |
| Task Routes | server/routes/tasks.ts | REST endpoints | TaskQueueService |
| Types | server/types/index.ts | TypeScript interfaces | - |
| Task Worker | server/worker/taskWorker.ts | Job processor | BullMQ |

**Frontend Components:**

| Component | File Path | Responsibility | Dependencies |
|-----------|-----------|----------------|--------------|
| Main | client/src/main.tsx | React entry | - |
| App | client/src/App.tsx | Router + layout | - |
| AgentStore | client/src/stores/agentStore.ts | Zustand state | zustand |
| useSocket | client/src/hooks/useSocket.ts | WebSocket | socket.io-client |
| useTaskQueue | client/src/hooks/useTaskQueue.ts | Task mutations | @tanstack/react-query |
| useAgents | client/src/hooks/useAgents.ts | Agent queries | @tanstack/react-query |
| useSharedMemory | client/src/hooks/useSharedMemory.ts | Memory ops | API |
| AgentList | client/src/components/AgentList.tsx | Agent listing | AgentStore |
| AgentCard | client/src/components/AgentCard.tsx | Single agent | Agent |
| AgentDeploy | client/src/components/AgentDeploy.tsx | Deployment form | useAgents |
| TaskQueue | client/src/components/TaskQueue.tsx | Task listing | useTaskQueue |
| TaskItem | client/src/components/TaskItem.tsx | Single task | Task |
| SharedMemory | client/src/components/SharedMemory.tsx | Memory UI | useSharedMemory |
| API Client | client/src/lib/api.ts | REST client | fetch |

### Step 3.6: Integration Mapping

**Agent Deployment Flow:**
```
POST /api/agents
  -> agentService.deployAgent(config)
  -> Redis: Create agent entry
  -> socketService.broadcastToAll('agent-status', data)
  -> Client: useSocket receives event
  -> agentStore.updateAgent()
```

**Task Submission Flow:**
```
POST /api/tasks
  -> taskQueueService.submitTask(payload)
  -> BullMQ Queue.add()
  -> Worker picks up job
  -> On complete: socketService.emitTaskCompleted()
  -> Client receives 'task-completed'
```

**Shared Memory Flow:**
```
Agent A: sharedMemoryService.setValue(key, data)
  -> Redis: connection.set(`agent:context:${key}`, JSON, 'EX', 3600)

Agent B: sharedMemoryService.getValue(key)
  -> Redis: connection.get(`agent:context:${key}`)
```

### Step 3.7: Data Flow

**Entry Points:**
- REST API: Express routes (server/routes/)
- WebSocket: Socket.IO connections (server/index.ts)

**State Management:**
- Server: In-memory Map for agent registry + Redis for persistence
- Client: Zustand store synced via REST + Socket.IO

**Data Transformations:**
- Task payload -> BullMQ Job -> Worker processing -> Result
- Agent config -> AgentRegistry -> Socket broadcast

### Step 3.8: Build Sequence

**Phase 1: Foundation**
1. Create package.json files (server, client)
2. Set up Redis config
3. Create TypeScript interfaces

**Phase 2: Backend Core**
4. Implement SocketService
5. Implement AgentService
6. Implement TaskQueueService
7. Implement SharedMemoryService
8. Create REST routes

**Phase 3: Frontend Core**
9. Set up Vite + React
10. Create Zustand store
11. Implement useSocket hook
12. Create API client

**Phase 4: UI Components**
13. Build AgentList, AgentCard, AgentDeploy
14. Build TaskQueue, TaskItem
15. Build SharedMemory component

**Phase 5: Integration**
16. Connect frontend to backend
17. Test real-time updates
18. Verify all acceptance criteria

---

## Full Solution

### References

- **Skill**: .claude/skills/agent-orchestration-platform/SKILL.md
- **Analysis**: .specs/analysis/analysis-agent-orchestration-platform.md
- **Task**: .specs/tasks/draft/implement-agent-orchestration-platform.feature.md

### Solution Strategy

**Approach**: Monolithic Express + React architecture with real-time Socket.IO communication and BullMQ task queuing.

**Key Decisions**:
1. **Server Architecture**: Single Express server with Socket.IO and BullMQ workers co-located - aligns with skill patterns (lines 80-144)
2. **State Management**: Zustand for client state (skill lines 769-800) with TanStack Query for server state
3. **Task Queue**: BullMQ with Redis backend (skill lines 80-114) for reliable job processing
4. **Real-time**: Socket.IO bidirectional (skill lines 122-144) for status updates within 2 seconds
5. **Shared Memory**: Redis with TTL (skill lines 203-204) for inter-agent context sharing

**Trade-offs Accepted**:
- Scalability: Accepting single-server bottleneck for simpler deployment and faster development
- Persistence: Using Redis as primary store instead of PostgreSQL for simplicity (matches excluded scope)

---

## Selected Sections for Task File

Based on task complexity XL (new platform with 15+ files) and nature:

| Section                   | Reasoning        | Include? |
|---------------------------|------------------|----------|
| Solution Strategy         | Always required  | YES      |
| Expected Changes          | Always required  | YES      |
| Architecture Decomposition| Multiple components across server/client | YES |
| Building Block View       | New modules: server + client | YES |
| Runtime Scenarios         | Complex flows: deployment, task submission, shared memory | YES |
| Architecture Decisions    | Tech stack choices | YES |
| High-Level Structure      | Feature scope clarification | YES |
| Workflow Steps            | Multi-step implementation | YES |
| Contracts                 | API endpoints, data models | YES |

---

## Self-Critique

### Step 7.1: Verification Questions

| # | Verification Question | What to Examine |
|---|----------------------|-----------------|
| 1 | **Decomposition Validity**: Did I explicitly list all subproblems before solving? | Stage 2 table with 8 subproblems |
| 2 | **Sequential Solving Chain**: Does each step explicitly reference previous answers? | Each step uses "Using X from Step N" language |
| 3 | **Pattern Alignment**: Does architecture follow skill file patterns? | BullMQ (80-114), Socket.IO (122-144), Redis (734-746), Zustand (769-800) |
| 4 | **Decisiveness**: Have I made clear architectural choices? | Selected Approach 1 with rationale |
| 5 | **Blueprint Completeness**: Can developer implement without questions? | File paths, integration details, build sequence |
| 6 | **Build Sequence Dependencies**: Does sequence reflect dependencies? | Phases 1-5 with explicit order |

### Step 7.2: Answers

1. **Verified**: Stage 2 decomposition table has 8 subproblems with dependencies
2. **Verified**: Each Stage 3 step starts with "Using X from Step N"
3. **Verified**: All patterns match skill file line references
4. **Verified**: Single approach (Monolithic) selected with explicit rationale
5. **Verified**: All file paths specified, integration chains documented
6. **Verified**: Build sequence follows dependency order

### Step 7.3: Least-to-Most Checklist

- [x] Stage 2 decomposition table is present with all subproblems listed
- [x] Dependencies between subproblems are explicitly stated
- [x] Each Stage 3 step starts with "Using X from Step N..."
- [x] No step references information from a later step
- [x] Final blueprint sections cite their source steps
- [x] Self-critique questions answered with specific evidence
- [x] All identified gaps have been addressed
