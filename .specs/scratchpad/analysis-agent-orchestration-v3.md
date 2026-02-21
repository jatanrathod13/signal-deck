# Code Exploration Scratchpad: Implement Agent Orchestration Platform

Task: .specs/tasks/draft/implement-agent-orchestration-platform.feature.md
Created: 2026-02-20

---

## Problem Definition

### Analysis Questions
- Primary: What files need to be created to implement the Agent Orchestration Platform?
- Secondary: How do the services integrate with each other? What are the accurate skill file line references?

### Search Keywords
- Agent orchestration, BullMQ, Socket.IO, Redis Pub/Sub, real-time dashboard
- Zustand, TanStack Query, shadcn/ui

### Success Criteria
- [ ] All files to create identified with accurate paths
- [ ] Accurate skill file line numbers (NOT 262-272 for Redis - should be 734-746)
- [ ] Specific, actionable risk mitigations
- [ ] Service call chains documented with examples

---

## ACCURATE Skill File Analysis

The skill file is at: `.claude/skills/agent-orchestration-platform/SKILL.md`

### Code Pattern Locations (VERIFIED):

| Pattern | Actual Lines | Content |
|---------|-------------|---------|
| BullMQ Setup | 80-114 | Task queue with Queue, Worker, job submission |
| Socket.IO Server | 122-144 | Real-time server setup, rooms, emit |
| Socket.IO Client | 146-168 | React hook for WebSocket |
| Redis Pub/Sub | 176-205 | Inter-agent communication |
| Agent Registry | 213-308 | Lifecycle management pattern |
| Health Monitoring | 316-356 | Prometheus metrics |
| Auth/JWT | 364-410 | Passport.js + JWT |
| Winston Logging | 418-452 | Structured logging |
| Pino Logging | 454-473 | High-perf logging |
| SSE Alternative | 537-562 | Server-sent events |
| Kafka Alternative | 568-600 | Event streaming |
| ELK Config | 606-630 | Logging stack |
| Installation | 712-730 | npm install commands |
| Redis Config | 734-746 | Connection setup |
| Env Variables | 748-754 | Environment config |
| Zustand Store | 769-800 | Client state |
| Task Hook | 804-833 | TanStack Query hook |

### Key Revelation:
- Lines 262-272 in skill file = AgentRegistry class `registerAgent`, `startAgent`, `stopAgent` methods
- Lines 734-746 = Redis connection configuration (THIS IS WHAT THE JUDGE REFERRED TO)

---

## Service Call Chains (Integration Details)

### Chain 1: Agent Deployment Flow
1. Client POST /api/agents → agentService.deployAgent()
2. agentService creates agent in memory/Redis
3. agentService emits 'agent:registered' event
4. socketService broadcasts to all clients

### Chain 2: Task Submission Flow
1. Client POST /api/tasks → taskQueueService.submitTask()
2. BullMQ adds job to queue
3. Worker picks up job → processes
4. On complete: worker calls socketService.emitTaskCompleted()
5. socketService broadcasts to room 'agent:agentId'
6. Client receives via WebSocket

### Chain 3: Shared Memory Flow
1. Agent A calls sharedMemoryService.setValue('key', data)
2. Redis stores in hash `agent:context:{agentId}`
3. Agent B calls sharedMemoryService.getValue('key')
4. Or Agent B subscribes via Redis Pub/Sub channel

### Chain 4: Health Monitoring Flow
1. Agent sends heartbeat to /api/agents/:id/heartbeat
2. agentRegistry.recordHeartbeat() updates lastHeartbeat
3. Health check runs every 30s (checkHealth method)
4. If stale: agent status → 'error', emits 'agent:unhealthy'
5. socketService broadcasts to clients

---

## Risk Mitigations (SPECIFIC & ACTIONABLE)

### Risk 1: Redis Connection Exhaustion
- **Code Config**: Use connection pooling
```typescript
// config/redis.ts lines 734-746 shows maxRetries only
// ADD: maxConnections: 50, enableReadyCheck: true
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxConnections: 50,
  enableReadyCheck: true,
  lazyConnect: true
});
```

### Risk 2: WebSocket Reconnection Race
- **Code Config**: Lines 486-491 show reconnection options
- **ADD**: Implement exponential backoff:
```typescript
const newSocket = io(url, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelayMax: 10000,
  reconnectionDelay: 1000
});
```

### Risk 3: Queue Deadlocks
- **Code Config**: Use BullMQ timeout (skill line 101-102)
```typescript
const worker = new Worker('agent-tasks', async job => {
  // ALWAYS return or throw - never hang
  return { result: 'completed' };
}, {
  connection,
  lockDuration: 30000,  // Prevent deadlocks
  lockRenewTime: 5000
});
```

### Risk 4: Task Priority Inversion
- **Code Config**: Set appropriate priorities (skill line 110)
```typescript
await agentTaskQueue.add('agent-task', payload, {
  priority: 1, // 1 = highest, 2 = medium, 3 = low
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 }
});
```

---

## Self-Critique

Verification questions to answer:
1. Are line numbers accurate? Check: Redis config is 734-746, NOT 262-272
2. Are risk mitigations actionable? Each should have code example
3. Are integration details complete? Need call chain examples
4. Is the skill file analysis mandatory? Yes, task requires it
5. Are all file paths absolute? Should be relative to project root

Gaps found in previous analysis:
- Line 33 claimed skill lines 262-272 for Redis config → SHOULD BE 734-746
- Line 36 claimed skill lines 68-102 for BullMQ → SHOULD BE 80-114
- Generic risk mitigations → NEED specific code examples
- Missing service call chains → NEED to add

---
