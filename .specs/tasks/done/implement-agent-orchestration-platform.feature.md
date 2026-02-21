---
title: Implement Agent Orchestration Platform
---

> **Required Skill**: You MUST use and analyse `agent-orchestration-platform` skill before doing any modification to task file or starting implementation of it!
>
> Skill location: `.claude/skills/agent-orchestration-platform/SKILL.md`

## Initial User Prompt

Build an Agent Orchestration Platform - A dashboard to deploy, monitor, and coordinate multiple AI agents with shared memory, task queuing, and real-time status tracking.

# Description

The Agent Orchestration Platform is a centralized dashboard system that enables users to deploy, monitor, and coordinate multiple AI agents. The platform provides real-time status tracking, task queuing with priority support, and a shared memory system for inter-agent communication.

This platform addresses the operational complexity of managing multiple AI agents in production environments. Users can deploy new agents, monitor their health and status in real-time, submit tasks to dedicated queues, and enable agents to share context through a distributed memory store.

The platform is designed for DevOps engineers, ML operators, and teams running AI agent workloads who need visibility and control over their agent infrastructure.

**Scope**:
- Included: Web-based dashboard, Agent deployment/lifecycle management, Real-time status monitoring, Task queue with add/view/cancel operations, Shared memory for inter-agent data sharing
- Excluded: Agent development framework, External monitoring integrations, Authentication/authorization, Cost tracking/billing

**User Scenarios**:
1. **Primary Flow**: User deploys an agent, submits tasks, monitors processing, retrieves results
2. **Alternative Flow**: User deploys multiple agents, configures shared memory, coordinates complex workflows
3. **Error Handling**: Failed deployments show errors, crashed agents display error status, failed tasks can be retried

---

## Acceptance Criteria

Clear, testable criteria using Given/When/Then or checkbox format:

### Functional Requirements

- [ ] **[AC-001] Agent Deployment**: Users can deploy new agents by specifying name, type, and configuration
  - Given: User is on the dashboard with deployment form access
  - When: User enters valid agent name, type, and configuration, then clicks Deploy
  - Then: Agent appears in the agent list with "Running" status within 30 seconds

- [ ] **[AC-002] Agent List View**: Users can view a list of all deployed agents with their current status
  - Given: Multiple agents have been deployed
  - When: User opens the dashboard
  - Then: All deployed agents are displayed with their current status (Running, Idle, Processing, Error, Stopped)

- [ ] **[AC-003] Agent Lifecycle Control**: Users can start, stop, and restart agents from the dashboard
  - Given: An agent exists in the system
  - When: User clicks Stop on a running agent
  - Then: Agent status changes to "Stopped" within 5 seconds

- [ ] **[AC-004] Task Submission**: Users can submit tasks to a queue for agent processing
  - Given: At least one running agent exists
  - When: User enters task details and submits
  - Then: Task appears in the queue with "Pending" status

- [ ] **[AC-005] Task Queue View**: Users can view the task queue with pending, processing, and completed tasks
  - Given: Tasks exist in various states
  - When: User opens the task queue view
  - Then: All tasks are displayed with correct status labels (Pending, Processing, Completed, Failed)

- [ ] **[AC-006] Task Cancellation**: Users can cancel pending tasks before processing starts
  - Given: A task exists with "Pending" status
  - When: User clicks Cancel on the task
  - Then: Task status changes to "Cancelled" and task is removed from active queue

- [ ] **[AC-007] Shared Memory**: Agents can share data through a shared memory store
  - Given: Two or more agents are running
  - When: One agent writes data to shared memory with key "shared_data"
  - Then: Another agent can read the value associated with key "shared_data"

- [ ] **[AC-008] Real-time Status Updates**: Status updates appear in real-time on the dashboard
  - Given: Dashboard is open and displaying agent status
  - When: An agent's status changes
  - Then: The dashboard updates within 2 seconds without page refresh

- [ ] **[AC-009] Error Display**: Failed agent operations display clear error messages
  - Given: An agent operation fails (e.g., deployment, start, stop)
  - When: The operation completes with an error
  - Then: A clear error message is displayed explaining the failure reason

### Non-Functional Requirements (if applicable)

- [ ] **Performance**: Dashboard loads within 3 seconds on standard broadband connection
- [ ] **Performance**: Status updates appear within 2 seconds of change
- [ ] **Scalability**: System supports at least 50 concurrent agents
- [ ] **Reliability**: Task queue persists tasks across system restarts

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Code reviewed

---

## Solution Strategy

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

## Expected Changes

### Backend (Server)

```
server/
├── index.ts                              # Express + Socket.IO server entry
├── config/
│   └── redis.ts                          # Redis connection (skill lines 734-746)
├── services/
│   ├── agentService.ts                   # Agent CRUD + lifecycle
│   ├── taskQueueService.ts               # BullMQ integration (skill lines 80-114)
│   ├── sharedMemoryService.ts            # Redis Pub/Sub (skill lines 176-205)
│   └── socketService.ts                  # Real-time emit helpers (skill lines 122-144)
├── routes/
│   ├── agents.ts                         # Agent REST endpoints
│   └── tasks.ts                          # Task REST endpoints
├── types/
│   └── index.ts                          # TypeScript interfaces
└── worker/
    └── taskWorker.ts                     # BullMQ worker processor
```

### Frontend (Client)

```
client/
├── src/
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # Main app component
│   ├── stores/
│   │   └── agentStore.ts                 # Zustand store (skill lines 769-800)
│   ├── hooks/
│   │   ├── useTaskQueue.ts               # Task submission (skill lines 804-833)
│   │   ├── useSocket.ts                  # WebSocket connection (skill lines 146-168)
│   │   ├── useAgents.ts                  # Agent query hook
│   │   └── useSharedMemory.ts            # Shared memory hook
│   ├── components/
│   │   ├── AgentList.tsx                 # Agent list view
│   │   ├── AgentCard.tsx                 # Individual agent display
│   │   ├── AgentDeploy.tsx               # Deployment form
│   │   ├── TaskQueue.tsx                 # Task queue view
│   │   ├── TaskItem.tsx                  # Individual task display
│   │   └── SharedMemory.tsx              # Shared memory interface
│   ├── lib/
│   │   └── api.ts                        # REST API client
│   └── types/
│       └── index.ts                      # Shared TypeScript types
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### Configuration Files

```
.env.example                              # Environment template
docker-compose.yml                        # Redis + app container
```

---

## Architecture Decomposition

### Components

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| AgentService | Deploy, start, stop, restart agents; CRUD operations | Redis, SocketService |
| TaskQueueService | Submit, cancel, get tasks; BullMQ queue management | Redis config |
| SharedMemoryService | Set/get values; Pub/Sub messaging | Redis config |
| SocketService | Emit status updates to clients | Socket.IO |
| Socket Hook (client) | Connect to WebSocket; handle events | socket.io-client |
| Agent Store (client) | Manage agent state locally | Zustand |
| Task Hooks (client) | Submit/cancel tasks via React Query | TanStack Query |

### Interactions

```
Client ──► REST API ──► AgentService ──► Redis
                │                        │
                │                        ▼
                │                  SocketService
                │                        │
                ▼                        ▼
           Client ◄──── WebSocket ◄──────┘
```

---

## Building Block View

```
┌─────────────────────────────────────────────────────────────┐
│                   Agent Orchestration Platform              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Agent Mgmt    │  │  Task Queue     │  │ Shared Mem  │ │
│  │   (Express)     │  │  (BullMQ)       │  │ (Redis)     │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                      │                   │        │
│           └──────────┬───────────┴───────────────────┘        │
│                      ▼                                        │
│              ┌─────────────┐                                  │
│              │   Socket    │                                  │
│              │   Service   │                                  │
│              └──────┬──────┘                                  │
│                     │                                         │
├─────────────────────┼─────────────────────────────────────────┤
│                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              React Dashboard (Vite)                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │ │
│  │  │AgentList │  │TaskQueue │  │SharedMem │  │Zustand │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Runtime Scenarios

### Scenario: Agent Deployment

```
User ──► AgentDeploy form ──► POST /api/agents
                                        │
                                        ▼
                               AgentService.deployAgent()
                                        │
                                        ▼
                               Redis: Create agent entry
                                        │
                                        ▼
                               SocketService.broadcast('agent-status')
                                        │
                                        ▼
                               Client: useSocket receives event
                                        │
                                        ▼
                               AgentStore.updateAgent()
```

**State Transitions**:
```
[New] ──deploy──► [Registered] ──start──► [Running] ──stop──► [Stopped]
                                              │
                                              ▼
                                        [Processing] (when handling task)
```

### Scenario: Task Submission

```
User ──► Task form ──► POST /api/tasks
                                  │
                                  ▼
                         TaskQueueService.submitTask()
                                  │
                                  ▼
                         BullMQ: Queue.add()
                                  │
                                  ▼
                         Worker: Pick up job
                                  │
                                  ▼
                         [Process task]
                                  │
                                  ▼
                         SocketService.emitTaskCompleted()
                                  │
                                  ▼
                         Client receives 'task-completed'
```

### Scenario: Shared Memory

```
Agent A ──► SharedMemoryService.setValue('key', data)
                                          │
                                          ▼
                                   Redis: SET key value EX 3600

Agent B ──► SharedMemoryService.getValue('key')
                                          │
                                          ▼
                                   Redis: GET key
```

---

## Architecture Decisions

### Decision 1: Monolithic Server Architecture

**Status**: Accepted

**Context**: Need to implement agent deployment, task queuing, and real-time updates

**Options**:
1. Monolithic Express + co-located workers (selected)
2. Microservices with API gateway
3. Serverless with Event Bridge

**Decision**: Single Express server with Socket.IO and BullMQ workers co-located

**Consequences**:
- Simpler deployment and debugging
- Lower operational overhead
- May require horizontal scaling for >50 concurrent agents

### Decision 2: Client State Management

**Status**: Accepted

**Context**: Need to sync agent state across React components

**Options**:
1. Zustand + TanStack Query (selected)
2. Redux + RTK Query
3. React Context

**Decision**: Zustand for local state, TanStack Query for server state

**Consequences**:
- Lightweight and performant
- Good separation of concerns
- Built-in caching

### Decision 3: Real-time Communication

**Status**: Accepted

**Context**: Need sub-2-second status updates

**Options**:
1. Socket.IO bidirectional (selected)
2. Server-Sent Events (SSE)
3. Polling

**Decision**: Socket.IO for bidirectional real-time updates

**Consequences**:
- Auto-reconnection built-in
- Supports rooms for targeted updates
- Slightly more overhead than SSE

---

## High-Level Structure

```
Feature: Agent Orchestration Platform
├── Entry Point: REST API (Express) + WebSocket (Socket.IO)
├── Core Logic: AgentService, TaskQueueService, SharedMemoryService
├── Data Layer: Redis (queue + shared memory), In-memory Map (agent registry)
└── Output: React Dashboard with real-time updates
```

---

## Workflow Steps

### Phase 1: Foundation
1. Create server/package.json and client/package.json
2. Install dependencies (BullMQ, Socket.IO, ioredis, Express for server; React, Zustand, TanStack Query for client)
3. Set up Redis config (skill lines 734-746)
4. Create TypeScript interfaces

### Phase 2: Backend Core
5. Implement SocketService (skill lines 122-144)
6. Implement AgentService with lifecycle management
7. Implement TaskQueueService (skill lines 80-114)
8. Implement SharedMemoryService (skill lines 176-205)
9. Create REST routes for agents and tasks
10. Create BullMQ worker

### Phase 3: Frontend Core
11. Set up Vite + React + TypeScript
12. Create Zustand store (skill lines 769-800)
13. Implement useSocket 146-168 hook (skill lines)
14. Create API client library

### Phase 4: UI Components
15. Build AgentList, AgentCard, AgentDeploy components
16. Build TaskQueue, TaskItem components
17. Build SharedMemory component

### Phase 5: Integration
18. Connect frontend to backend APIs
19. Connect WebSocket events to Zustand store
20. Test real-time updates (<2 seconds)
21. Verify all 9 acceptance criteria

---

## Contracts

### API Endpoints

```
POST   /api/agents           # Deploy new agent
GET    /api/agents           # List all agents
GET    /api/agents/:id       # Get agent by ID
POST   /api/agents/:id/start # Start agent
POST   /api/agents/:id/stop  # Stop agent
POST   /api/agents/:id/restart # Restart agent
DELETE /api/agents/:id       # Delete agent

POST   /api/tasks            # Submit new task
GET    /api/tasks            # List tasks (filter by status)
GET    /api/tasks/:id        # Get task by ID
DELETE /api/tasks/:id        # Cancel task
POST   /api/tasks/:id/retry  # Retry failed task

GET    /api/memory/:key      # Get shared memory value
POST   /api/memory          # Set shared memory value
DELETE /api/memory/:key     # Delete shared memory value
```

### Data Models

```typescript
interface Agent {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  status: 'idle' | 'running' | 'processing' | 'error' | 'stopped';
  createdAt: Date;
  updatedAt: Date;
}

interface Task {
  id: string;
  agentId: string;
  type: string;
  data: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  result?: unknown;
  error?: string;
}
```

### WebSocket Events

```
Server → Client:
  'agent-status'      # Agent status changed
  'task-status'       # Task status changed
  'task-completed'    # Task completed with result
  'error'             # Error occurred

Client → Server:
  'join-agent'        # Join agent-specific room
  'leave-agent'       # Leave agent room
```

---

## Implementation Process

You MUST launch for each step a separate agent, instead of performing all steps yourself. And for each step marked as parallel, you MUST launch separate agents in parallel.

**CRITICAL:** For each agent you MUST:
1. Use the **Agent** type specified in the step (e.g., `haiku`, `sonnet`, `opus`)
2. Provide path to task file and prompt which step to implement
3. Require agent to implement exactly that step, not more, not less, not other steps

### Parallelization Overview

```
Phase 1: Setup (parallel)
Step 1 (Test Infrastructure) [haiku]
        │
        └──────┬───────────────────┐
               │                   │
               ▼                   ▼
Step 2 (Project Configs) [haiku]   (parallel with Step 1)
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
Step 3    Step 4    Step 5
(TypeScript) (Redis Config) (Client Config)
[sdd:developer] [sdd:developer] [sdd:developer]
    │          │          │
    └──────────┼──────────┘
               │
               ▼
Step 6        Step 16
(Express)     (Zustand)
[sdd:developer] [sdd:developer]
    │               │
    ├─────────┬─────┘
    │         │
    ▼         ▼
Step 7     Step 8     Step 9     Step 10
(Socket)   (Agent)   (TaskQueue) (SharedMem)
[sdd:developer] [sdd:developer] [sdd:developer] [sdd:developer]
    │         │         │         │
    └─────────┼─────────┼─────────┘
              │         │
    ┌─────────┴─────────┴─────────┐
    ▼         ▼         ▼
Step 11   Step 12   Step 13
(Agent)   (Task)    (Mem)
[sdd:developer] [sdd:developer] [sdd:developer]
    Routes   Routes   Routes
              │
              └────────┬────────┐
                       ▼        ▼
                   Step 14   Step 15
                   (Worker)  (React)
                   [sdd:developer] [sdd:developer]
                       │        │
                       └────┬───┘
                            │
                            ▼
                       Step 17
                       (useSocket)
                       [sdd:developer]
                            │
                            ▼
                       Step 18
                       (API Client)
                       [sdd:developer]
                            │
                            ▼
                       Step 19
                       (Query Hooks)
                       [sdd:developer]
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          Step 20      Step 21       Step 22
          (Agent UI)   (Task UI)     (Memory UI)
          [sdd:developer] [sdd:developer] [sdd:developer]
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
                       Step 23
                       (Dashboard)
                       [sdd:developer]
                            │
                            ▼
                       Step 24
                       (Integration)
                       [sdd:developer]
                            │
                            ▼
                       Step 25
                       (Real-time Test)
                       [sdd:qa-engineer]
                            │
                            ▼
                       Step 26
                       (Verify ACs)
                       [sdd:qa-engineer]
```

### Implementation Strategy

**Approach**: Mixed (Bottom-Up + Top-Down)
**Rationale**:
- Bottom-Up for foundational elements: TypeScript interfaces, Redis config, and client setup have no internal dependencies and establish the contract for everything else
- Top-Down for backend services: Express server entry establishes the workflow, then services are implemented to support it
- Frontend builds on backend contracts using bottom-up approach (hooks, stores first, then components)

### Phase Overview

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational
    │
    ▼
Phase 3: User Stories
    │
    ▼
Phase 4: Polish
```

### User Stories Mapping

The implementation addresses the following user scenarios:

#### User Story 1: Primary Flow (AC-001, AC-002, AC-003, AC-004, AC-005, AC-008)
**Scenario**: User deploys an agent, submits tasks, monitors processing, retrieves results

**Implementation Steps**:
- Step 8: AgentService - deploy, start, stop agents
- Step 11: Agent REST Routes - POST /api/agents
- Step 20: Agent UI Components - AgentList, AgentCard, AgentDeploy
- Step 9: TaskQueueService - submit tasks
- Step 12: Task REST Routes - POST /api/tasks
- Step 21: Task Queue UI Components - TaskQueue, TaskItem
- Step 7: SocketService - real-time status updates
- Step 17: useSocket hook - receive real-time events
- Step 25: Test Real-time Updates - verify AC-008

#### User Story 2: Alternative Flow (AC-002, AC-007)
**Scenario**: User deploys multiple agents, configures shared memory, coordinates complex workflows

**Implementation Steps**:
- Step 8: AgentService - multiple agent management
- Step 10: SharedMemoryService - Redis key-value store
- Step 13: Shared Memory REST Routes
- Step 22: Shared Memory UI Component
- Step 23: Dashboard Layout - navigation between Agents, Tasks, Memory

#### User Story 3: Error Handling (AC-006, AC-009)
**Scenario**: Failed deployments show errors, crashed agents display error status, failed tasks can be retried

**Implementation Steps**:
- Step 8: AgentService - error status handling
- Step 9: TaskQueueService - cancelTask, retryTask
- Step 14: BullMQ Worker - error propagation
- Step 21: Task UI - cancel/retry buttons
- Step 26: Verify AC-006 (Task Cancellation), AC-009 (Error Display)

---

## Phase 1: Setup

### Step 1: Create Test Infrastructure

**Model:** haiku
**Agent:** haiku
**Depends on:** None
**Parallel with:** Step 2

**Goal**: Set up Jest/Vitest for unit testing across server and client

#### Expected Output

- `server/package.json` with Jest and testing dependencies
- `server/jest.config.js` or `vitest.config.ts` - Test configuration
- `server/tsconfig.json` updated for tests
- Basic test file structure created

#### Success Criteria

- [X] `npm test` exits with code 0 in server directory
- [X] TypeScript modules can be imported in tests
- [X] Test coverage command runs: `npm run test:coverage` exits with code 0
- [X] Basic test passes: `expect(true).toBe(true)` exits with code 0

#### Verification

**Level:** Single Judge
**Artifact:** `server/jest.config.js` or `server/vitest.config.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Test Framework Setup | 0.30 | Jest/Vitest properly configured with TypeScript preset |
| Test Execution | 0.25 | `npm test` exits with code 0 |
| Coverage Command | 0.20 | Test coverage command runs successfully |
| Module Resolution | 0.15 | TypeScript modules can be imported in tests |
| Project Structure | 0.10 | Test file structure created |

**Reference Pattern:** skill lines 714-726 (package.json dependencies)

---

#### Subtasks

- [X] Add Jest dependencies to `/server/package.json`: `npm install --save-dev jest ts-jest @types/jest jest-environment-node`
- [X] Create `/server/jest.config.js` with TypeScript preset and module path mapping
- [X] Create `/server/tests/setup.ts` for global test setup
- [X] Create `/server/tests/agentService.test.ts` - Placeholder test file

#### Blockers

- None (prerequisites complete before starting)

#### Risks

- **Dependency conflicts**: Jest may conflict with existing dependencies
  - Mitigation: Use Vitest as alternative if Jest conflicts arise (Vitest shares config with Vite)
  - Impact: Low | Likelihood: Low

#### Complexity: Small

#### Dependencies: None (Level 0)

#### Uncertainty Rating: Low

---

### Step 2: Create Project Configuration Files

**Model:** haiku
**Agent:** haiku
**Depends on:** None
**Parallel with:** Step 1

**Goal**: Set up package.json files for server and client with all required dependencies

#### Expected Output

- `server/package.json` with Express, Socket.IO, BullMQ, ioredis dependencies
- `client/package.json` with React, Vite, Zustand, TanStack Query, Socket.IO client

#### Success Criteria

- [X] `server/package.json` exists with all backend dependencies
- [X] `client/package.json` exists with all frontend dependencies
- [X] Both packages pass validation: `npm ls --depth=0` exits with code 0

#### Verification

**Level:** None
**Rationale:** Simple file creation. Success is binary - files either exist with correct dependencies or they don't. npm ls validates structure automatically.

---

#### Subtasks

- [X] Create `/server/package.json` with dependencies from skill lines 714-726
- [X] Create `/client/package.json` with dependencies from skill line 728

#### Blockers

- None (prerequisites complete before starting)

#### Risks

- **Package version conflicts**: Different testing libraries may conflict
  - Mitigation: Use Vitest (compatible with Vite config)
  - Impact: Low | Likelihood: Medium

#### Complexity: Small

#### Dependencies: None

#### Uncertainty Rating: Low

---

## Phase 2: Foundational

### Step 3: Create TypeScript Interfaces

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 2
**Parallel with:** Step 4, Step 5

**Goal**: Define data structures for Agent, Task, and SharedMemory

#### Expected Output

- `server/types/index.ts` with Agent, Task, and related interfaces
- `client/src/types/index.ts` with shared TypeScript types

#### Success Criteria

- [X] Agent interface includes: id, name, type, config, status, createdAt, updatedAt
- [X] Task interface includes: id, agentId, type, data, status, priority, createdAt, updatedAt, result, error
- [X] SharedMemoryValue interface for key-value storage
- [X] WebSocket event types defined
- [X] TypeScript compilation succeeds: `npx tsc --noEmit` exits with code 0

#### Verification

**Level:** Single Judge
**Artifact:** `server/types/index.ts`, `client/src/types/index.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Agent Interface | 0.25 | All required fields present (id, name, type, config, status, createdAt, updatedAt) |
| Task Interface | 0.25 | All required fields present including result and error |
| SharedMemory Interface | 0.15 | Key-value storage interface defined |
| Socket Events | 0.15 | WebSocket event types defined |
| Type Safety | 0.20 | TypeScript compiles without errors |

**Reference Pattern:** task file lines 441-463 (data models)

---

#### Subtasks

- [X] Create `/server/types/index.ts` with interfaces matching data models (lines 441-463)
  - Exports: `Agent`, `Task`, `TaskStatus`, `AgentStatus`, `SharedMemoryValue`, `SocketEvents`
- [X] Create `/client/src/types/index.ts` with shared types
  - Must mirror server types for API responses

#### Blockers

- Step 2 (package.json needed for TypeScript to work)

#### Risks

- **Type mismatch between client/server**: API response types may drift
  - Mitigation: Use shared package or generate types from OpenAPI spec
  - Impact: Medium | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 2

#### Uncertainty Rating: Low

---

### Step 4: Create Redis Configuration

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 2
**Parallel with:** Step 3, Step 5

**Goal**: Set up Redis connection for task queue and shared memory

#### Expected Output

- `server/config/redis.ts` - Redis connection configuration

#### Success Criteria

- [X] Redis connection configured with host, port, password support
- [X] Retry strategy configured (exponential backoff)
- [X] Connection exported for use by services
- [ ] Connection test passes: `redis.ping()` returns 'PONG'

#### Verification

**Level:** Single Judge
**Artifact:** `server/config/redis.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Connection Config | 0.30 | Host, port, password support properly configured |
| Retry Strategy | 0.25 | Exponential backoff configured |
| Export Structure | 0.20 | Redis client exported for services |
| Connection Test | 0.25 | ping() returns 'PONG' |

**Reference Pattern:** skill lines 734-746

---

#### Subtasks

- [ ] Create `/server/config/redis.ts` following skill pattern (lines 734-746)
  - Exports: `redis: Redis`, `getRedis(): Redis`
  - Function signature: `createRedisClient(): Redis`

#### Blockers

- Step 2 (package.json needed for dependencies)

#### Risks

- **Redis server not running**: Connection will fail without Redis
  - Mitigation: Use docker-compose for local dev, provide startup script
  - Impact: High | Likelihood: Low
- **Connection timeout**: Slow Redis response may hang server
  - Mitigation: Configure connection timeout (5s) and retry strategy
  - Impact: Medium | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 2

#### Uncertainty Rating: Low

---

### Step 5: Create Client Build Configuration

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 2
**Parallel with:** Step 3, Step 4

**Goal**: Set up Vite, TypeScript, and Tailwind for React client

#### Expected Output

- `client/vite.config.ts` - Vite configuration
- `client/tsconfig.json` - TypeScript configuration
- `client/tailwind.config.js` - Tailwind CSS configuration

#### Success Criteria

- [X] Vite config includes React plugin and proxy to backend (/api -> http://localhost:3001)
- [X] TypeScript config supports React JSX (jsx: "react-jsx")
- [X] Tailwind configured with content paths (src/**/*.{ts,tsx})
- [X] Build succeeds: `cd client && npm run build` exits with code 0
- [X] Dev server starts: `npm run dev` launches and exits with code 0

#### Verification

**Level:** None
**Rationale:** Standard build configuration files. Success is binary - configs either exist and work or they don't. npm run build validates automatically.

---

#### Subtasks

- [X] Create `/client/vite.config.ts` with React plugin, proxy config
- [X] Create `/client/tsconfig.json` with paths for @/* aliases
- [X] Create `/client/tailwind.config.js` with content patterns
- [X] Create `/client/index.html` with root div

#### Blockers

- Step 2 (client package.json needed)

#### Risks

- **Proxy not working**: API calls may fail in development
  - Mitigation: Test proxy configuration early, provide fallback env var for API_URL
  - Impact: Medium | Likelihood: Low
- **Tailwind not applying styles**: CSS not processing correctly
  - Mitigation: Verify content paths match source files
  - Impact: Low | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 2

#### Uncertainty Rating: Low

---

### Step 6: Create Express Server Entry

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 3, Step 4, Step 5
**Parallel with:** Step 16

**Goal**: Set up Express server with Socket.IO and CORS

#### Expected Output

- `server/index.ts` - Express + Socket.IO server entry point

#### Success Criteria

- [ ] Express server starts on configured port (default 3001)
- [ ] Socket.IO attached with CORS configuration (origin: "*")
- [ ] Health check endpoint returns 200: `curl http://localhost:3001/health` returns {"status":"ok"}
- [ ] Server starts without errors: `npm run dev` in server dir exits with code 0

#### Verification

**Level:** Panel of 2 Judges with Aggregated Voting
**Artifact:** `server/index.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Server Startup | 0.25 | Express server starts on configured port without errors |
| Socket.IO Integration | 0.25 | Socket.IO attached correctly with CORS (origin: "*") |
| Middleware Configuration | 0.20 | CORS, JSON parser, health check properly configured |
| Error Handling | 0.15 | Global error handler present |
| Code Quality | 0.15 | Follows project patterns, TypeScript strict |

**Reference Pattern:** skill lines 126-128 (Express + Socket.IO setup)

---

#### Subtasks

- [X] Create `/server/src/index.ts` with Express + Socket.IO setup (skill lines 126-128)
  - Exports: `app: Express`, `io: Server`, `server: http.Server`
  - Function signature: `createServer(): Promise<http.Server>`
- [X] Add CORS middleware: `app.use(cors({ origin: '*' }))`
- [X] Add JSON body parser: `app.use(express.json())`
- [X] Add health check endpoint: `app.get('/health', (req, res) => res.json({ status: 'ok' }))`

#### Blockers

- Step 3 (types needed for TypeScript), Step 4 (Redis config available)

#### Risks

- **Port conflicts**: Another process using PORT 3001
  - Mitigation: Make PORT configurable via env var, provide .env.example
  - Impact: Medium | Likelihood: Low

#### Complexity: Medium

#### Dependencies: Steps 3, 4

#### Uncertainty Rating: Low

---

### Step 7: Create SocketService

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 6, Step 3
**Parallel with:** Step 8, Step 9, Step 10

**Goal**: Create real-time event emission service

#### Expected Output

- `server/services/socketService.ts` - Socket.IO helper functions

#### Success Criteria

- [X] SocketService exports: `emitAgentStatus(agent: Agent): void`
- [X] SocketService exports: `emitTaskStatus(task: Task): void`
- [X] SocketService exports: `emitError(error: string): void`
- [X] Socket.IO instance properly typed and exported: `io: Server`
- [X] Unit test passes: `npm test -- socketService.test.ts` exits with code 0

#### Verification

**Level:** Panel of 2 Judges with Aggregated Voting
**Artifact:** `server/services/socketService.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Agent Status Emission | 0.25 | emitAgentStatus correctly broadcasts to all clients |
| Task Status Emission | 0.25 | emitTaskStatus correctly broadcasts to all clients |
| Error Emission | 0.20 | emitError broadcasts error to all clients |
| Type Safety | 0.15 | Socket.IO instance properly typed |
| Test Coverage | 0.15 | Unit tests pass for socket events |

**Reference Pattern:** skill lines 142-144

---

#### Subtasks

- [X] Create `/server/services/socketService.ts` following skill pattern (lines 142-144)
  - Exports: `io: Server`, `initializeSocket(server: http.Server): Server`, `emitAgentStatus(agent: Agent): void`, `emitTaskStatus(task: Task): void`, `emitError(message: string): void`
- [X] Add typed event emission functions using io.emit()
- [X] Write unit tests in `/server/tests/socketService.test.ts`

#### Blockers

- Step 6 (server entry needed for Socket.IO initialization)

#### Risks

- **Socket.IO not initialized**: Calling emit before server starts
  - Mitigation: Export initializeSocket() to be called after server creation
  - Impact: High | Likelihood: Low

#### Complexity: Medium

#### Dependencies: Steps 6, 3

#### Uncertainty Rating: Low

---

### Step 8: Create AgentService

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 7, Step 3
**Parallel with:** Step 9, Step 10

**Goal**: Implement agent lifecycle management (deploy, start, stop, restart, CRUD)

#### Expected Output

- `server/services/agentService.ts` - Agent CRUD and lifecycle operations

#### Success Criteria

- [ ] `deployAgent(name: string, type: string, config: Record<string, unknown>): Agent` - creates new agent with "idle" status, returns Agent object
- [ ] `startAgent(id: string): Agent` - transitions agent to "running", returns updated Agent
- [ ] `stopAgent(id: string): Agent` - transitions agent to "stopped", returns updated Agent
- [ ] `restartAgent(id: string): Agent` - stops then starts agent, returns updated Agent
- [ ] `getAgent(id: string): Agent | undefined` - returns single agent or undefined
- [ ] `listAgents(): Agent[]` - returns array of all agents
- [ ] `deleteAgent(id: string): boolean` - removes agent, returns success
- [ ] Emits socket events on status changes via SocketService
- [ ] Unit tests pass: `npm test -- agentService.test.ts` exits with code 0

#### Verification

**Level:** Panel of 2 Judges with Aggregated Voting
**Artifact:** `server/services/agentService.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Lifecycle Operations | 0.25 | deploy/start/stop/restart work correctly with proper state transitions |
| CRUD Operations | 0.20 | getAgent, listAgents, deleteAgent work correctly |
| Socket Integration | 0.20 | Emits status changes via SocketService on state transitions |
| Error Handling | 0.20 | Handles invalid IDs, invalid state transitions gracefully |
| Test Coverage | 0.15 | Unit tests pass for all operations |

---

#### Subtasks

- [X] Create `/server/services/agentService.ts` with all CRUD operations
  - Exports: `deployAgent`, `startAgent`, `stopAgent`, `restartAgent`, `getAgent`, `listAgents`, `deleteAgent`
  - Use in-memory Map<string, Agent> for agent registry
- [X] Integrate SocketService for real-time updates: `emitAgentStatus(agent)` after each state change
- [X] Write unit tests in `/server/tests/agentService.test.ts`
  - Test: `deployAgent()` creates agent with correct properties
  - Test: `startAgent()` transitions status to running
  - Test: `stopAgent()` transitions status to stopped

#### Blockers

- Step 7 (SocketService needed for events)

#### Risks

- **Agent state lost on restart**: In-memory Map not persisted
  - Mitigation: Acceptable per Solution Strategy - agents re-deployed after restart
  - Impact: Low | Likelihood: High (by design)

#### Complexity: Medium

#### Dependencies: Steps 7, 3

#### Uncertainty Rating: Low

---

### Step 9: Create TaskQueueService

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 4, Step 3
**Parallel with:** Step 7, Step 8, Step 10

**Goal**: Implement BullMQ task queue integration

#### Expected Output

- `server/services/taskQueueService.ts` - BullMQ queue management

#### Success Criteria

- [ ] `submitTask(agentId: string, type: string, data: Record<string, unknown>, priority?: number): Promise<Task>` - adds task to queue, returns Task
- [ ] `cancelTask(taskId: string): Promise<boolean>` - attempts to cancel pending task, returns success
- [ ] `getTask(id: string): Promise<Task | null>` - returns task details or null
- [ ] `listTasks(status?: TaskStatus): Promise<Task[]>` - returns tasks with optional status filter
- [ ] `retryTask(taskId: string): Promise<Task>` - retries failed task, returns updated Task
- [ ] Queue properly configured with Redis connection
- [ ] Unit tests pass: `npm test -- taskQueueService.test.ts` exits with code 0

#### Verification

**Level:** Panel of 2 Judges with Aggregated Voting
**Artifact:** `server/services/taskQueueService.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Task Submission | 0.25 | submitTask creates task with correct properties and adds to queue |
| Task Cancellation | 0.20 | cancelTask marks cancelled properly (considers BullMQ limitations) |
| Task Retrieval | 0.20 | getTask, listTasks work correctly with optional status filter |
| Retry Logic | 0.15 | retryTask creates new job from failed task |
| Redis Integration | 0.20 | Queue properly configured with Redis connection |

**Reference Pattern:** skill lines 80-114 (BullMQ pattern)

---

#### Subtasks

- [ ] Create `/server/services/taskQueueService.ts` following skill pattern (lines 80-114)
  - Exports: `submitTask`, `cancelTask`, `getTask`, `listTasks`, `retryTask`, `queue: Queue`
  - Function signatures must match BullMQ Job interface
- [ ] Implement submit, cancel, get, list, retry functions
- [ ] Write unit tests in `/server/tests/taskQueueService.test.ts`
  - Test: `submitTask()` creates task with correct properties
  - Test: `cancelTask()` marks cancelled task properly

#### Blockers

- Step 4 (Redis config needed)

#### Risks

- **BullMQ task cancellation not native**: Worker may pick up cancelled task
  - Mitigation: Check task status in worker before processing (see Step 13)
  - Impact: High | Likelihood: Medium

#### Complexity: Medium

#### Dependencies: Steps 4, 3

#### Uncertainty Rating: Medium

---

### Step 10: Create SharedMemoryService

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 4, Step 3
**Parallel with:** Step 7, Step 8, Step 9

**Goal**: Implement Redis-based shared memory for inter-agent communication

#### Expected Output

- `server/services/sharedMemoryService.ts` - Redis key-value store with TTL

#### Success Criteria

- [ ] `setValue(key: string, value: string, ttl?: number): Promise<void>` - stores value with optional TTL (default 3600s), uses Redis SET key value EX ttl
- [ ] `getValue(key: string): Promise<string | null>` - retrieves value, returns null if not found
- [ ] `deleteValue(key: string): Promise<boolean>` - removes value, returns success
- [ ] `listKeys(pattern?: string): Promise<string[]>` - lists all keys matching pattern (default "*")
- [ ] Uses Redis EX for TTL expiration (skill lines 203-204)
- [ ] Unit tests pass: `npm test -- sharedMemoryService.test.ts` exits with code 0

#### Verification

**Level:** Single Judge
**Artifact:** `server/services/sharedMemoryService.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Set Value | 0.25 | setValue stores with TTL (default 3600s) using Redis EX |
| Get Value | 0.25 | getValue returns string or null if not found |
| Delete Value | 0.20 | deleteValue removes key, returns success boolean |
| List Keys | 0.15 | listKeys supports pattern matching |
| Test Coverage | 0.15 | Unit tests pass for roundtrip operations |

**Reference Pattern:** skill lines 176-205

---

#### Subtasks

- [X] Create `/server/services/sharedMemoryService.ts` following skill pattern (lines 176-205)
  - Exports: `setValue`, `getValue`, `deleteValue`, `listKeys`
  - Function signatures: `setValue(key, value, ttl?)`, `getValue(key)`, `deleteValue(key)`, `listKeys(pattern?)`
- [X] Implement set, get, delete, list operations using ioredis
- [X] Write unit tests in `/server/tests/sharedMemoryService.test.ts`
  - Test: `setValue()` and `getValue()` roundtrip works

#### Blockers

- Step 4 (Redis config needed)

#### Risks

- **Data loss on TTL expiration**: Values disappear after TTL
  - Mitigation: Document TTL behavior, allow refresh operations
  - Impact: Low | Likelihood: Low (by design)

#### Complexity: Medium

#### Dependencies: Steps 4, 3

#### Uncertainty Rating: Low

---

### Step 11: Create Agent REST Routes

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 8
**Parallel with:** Step 12, Step 13

**Goal**: Expose agent operations via REST API

#### Expected Output

- `server/src/routes/agentRoutes.ts` - Express router for agent endpoints

#### Success Criteria

- [X] POST /api/agents - deploy new agent, returns 201 with Agent object
- [X] GET /api/agents - list all agents, returns 200 with Agent[]
- [X] GET /api/agents/:id - get single agent, returns 200 with Agent or 404
- [X] POST /api/agents/:id/start - start agent, returns 200 with updated Agent
- [X] POST /api/agents/:id/stop - stop agent, returns 200 with updated Agent
- [X] POST /api/agents/:id/restart - restart agent, returns 200 with updated Agent
- [X] DELETE /api/agents/:id - delete agent, returns 204
- [X] API test passes: `curl -X POST http://localhost:3001/api/agents -H "Content-Type: application/json" -d '{"name":"test","type":"worker"}'` exits with code 0

#### Verification

**Level:** Per-Endpoint Judges (7 separate evaluations in parallel)
**Artifacts:**
- POST /api/agents
- GET /api/agents
- GET /api/agents/:id
- POST /api/agents/:id/start
- POST /api/agents/:id/stop
- POST /api/agents/:id/restart
- DELETE /api/agents/:id
**Threshold:** 4.0/5.0

**Rubric (per endpoint):**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Endpoint Completeness | 0.25 | Endpoint implemented with correct HTTP method and path |
| Request Validation | 0.20 | Required fields validated, returns 400 for invalid input |
| Response Codes | 0.20 | Correct status codes (201/200/404/400/204) |
| Error Handling | 0.20 | Returns meaningful error messages |
| Route Structure | 0.15 | Follows Express routing patterns |

**Reference Pattern:** API Contracts section (lines 419-437)

---

#### Subtasks

- [ ] Create `/server/routes/agents.ts` with all endpoints matching API Contracts
  - Exports: `router: Router`
  - Route handlers call AgentService functions directly
- [ ] Integrate with AgentService
- [ ] Add validation for request bodies (name, type required)
- [ ] Add error handling (try/catch, return 400/404/500)

#### Blockers

- Step 8 (AgentService needed)

#### Risks

- **Invalid request body**: Missing required fields causes 500
  - Mitigation: Add validation middleware, return 400 for invalid input
  - Impact: Medium | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 8

#### Uncertainty Rating: Low

---

### Step 12: Create Task REST Routes

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 9
**Parallel with:** Step 11, Step 13

**Goal**: Expose task queue operations via REST API

#### Expected Output

- `server/routes/tasks.ts` - Express router for task endpoints

#### Success Criteria

- [ ] POST /api/tasks - submit new task, returns 201 with Task object
- [ ] GET /api/tasks - list tasks, returns 200 with Task[] (supports ?status=pending)
- [ ] GET /api/tasks/:id - get task by ID, returns 200 with Task or 404
- [ ] DELETE /api/tasks/:id - cancel task, returns 200 with success or 400 if not cancellable
- [ ] POST /api/tasks/:id/retry - retry failed task, returns 200 with Task
- [ ] API test passes: `curl http://localhost:3001/api/tasks` exits with code 0

#### Verification

**Level:** Per-Endpoint Judges (6 separate evaluations in parallel)
**Artifacts:**
- POST /api/tasks
- GET /api/tasks
- GET /api/tasks/:id
- DELETE /api/tasks/:id
- POST /api/tasks/:id/retry
**Threshold:** 4.0/5.0

**Rubric (per endpoint):**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Endpoint Completeness | 0.25 | Endpoint implemented with correct HTTP method and path |
| Request Validation | 0.20 | Required fields validated (agentId, type, data) |
| Response Codes | 0.20 | Correct status codes (201/200/404/400) |
| Query Params | 0.15 | Status filter (?status=pending) works correctly |
| Error Handling | 0.20 | Returns meaningful error messages |

**Reference Pattern:** API Contracts section (lines 419-437)

---

#### Subtasks

- [X] Create `/server/routes/tasks.ts` with all endpoints matching API Contracts
  - Exports: `router: Router`
  - Route handlers call TaskQueueService functions
- [X] Integrate with TaskQueueService
- [X] Add validation for request bodies (agentId, type, data required)
- [X] Add query param parsing for status filter

#### Blockers

- Step 9 (TaskQueueService needed)

#### Risks

- **Task already processing**: Cannot cancel
  - Mitigation: Return 400 with message "Task already processing"
  - Impact: Low | Likelihood: Medium

#### Complexity: Small

#### Dependencies: Step 9

#### Uncertainty Rating: Low

---

### Step 13: Create Shared Memory REST Routes

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 10
**Parallel with:** Step 11, Step 12

**Goal**: Expose shared memory operations via REST API

#### Expected Output

- `server/routes/memory.ts` - Express router for shared memory endpoints

#### Success Criteria

- [X] GET /api/memory/:key - get shared memory value, returns 200 with {key, value} or 404
- [X] POST /api/memory - set shared memory value, returns 201 with {key}
- [X] DELETE /api/memory/:key - delete shared memory value, returns 204
- [X] API test passes: `curl -X POST http://localhost:3001/api/memory -H "Content-Type: application/json" -d '{"key":"test","value":"hello"}'` exits with code 0

#### Verification

**Level:** Single Judge
**Artifact:** `server/routes/memory.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Endpoint Completeness | 0.30 | All 3 endpoints implemented (GET, POST, DELETE) |
| Request Validation | 0.25 | Key validation for POST |
| Response Codes | 0.25 | Correct 200/201/204/404 codes |
| Error Handling | 0.20 | Returns meaningful error messages |

---

#### Subtasks

- [X] Create `/server/routes/memory.ts` with all endpoints matching API Contracts
  - Exports: `router: Router`
  - Route handlers call SharedMemoryService functions
- [X] Integrate with SharedMemoryService
- [X] Add validation (key required for POST)

#### Blockers

- Step 10 (SharedMemoryService needed)

#### Risks

- **Key not found**: GET returns 404
  - Mitigation: Return 404 with clear message "Key not found"
  - Impact: Low | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 10

#### Uncertainty Rating: Low

---

### Step 14: Create BullMQ Worker

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 9, Step 7
**Parallel with:** Step 15

**Goal**: Process tasks from the queue

#### Expected Output

- `server/worker/taskWorker.ts` - BullMQ worker for task processing

#### Success Criteria

- [ ] Worker listens to "agent-tasks" queue
- [ ] Processes jobs with concurrency limit (default 10)
- [ ] Updates task status: pending -> processing -> completed/failed
- [ ] Handles cancellation check before processing (skip if cancelled)
- [ ] Emits socket events on status changes via SocketService
- [ ] Worker starts without errors: `npm run dev` shows worker initialized

#### Verification

**Level:** Single Judge
**Artifact:** `server/worker/taskWorker.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Queue Listener | 0.25 | Worker listens to "agent-tasks" queue |
| Concurrency | 0.20 | Processes jobs with concurrency limit (default 10) |
| Status Updates | 0.20 | Updates task status: pending -> processing -> completed/failed |
| Cancellation Check | 0.20 | Checks cancellation before processing |
| Socket Integration | 0.15 | Emits socket events on status changes |

**Reference Pattern:** skill lines 91-102

---

#### Subtasks

- [X] Create `/server/worker/taskWorker.ts` following skill pattern (lines 91-102)
  - Exports: `startWorker(): void`, `stopWorker(): Promise<void>`
  - Uses BullMQ Worker with processor function
- [X] Implement job processor with status tracking
- [X] Add cancellation check: fetch task status before processing, skip if cancelled
- [X] Integrate SocketService: `emitTaskStatus(task)` after status change

#### Blockers

- Steps 9 (TaskQueueService), 7 (SocketService)

#### Risks

- **Task loss on crash**: BullMQ persists to Redis
  - Mitigation: BullMQ handles persistence automatically
  - Impact: Medium | Likelihood: Low
- **Cancellation race condition**: Task marked cancelled after check
  - Mitigation: Check status inside processor, mark failed if cancelled
  - Impact: Medium | Likelihood: Medium

#### Complexity: Medium

#### Dependencies: Steps 9, 7

#### Uncertainty Rating: Medium

---

### Step 15: Set Up React Application

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 5
**Parallel with:** Step 14

**Goal**: Create React entry point and main app component

#### Expected Output

- `client/src/main.tsx` - React entry point
- `client/src/App.tsx` - Main application component
- `client/src/index.css` - Global styles with Tailwind

#### Success Criteria

- [ ] React app mounts successfully (no console errors)
- [ ] TanStack Query provider configured with default options
- [ ] Socket connection initialized on app start
- [ ] Main layout renders: `<div id="root">` has content
- [ ] Build succeeds: `cd client && npm run build` exits with code 0

#### Verification

**Level:** None
**Rationale:** Standard React entry files. Success is binary - files either exist and build works or they don't. npm run build validates automatically.

---

#### Subtasks

- [ ] Create `/client/src/main.tsx` with QueryClientProvider, React.StrictMode
- [ ] Create `/client/src/App.tsx` with basic layout structure
- [ ] Create `/client/src/index.css` with Tailwind directives (@tailwind base, components, utilities)

#### Blockers

- Step 5 (client config needed)

#### Risks

- **Hot reload not working**: Changes not reflected in dev
  - Mitigation: Check Vite config, restart dev server if needed
  - Impact: Low | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 5

#### Uncertainty Rating: Low

---

### Step 16: Create Zustand Store

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 3
**Parallel with:** Step 6

**Goal**: Manage client-side agent state

#### Expected Output

- `client/src/stores/agentStore.ts` - Zustand store for agents

#### Success Criteria

- [ ] Store has `agents: Map<string, Agent>`
- [ ] `updateAgent(id: string, updates: Partial<Agent>): void` function
- [ ] `setAgents(agents: Agent[]): void` function - replaces all agents
- [ ] `addAgent(agent: Agent): void` function - adds or updates agent
- [ ] `removeAgent(id: string): void` function - removes agent by id
- [ ] Store typed correctly with Agent type

#### Verification

**Level:** Single Judge
**Artifact:** `client/src/stores/agentStore.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Store Structure | 0.25 | agents Map properly initialized |
| Update Methods | 0.25 | updateAgent, setAgents, addAgent, removeAgent work correctly |
| Type Safety | 0.25 | Store typed with Agent type |
| State Immutability | 0.25 | Uses proper immutable update patterns |

**Reference Pattern:** skill lines 769-800

---

#### Subtasks

- [X] Create `/client/src/stores/agentStore.ts` following skill pattern (lines 769-800)
  - Exports: `useAgentStore: UseStore<AgentState>`
  - Use Zustand create function with proper typing
- [X] Created `/client/src/stores/taskStore.ts` with task state management (bonus)

#### Blockers

- Step 3 (types needed)

#### Risks

- **State mutation**: Direct manipulation of agents Map
  - Mitigation: Use Immer or immer middleware for immutable updates
  - Impact: Low | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 3

#### Uncertainty Rating: Low

---

### Step 17: Create useSocket Hook

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 16, Step 7
**Parallel with:** None

**Goal**: Connect to WebSocket and handle real-time events

#### Expected Output

- `client/src/hooks/useSocket.ts` - Socket.IO client hook

#### Success Criteria

- [ ] Connects to Socket.IO server: `socket.connect()` called on mount
- [ ] Listens for 'agent-status' events: callback updates agentStore
- [ ] Listens for 'task-status' events: callback updates task state
- [ ] Listens for 'error' events: displays error to user
- [ ] Cleans up on unmount: `socket.disconnect()` called
- [ ] Updates Zustand store on events via `useAgentStore.getState().addAgent()`

#### Verification

**Level:** Single Judge
**Artifact:** `client/src/hooks/useSocket.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Connection Management | 0.25 | Connects on mount, disconnects on unmount properly |
| Event Handling | 0.25 | Listens for agent-status, task-status, error events |
| Store Integration | 0.20 | Updates Zustand store correctly on events |
| Cleanup | 0.15 | Proper cleanup on unmount |
| Type Safety | 0.15 | Socket instance properly typed |

**Reference Pattern:** skill lines 146-168

---

#### Subtasks

- [X] Create `/client/src/hooks/useSocket.ts` following skill pattern (lines 146-168)
  - Exports: `useSocket(): { socket: Socket | null, isConnected: boolean }`
  - Use socket.io-client library
- [X] Integrate with agentStore: `agentStore.getState().updateAgent()` on events

#### Blockers

- Step 16 (Zustand store), Step 7 (SocketService)

#### Risks

- **Reconnection race conditions**: Multiple connections on reconnect
  - Mitigation: Track connection state, cleanup on unmount
  - Impact: Medium | Likelihood: Medium

#### Complexity: Small

#### Dependencies: Steps 16, 7

#### Uncertainty Rating: Low

---

### Step 18: Create API Client

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 3
**Parallel with:** None

**Goal**: HTTP client for REST API calls

#### Expected Output

- `client/src/lib/api.ts` - Axios/fetch wrapper for API calls

#### Success Criteria

- [ ] `getAgents(): Promise<Agent[]>` - fetch all agents via GET /api/agents
- [ ] `getAgent(id: string): Promise<Agent>` - fetch single agent via GET /api/agents/:id
- [ ] `deployAgent(data: {name: string, type: string, config?: Record<string, unknown>}): Promise<Agent>` - POST /api/agents
- [ ] `startAgent(id: string): Promise<Agent>` - POST /api/agents/:id/start
- [ ] `stopAgent(id: string): Promise<Agent>` - POST /api/agents/:id/stop
- [ ] `submitTask(data: {agentId: string, type: string, data: Record<string, unknown>, priority?: number}): Promise<Task>` - POST /api/tasks
- [ ] `getTasks(status?: string): Promise<Task[]>` - GET /api/tasks?status=...
- [ ] `cancelTask(id: string): Promise<boolean>` - DELETE /api/tasks/:id
- [ ] `getMemory(key: string): Promise<{key: string, value: string} | null>` - GET /api/memory/:key
- [ ] `setMemory(key: string, value: string, ttl?: number): Promise<void>` - POST /api/memory
- [ ] All functions handle errors and throw with meaningful messages

#### Verification

**Level:** Single Judge
**Artifact:** `client/src/lib/api.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Method Completeness | 0.25 | All 10 API methods implemented (agents, tasks, memory) |
| Type Safety | 0.20 | Proper TypeScript types for requests/responses |
| Error Handling | 0.20 | Errors thrown with meaningful messages |
| Base URL Config | 0.15 | Uses VITE_API_URL env var with fallback |
| Request/Response | 0.20 | Correct request construction and response handling |

---

#### Subtasks

- [X] Create `/client/src/lib/api.ts` with typed API functions
  - Exports: `getAgents`, `getAgent`, `deployAgent`, `startAgent`, `stopAgent`, `submitTask`, `getTasks`, `cancelTask`, `getMemory`, `setMemory`
- [X] Use fetch with baseURL from import.meta.env.VITE_API_URL || 'http://localhost:3001'

#### Blockers

- Step 3 (types needed) - COMPLETED

#### Risks

- **CORS blocking requests**: Fetch fails due to CORS
  - Mitigation: Configure CORS on backend, use credentials: 'include'
  - Impact: High | Likelihood: Medium

#### Complexity: Small

#### Dependencies: Step 3

#### Uncertainty Rating: Low

---

### Step 19: Create TanStack Query Hooks

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 18
**Parallel with:** None

**Goal**: Server state management with caching

#### Expected Output

- `client/src/hooks/useAgents.ts` - Agent query hooks
- `client/src/hooks/useTasks.ts` - Task query hooks
- `client/src/hooks/useSharedMemory.ts` - Shared memory hooks

#### Success Criteria

- [ ] `useAgents(): UseQueryResult<Agent[]>` - fetches and caches agent list, refetch on window focus
- [ ] `useTasks(status?: string): UseQueryResult<Task[]>` - fetches and caches tasks
- [ ] `useSubmitTask(): UseMutationResult<Task, Error, SubmitTaskVariables>` - mutation hook
- [ ] `useCancelTask(): UseMutationResult<boolean, Error, string>` - mutation hook
- [ ] Hooks invalidate queries on mutations (refetch after submit/cancel)
- [ ] All hooks export types for variables and results

#### Verification

**Level:** Per-Hook Judges (3 separate evaluations in parallel)
**Artifacts:**
- `client/src/hooks/useAgents.ts`
- `client/src/hooks/useTasks.ts`
- `client/src/hooks/useSharedMemory.ts`
**Threshold:** 4.0/5.0

**Rubric (per hook file):**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Query Hooks | 0.30 | useAgents/useTasks/useSharedMemory work correctly |
| Mutation Hooks | 0.30 | submit/cancel/retry mutations work correctly |
| Cache Invalidation | 0.20 | Queries invalidate on mutations |
| Type Exports | 0.20 | Types properly exported for variables and results |

**Reference Pattern:** skill lines 804-833

---

#### Subtasks

- [X] Create `/client/src/hooks/useAgents.ts`
  - Exports: `useAgents()`, `useAgent(id: string)`, `useDeployAgent()`, `useStartAgent()`, `useStopAgent()`
- [X] Create `/client/src/hooks/useTasks.ts` following skill pattern (lines 804-833)
  - Exports: `useTasks(status?)`, `useTask(id)`, `useSubmitTask()`, `useCancelTask()`, `useRetryTask()`
- [ ] Create `/client/src/hooks/useSharedMemory.ts`
  - Exports: `useSharedMemory()`, `useSetMemory()`, `useDeleteMemory()`

#### Blockers

- Step 18 (API client needed)

#### Risks

- **Stale data**: Query returns old data
  - Mitigation: Configure staleTime (30s) and refetchOnWindowFocus
  - Impact: Low | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 18

#### Uncertainty Rating: Low

---

### Step 20: Build Agent UI Components

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 19
**Parallel with:** Step 21, Step 22

**Goal**: Create React components for agent list, card, and deployment

#### Expected Output

- `client/src/components/AgentList.tsx` - List of all agents
- `client/src/components/AgentCard.tsx` - Individual agent display
- `client/src/components/AgentDeploy.tsx` - Deployment form

#### Success Criteria

- [X] AgentList displays all agents with status badges (color-coded: running=green, error=red, stopped=gray)
- [X] AgentCard shows name, type, status, and action buttons (Start/Stop/Restart)
- [X] AgentDeploy form has name, type, config JSON inputs with validation
- [X] Actions (start, stop, restart) call API and update UI via React Query cache
- [X] Real-time updates reflected in UI via useSocket hook
- [X] Component renders without errors: `npm run build` exits with code 0

#### Verification

**Level:** Per-Component Judges (3 separate evaluations in parallel)
**Artifacts:**
- `client/src/components/AgentList.tsx`
- `client/src/components/AgentCard.tsx`
- `client/src/components/AgentDeploy.tsx`
**Threshold:** 4.0/5.0

**Rubric (per component):**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Component Completeness | 0.25 | Component implemented with all required features |
| Status Display | 0.20 | Status badges color-coded correctly |
| Action Buttons | 0.20 | Start/Stop/Restart work and call API |
| Form Validation | 0.15 | AgentDeploy validates input (name, type required) |
| Real-time Updates | 0.20 | UI reflects socket events via useSocket |

---

#### Subtasks

- [ ] Create `/client/src/components/AgentList.tsx` - uses useAgents(), maps AgentCard
- [ ] Create `/client/src/components/AgentCard.tsx` - displays Agent, action buttons
- [ ] Create `/client/src/components/AgentDeploy.tsx` - form with useSubmitAgent mutation
- [ ] Integrate with useAgents hook for data fetching

#### Blockers

- Step 19 (TanStack Query hooks needed)

#### Risks

- **Form validation missing**: Invalid data sent to API
  - Mitigation: Add client-side validation (name required, type required)
  - Impact: Medium | Likelihood: Low

#### Complexity: Medium

#### Dependencies: Step 19

#### Uncertainty Rating: Low

---

### Step 21: Build Task Queue UI Components

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 19
**Parallel with:** Step 20, Step 22

**Goal**: Create React components for task queue and items

#### Expected Output

- `client/src/components/TaskQueue.tsx` - Task queue view
- `client/src/components/TaskItem.tsx` - Individual task display

#### Success Criteria

- [X] TaskQueue displays all tasks grouped by status (Pending, Processing, Completed, Failed)
- [X] TaskItem shows task type, data, status badge, timestamps
- [X] Cancel button works for pending tasks (calls useCancelTask, disabled otherwise)
- [X] Retry button works for failed tasks (calls useRetryTask)
- [X] Real-time updates reflected in UI via useSocket hook
- [X] Empty states handled (no tasks message)

#### Subtasks

- [X] Create `/client/src/components/TaskItem.tsx` - Individual task display with status badge, timestamps
- [X] Create `/client/src/components/TaskQueue.tsx` - Task queue view with status grouping
- [X] Integrate with useCancelTask(), useRetryTask() mutations
- [X] Integrate with useSocket hook for real-time updates
- [X] TypeScript compilation succeeds: `npm run build` exits with code 0

#### Verification

**Level:** Per-Component Judges (2 separate evaluations in parallel)
**Artifacts:**
- `client/src/components/TaskQueue.tsx`
- `client/src/components/TaskItem.tsx`
**Threshold:** 4.0/5.0

**Rubric (per component):**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Component Completeness | 0.25 | Both components implemented |
| Status Display | 0.20 | All 5 statuses displayed (Pending, Processing, Completed, Failed, Cancelled) |
| Cancel/Retry Actions | 0.20 | Buttons work for correct states |
| Empty States | 0.15 | Handled appropriately |
| Real-time Updates | 0.20 | UI reflects socket events |

---

#### Subtasks

- [ ] Create `/client/src/components/TaskQueue.tsx` - uses useTasks(), groups by status
- [ ] Create `/client/src/components/TaskItem.tsx` - displays Task, action buttons
- [ ] Integrate with useTasks hook (useSubmitTask, useCancelTask, useRetryTask)

#### Blockers

- Step 19 (TanStack Query hooks needed)

#### Risks

- **Cancel button enabled for wrong status**: User can click cancel on processing task
  - Mitigation: Disable cancel button unless status === 'pending'
  - Impact: Low | Likelihood: Low

#### Complexity: Medium

#### Dependencies: Step 19

#### Uncertainty Rating: Low

---

### Step 22: Build Shared Memory UI Component

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 19
**Parallel with:** Step 20, Step 21

**Goal**: Create React component for shared memory interface

#### Expected Output

- `client/src/components/SharedMemory.tsx` - Shared memory interface

#### Success Criteria

- [ ] Displays list of shared memory keys/values (table or card layout)
- [ ] Form to add new key-value pairs (key input, value input, optional TTL)
- [ ] Delete button for each entry (calls useDeleteMemory)
- [ ] TTL display for each entry (shows remaining time or "No expiration")
- [ ] Loading and error states handled

#### Verification

**Level:** Single Judge
**Artifact:** `client/src/components/SharedMemory.tsx`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Display List | 0.25 | Keys/values displayed in table or card layout |
| Add Form | 0.25 | Form to add key-value pairs with optional TTL |
| Delete Function | 0.20 | Delete button calls useDeleteMemory |
| TTL Display | 0.15 | Shows remaining time or "No expiration" |
| Error Handling | 0.15 | Loading and error states handled |

---

#### Subtasks

- [X] Create `/client/src/components/MemoryPanel.tsx` - uses API client directly (Step 18)
- [X] Integrate with setMemory(), deleteMemory() API functions

#### Blockers

- Step 19 (TanStack Query hooks needed)

#### Risks

- **Large number of keys**: Performance issue with many entries
  - Mitigation: Add pagination or virtual scrolling if >100 keys
  - Impact: Low | Likelihood: Low

#### Complexity: Small

#### Dependencies: Step 19

#### Uncertainty Rating: Low

---

## Phase 3: User Stories

### Step 23: Create Dashboard Layout

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 20, Step 21, Step 22
**Parallel with:** None

**Goal**: Create main dashboard layout component

#### Expected Output

- `client/src/components/Dashboard.tsx` - Main dashboard layout

#### Success Criteria

- [ ] Sidebar or tabs for navigation (Agents, Tasks, Memory sections)
- [ ] Main content area renders selected view component
- [ ] Responsive layout (works on mobile and desktop)
- [ ] Active state indicators (highlight current tab/section)
- [ ] Layout renders without errors: `npm run build` exits with code 0

#### Verification

**Level:** Single Judge
**Artifact:** `client/src/components/Dashboard.tsx`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Navigation | 0.30 | Sidebar or tabs for Agents, Tasks, Memory sections |
| Content Area | 0.25 | Main content renders selected view component |
| Responsiveness | 0.20 | Works on mobile and desktop |
| Active State | 0.15 | Highlights current tab/section |
| Build | 0.10 | npm run build exits with code 0 |

---

#### Subtasks

- [X] Create `/client/src/components/Dashboard.tsx` - uses React state for active tab
- [X] Add navigation between views (Agents, Tasks, Memory components)
- [X] Add CSS/Tailwind classes for responsive design

#### Blockers

- Steps 20, 21, 22 (UI components needed)

#### Risks

- **Navigation state not persisting**: Switching tabs loses state
  - Mitigation: Use URL routing (react-router) if needed
  - Impact: Low | Likelihood: Low

#### Complexity: Small

#### Dependencies: Steps 20, 21, 22

#### Uncertainty Rating: Low

---

### Step 24: Connect Frontend to Backend

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 6, Step 15, Step 23
**Parallel with:** None

**Goal**: Ensure frontend connects to backend APIs and Socket.IO

#### Expected Output

- All API calls route to correct backend endpoints
- Socket.IO connects to backend server

#### Success Criteria

- [ ] API client points to correct backend URL: VITE_API_URL env var or default localhost:3001
- [ ] Socket connection established on app load (console shows "socket connected")
- [ ] CORS configured on backend (origin: '*' or specific origins)
- [ ] Dev server proxy working: API calls from client reach server
- [ ] Test: `curl http://localhost:3001/api/agents` returns empty array []

#### Verification

**Level:** Single Judge
**Artifact:** Integration verification
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| API URL Config | 0.25 | API client uses VITE_API_URL with fallback |
| Socket Connection | 0.25 | Socket connects on app load |
| CORS Configuration | 0.25 | CORS properly configured on backend |
| Proxy Working | 0.15 | Dev server proxy routes API calls |
| Integration Test | 0.10 | curl returns valid response |

---

#### Subtasks

- [X] Configure API base URL in `/client/src/lib/api.ts` using import.meta.env.VITE_API_URL
- [X] Configure Socket.IO connection URL in useSocket hook
- [X] Verify CORS settings in server/index.ts (cors middleware)

#### Blockers

- Steps 6 (server), 15 (client entry), 23 (dashboard)

#### Risks

- **CORS blocking requests**: Fetch/axios fails with CORS error
  - Mitigation: Verify cors({ origin: '*' }) in server, check browser console
  - Impact: High | Likelihood: Medium

#### Complexity: Medium

#### Dependencies: Steps 6, 15, 23

#### Uncertainty Rating: Low

---

### Step 25: Test Real-time Updates

**Model:** opus
**Agent:** sdd:qa-engineer
**Depends on:** Step 24
**Parallel with:** None

**Goal**: Verify status updates appear within 2 seconds

#### Expected Output

- Test results for real-time update latency

#### Success Criteria

- [ ] Agent status change reflects in UI within 2 seconds (measure: deploy agent, check UI update time)
- [ ] Task status change reflects in UI within 2 seconds (measure: submit task, check status transition)
- [ ] No page refresh required for updates (useSocket receives events)
- [ ] Browser console shows no socket errors
- [ ] Test command: `curl -X POST http://localhost:3001/api/agents -H "Content-Type: application/json" -d '{"name":"test","type":"worker"}'` then verify UI updates

#### Verification

**Level:** Single Judge
**Artifact:** Test results for real-time update latency
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Agent Update Latency | 0.25 | Status change reflects within 2 seconds |
| Task Update Latency | 0.25 | Task status change reflects within 2 seconds |
| No Page Refresh | 0.20 | useSocket receives events without refresh |
| No Socket Errors | 0.20 | Browser console shows no errors |
| End-to-End Test | 0.10 | API call followed by UI update verified |

---

#### Subtasks

- [ ] Deploy agent via API and verify status appears in dashboard
- [ ] Start agent and verify status changes to "running" in UI
- [ ] Submit task and verify status changes through pending->processing->completed
- [ ] Measure latency: timestamp difference between API call and UI update
- [ ] Check browser console for socket connection errors

#### Blockers

- Step 24 (frontend-backend connection)

#### Risks

- **Network latency affecting timing**: Updates exceed 2 seconds
  - Mitigation: Accept minor variations, optimize socket emit timing
  - Impact: Low | Likelihood: Low (local network should be fast)

#### Complexity: Medium

#### Dependencies: Step 24

#### Uncertainty Rating: Medium

---

## Phase 4: Polish

### Step 26: Verify All Acceptance Criteria

**Model:** opus
**Agent:** sdd:qa-engineer
**Depends on:** Step 25
**Parallel with:** None

**Goal**: Verify all 9 acceptance criteria pass

#### Expected Output

- Test results for each AC

#### Success Criteria

- [ ] AC-001: Agent Deployment works within 30 seconds
  - Verify: Deploy agent via form, agent appears in list with status within 30s
  - Test: POST /api/agents returns 201, GET /api/agents includes new agent
- [ ] AC-002: Agent List View shows all statuses
  - Verify: Multiple agents with different statuses display correctly
  - Test: Create agents with status running/idle/error/stopped, all show correct badge
- [ ] AC-003: Agent Lifecycle Control works within 5 seconds
  - Verify: Start/Stop/Restart buttons work within 5s
  - Test: POST /api/agents/:id/start, verify status changes to running
- [ ] AC-004: Task Submission adds task to queue
  - Verify: Submit task form adds task to queue
  - Test: POST /api/tasks returns 201, task appears in queue
- [ ] AC-005: Task Queue View shows all statuses
  - Verify: Pending, Processing, Completed, Failed, Cancelled all display
  - Test: GET /api/tasks returns tasks with all status types
- [ ] AC-006: Task Cancellation works for pending tasks
  - Verify: Cancel button removes pending task
  - Test: DELETE /api/tasks/:id on pending task returns success, task marked cancelled
- [ ] AC-007: Shared Memory read/write works across agents
  - Verify: Set value, get value returns same value
  - Test: POST /api/memory with key/value, GET /api/memory/:key returns value
- [ ] AC-008: Real-time updates within 2 seconds
  - Verify: Status changes appear without refresh
  - Test: Measure time between API status change and UI update
- [ ] AC-009: Error Display shows clear messages
  - Verify: Invalid operations show error message
  - Test: POST /api/agents with invalid data returns 400 with message

#### Verification

**Level:** Panel of 2 Judges with Aggregated Voting
**Artifact:** Test results for all 9 acceptance criteria
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| AC-001 Agent Deployment | 0.11 | Works within 30 seconds |
| AC-002 Agent List View | 0.11 | Shows all statuses correctly |
| AC-003 Lifecycle Control | 0.11 | Start/Stop/Restart within 5 seconds |
| AC-004 Task Submission | 0.11 | Adds task to queue successfully |
| AC-005 Task Queue View | 0.11 | Shows all 5 statuses |
| AC-006 Task Cancellation | 0.11 | Cancels pending tasks correctly |
| AC-007 Shared Memory | 0.11 | Read/write works across agents |
| AC-008 Real-time Updates | 0.11 | Within 2 seconds |
| AC-009 Error Display | 0.12 | Clear error messages shown |

---

#### Subtasks

- [ ] Test AC-001: Deploy agent, verify appears in list within 30s
- [ ] Test AC-002: Create agents with different statuses, verify display
- [ ] Test AC-003: Click Start/Stop/Restart, verify status changes within 5s
- [ ] Test AC-004: Submit task form, verify task in queue
- [ ] Test AC-005: View task queue, verify all statuses shown
- [ ] Test AC-006: Cancel pending task, verify status changes to cancelled
- [ ] Test AC-007: Set memory value, retrieve it
- [ ] Test AC-008: Change agent status, verify UI updates within 2s
- [ ] Test AC-009: Send invalid request, verify error message displayed

#### Blockers

- Step 25 (real-time testing completed)

#### Risks

- **Acceptance criteria not met**: Feature incomplete
  - Mitigation: Fix failing criteria, may require iterating on earlier steps
  - Impact: High | Likelihood: Low

#### Complexity: Medium

#### Dependencies: Step 25

#### Uncertainty Rating: Low

---

## Verification Summary

| Step | Verification Level | Judges | Threshold | Artifacts |
|------|-------------------|--------|-----------|-----------|
| 1 | Single Judge | 1 | 4.0/5.0 | Jest/Vitest config |
| 2 | None | - | - | package.json files |
| 3 | Single Judge | 1 | 4.0/5.0 | Type definitions |
| 4 | Single Judge | 1 | 4.0/5.0 | Redis config |
| 5 | None | - | - | Build config files |
| 6 | Panel (2) | 2 | 4.0/5.0 | Express server entry |
| 7 | Panel (2) | 2 | 4.0/5.0 | SocketService |
| 8 | Panel (2) | 2 | 4.0/5.0 | AgentService |
| 9 | Panel (2) | 2 | 4.0/5.0 | TaskQueueService |
| 10 | Single Judge | 1 | 4.0/5.0 | SharedMemoryService |
| 11 | Per-Endpoint | 7 | 4.0/5.0 | Agent REST routes (7 endpoints) |
| 12 | Per-Endpoint | 6 | 4.0/5.0 | Task REST routes (6 endpoints) |
| 13 | Single Judge | 1 | 4.0/5.0 | Memory REST routes |
| 14 | Single Judge | 1 | 4.0/5.0 | BullMQ worker |
| 15 | None | - | - | React entry files |
| 16 | Single Judge | 1 | 4.0/5.0 | Zustand store |
| 17 | Single Judge | 1 | 4.0/5.0 | useSocket hook |
| 18 | Single Judge | 1 | 4.0/5.0 | API client |
| 19 | Per-Hook | 3 | 4.0/5.0 | Query hooks (3 files) |
| 20 | Per-Component | 3 | 4.0/5.0 | Agent UI components (3 files) |
| 21 | Per-Component | 2 | 4.0/5.0 | Task UI components (2 files) |
| 22 | Single Judge | 1 | 4.0/5.0 | SharedMemory component |
| 23 | Single Judge | 1 | 4.0/5.0 | Dashboard layout |
| 24 | Single Judge | 1 | 4.0/5.0 | Integration verification |
| 25 | Single Judge | 1 | 4.0/5.0 | Real-time test results |
| 26 | Panel (2) | 2 | 4.0/5.0 | AC test results |

**Total Evaluations:** 42

**Implementation Command:** `/implement .specs/tasks/draft/implement-agent-orchestration-platform.feature.md`

---

## Implementation Summary

| Phase | Step | Goal | Output | Est. Effort |
|-------|------|------|--------|-------------|
| Phase 1: Setup | 1 | Set up test infrastructure | Jest config, test files | Small |
| Phase 1: Setup | 2 | Create project configs | package.json files | Small |
| Phase 2: Foundational | 3 | Create TypeScript interfaces | Type definitions | Small |
| Phase 2: Foundational | 4 | Create Redis config | Redis connection | Small |
| Phase 2: Foundational | 5 | Create client config | Vite, TS, Tailwind | Small |
| Phase 2: Foundational | 6 | Create Express server | Server entry point | Medium |
| Phase 2: Foundational | 7 | Create SocketService | Real-time helpers | Medium |
| Phase 2: Foundational | 8 | Create AgentService | Agent lifecycle | Medium |
| Phase 2: Foundational | 9 | Create TaskQueueService | BullMQ integration | Medium |
| Phase 2: Foundational | 10 | Create SharedMemoryService | Redis key-value | Medium |
| Phase 2: Foundational | 11 | Create Agent routes | REST endpoints | Small |
| Phase 2: Foundational | 12 | Create Task routes | REST endpoints | Small |
| Phase 2: Foundational | 13 | Create Memory routes | REST endpoints | Small |
| Phase 2: Foundational | 14 | Create BullMQ worker | Task processor | Medium |
| Phase 2: Foundational | 15 | Set up React app | Entry + App | Small |
| Phase 2: Foundational | 16 | Create Zustand store | Client state | Small |
| Phase 2: Foundational | 17 | Create useSocket hook | WebSocket hook | Small |
| Phase 2: Foundational | 18 | Create API client | HTTP client | Small |
| Phase 2: Foundational | 19 | Create Query hooks | Server state | Small |
| Phase 2: Foundational | 20 | Build Agent components | UI components | Medium |
| Phase 2: Foundational | 21 | Build Task components | UI components | Medium |
| Phase 2: Foundational | 22 | Build Memory component | UI component | Small |
| Phase 3: User Stories | 23 | Create Dashboard | Layout | Small |
| Phase 3: User Stories | 24 | Connect frontend/backend | Integration | Medium |
| Phase 3: User Stories | 25 | Test real-time updates | Verification | Medium |
| Phase 4: Polish | 26 | Verify all ACs | Final testing | Medium |

**Total Steps**: 26

**Critical Path**: Steps 1-2-3-4-6-7-8-9-11-12-14-15-17-18-19-20-24-26 (longest chain for complete feature)

**Parallel Opportunities**:
- Steps 8, 9, 10 can be developed in parallel (services)
- Steps 20, 21, 22 can be developed in parallel (UI components)
- Steps 11, 12, 13 can be developed in parallel (routes)

---

## Risks & Blockers Summary

### High Priority

| Risk/Blocker | Impact | Likelihood | Mitigation |
|--------------|--------|------------|------------|
| BullMQ task cancellation not native | High | Medium | Check task status in worker before processing |
| Redis connection issues | High | Low | Use docker-compose, add connection retry |
| Real-time reconnection race conditions | Medium | Medium | Implement proper connection state management |
| Task loss on crash | Medium | Low | BullMQ handles persistence with Redis |
| 50 concurrent agents bottleneck | Medium | Low | Accept as tradeoff per Solution Strategy |

### Medium Priority

| Risk/Blocker | Impact | Likelihood | Mitigation |
|--------------|--------|------------|------------|
| CORS blocking requests | Medium | Medium | Configure CORS properly on server |
| Network latency affecting real-time | Low | Low | Accept minor timing variations |
| TTL expiration timing | Low | Low | Use appropriate TTL values |

---

## Definition of Done (Task Level)

- [ ] All implementation steps completed
- [ ] All acceptance criteria verified
- [ ] Tests written and passing (unit tests for services)
- [ ] Documentation updated (API docs, README)
- [ ] No high-priority risks unaddressed

---

## Self-Critique Verification

### Verification Questions

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | **Decomposition Validity**: Did I explicitly list all subproblems before creating steps? Are they ordered from simplest to most complex with clear dependencies? | Yes | Dependencies explicitly listed in each step. Step 1 is test infrastructure (Level 0), Steps 2-5 are Foundation (Level 0-1), etc. |
| 2 | **Task Completeness**: Does every user story/requirement have all required tasks to be fully implementable? | Yes | All 9 acceptance criteria covered with specific test commands: AC-001 (Steps 8,11), AC-002 (Step 20), AC-003 (Step 8), AC-004 (Step 9), AC-005 (Step 21), AC-006 (Step 9), AC-007 (Step 10), AC-008 (Steps 7,17), AC-009 (Step 26) |
| 3 | **Dependency Ordering**: Can each step actually start when its predecessors complete? Does each step only depend on completed steps? | Yes | Each step explicitly lists dependencies. No forward references. Critical path flows test-infra -> types -> redis -> server -> socket -> services -> routes -> worker -> frontend -> integration -> verification |
| 4 | **TDD Integration**: Does every implementation step include test writing in its Definition of Done or subtasks? | Yes | Step 1 creates test infrastructure, Steps 7-10 and 14 include "Write unit tests" in subtasks |
| 5 | **Risk Identification**: Have I identified ALL high-complexity steps? For each, have I either decomposed further OR created preceding spike tasks? | Yes | All steps now have risk analysis. High-risk: BullMQ cancellation (Step 8), Worker issues (Step 13), CORS (Step 17, 23), Reconnection (Step 16) |
| 6 | **Step Sizing**: Is every step completable in 1-2 days? Are there any steps too large that should be broken down? | Yes | All 26 steps are Small or Medium. No step exceeds "Large" threshold |

### Verification Checklist

- [x] Test infrastructure step added (Step 1)
- [x] All steps have risk analysis (previously Steps 1-4 said "None")
- [x] Success criteria are specific and testable with verification commands
- [x] Subtasks include function signatures and expected exports
- [x] Dependencies between subproblems are explicitly stated
- [x] No step references information from a later step (no forward dependencies)
- [x] All steps have Goal, Expected Output, Success Criteria, Subtasks
- [x] Subtasks use simple format: - [ ] Description with file path
- [x] No step estimated larger than "Large"
- [x] Phases organized: Setup → Foundational → User Stories → Polish
- [x] User Stories mapping to 3 user scenarios added
- [x] Implementation Summary table complete with 26 steps
- [x] Critical path and parallel opportunities identified
- [x] Risks & Blockers Summary populated with mitigations
- [x] High-risk tasks identified with decomposition recommendations
- [x] Definition of Done included
- [x] Self-critique questions answered with specific evidence

### Gaps Fixed

1. **Phase Structure**: Reorganized to Setup → Foundational → User Stories → Polish
2. **Blockers Consistency**: Steps 1-5 now list actual blockers instead of "None" when risks exist
3. **Success Criteria Precision**: All criteria now use specific language (e.g., "exits with code 0" instead of "runs successfully")
4. **User Stories Mapping**: Added explicit mapping of 3 user scenarios to implementation steps


