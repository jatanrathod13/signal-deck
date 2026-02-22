---
name: Agent Orchestration Platform
description: Build dashboards to deploy, monitor, and coordinate multiple AI agents with shared memory, task queuing, and real-time status tracking
topics: agent-orchestration, multi-agent-systems, task-queue, real-time-dashboard, ai-agent-management
created: 2026-02-20
updated: 2026-02-20
scratchpad: .specs/scratchpad/41fe74d4.md
---

# Agent Orchestration Platform

## Overview

An Agent Orchestration Platform enables deployment, monitoring, and coordination of multiple AI agents with shared memory, task queuing, and real-time status tracking. This skill covers the architecture, libraries, and best practices for building such a platform.

---

## Key Concepts

- **Agent Lifecycle Management**: Deploy, start, stop, restart, and monitor AI agents
- **Task Queuing**: Distribute work across agents with prioritization, retries, and dependencies
- **Shared Memory**: Enable agents to share context and communicate via pub/sub
- **Real-time Status**: WebSocket-based live updates for agent health and task progress
- **RBAC & Security**: Access control and audit logging for agent operations

---

## Documentation & References

| Resource | Description | Link |
|----------|-------------|------|
| BullMQ Documentation | Redis-based task queue for Node.js | https://bullmq.io/ |
| Socket.IO Documentation | Real-time WebSocket library | https://socket.io/ |
| node-redis | Redis client for Node.js | https://github.com/redis/node-redis |
| shadcn/ui | Accessible React component library | https://ui.shadcn.com/ |
| Redis Pub/Sub | Message broker for inter-agent communication | https://redis.io/docs/interact/pubsub/ |
| Prometheus Documentation | Metrics collection and alerting | https://prometheus.io/docs/ |
| Grafana Documentation | Visualization and monitoring | https://grafana.com/docs/ |
| Winston Documentation | Multi-transport logging | https://github.com/winstonjs/winston |
| Pino Documentation | High-performance JSON logging | https://getpino.io/ |
| Passport.js Documentation | Authentication middleware | https://www.passportjs.org/docs/ |

---

## Recommended Libraries & Tools

| Name | Purpose | Maturity | Notes |
|------|---------|----------|-------|
| **BullMQ** | Task queue | Stable | Redis-backed, supports priorities, delays, retries, concurrency |
| **Socket.IO** | Real-time communication | Stable | WebSocket with auto-reconnect, fallback to polling |
| **node-redis** | Redis client | Stable | Official Redis client, supports all Redis features |
| **shadcn/ui** | Dashboard components | Stable | Modern, accessible, Tailwind-based |
| **TanStack Query** | Server state | Stable | Caching and synchronization for React |
| **Zustand** | Client state | Stable | Lightweight state management |
| **ioredis** | Alternative Redis client | Stable | More features than node-redis |
| **prom-client** | Prometheus metrics | Stable | Node.js Prometheus client |
| **winston** | Logging | Stable | Multi-transport logging |
| **pino** | Logging | Stable | High-performance JSON logging |
| **passport** | Authentication | Stable | Modular authentication framework |
| **jsonwebtoken** | JWT handling | Stable | JWT encode/decode |
| **helmet** | Security headers | Stable | HTTP security headers |
| **cors** | CORS handling | Stable | Cross-origin resource sharing |
| **@modelcontextprotocol/sdk** | Tooling Integration | Stable | MCP Protocol client for Agent tool usage |

### Recommended Stack

- **Backend**: Node.js/Express + Socket.io + BullMQ + Redis + MCP SDK
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Database**: Redis (queue + shared memory), optional PostgreSQL (persistence)
- **Execution Modes**: Native Toolloop (Vercel AI SDK) & Local Claude CLI orchestration

---

## Patterns & Best Practices

### Task Queuing Pattern with BullMQ

**When to use**: Need reliable job processing with retries, priorities, and concurrency control

**Trade-offs**: Requires Redis infrastructure; more complex than simple async queues

```typescript
// Backend: Setting up BullMQ
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({ host: 'localhost', port: 6379 });

// Create queues for different agent tasks
export const agentTaskQueue = new Queue('agent-tasks', { connection });

// Worker processes tasks
const worker = new Worker('agent-tasks', async job => {
  console.log(`Processing job ${job.id}`);
  // Execute agent task here
  return { result: 'completed' };
}, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000
  }
});

// Add tasks from your API
await agentTaskQueue.add('agent-task', {
  agentId: 'agent-1',
  task: 'process-request',
  data: { input: 'example' }
}, {
  priority: 2,
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 }
});
```

### Real-time Communication Pattern with Socket.IO

**When to use**: Need bidirectional real-time updates for agent status

**Trade-offs**: Adds overhead; consider SSE for one-way updates

```typescript
// Backend: Socket.IO server
import { Server } from 'socket.io';

const io = new Server(3000, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  // Join agent-specific room
  socket.on('join-agent', (agentId) => {
    socket.join(`agent:${agentId}`);
  });

  // Broadcast agent status updates
  socket.on('agent-update', (data) => {
    io.emit('agent-status', data);
  });
});

// Emit updates from your code
io.to('agent:agent-1').emit('task-completed', { taskId: '123' });
```

```typescript
// Frontend: Socket.IO client
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

function AgentStatus({ agentId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    socket.emit('join-agent', agentId);

    socket.on('agent-status', (data) => {
      setStatus(data);
    });

    return () => socket.off('agent-status');
  }, [agentId]);

  return <div>Status: {status?.state}</div>;
}
```

### Shared Memory Pattern with Redis Pub/Sub

**When to use**: Agents need to share context or communicate events

**Trade-offs**: Message persistence requires Redis Streams or external storage

```typescript
// Backend: Redis Pub/Sub for inter-agent communication
import Redis from 'ioredis';

const publisher = new Redis();
const subscriber = new Redis();

// Subscribe to agent events
subscriber.subscribe('agent-events', (err) => {
  if (err) console.error(err);
});

subscriber.on('message', (channel, message) => {
  const event = JSON.parse(message);
  console.log('Received:', event);
  // Handle agent event
});

// Publish agent event
await publisher.publish('agent-events', JSON.stringify({
  type: 'TASK_COMPLETED',
  agentId: 'agent-1',
  taskId: 'task-123',
  timestamp: Date.now()
}));

// Also use Redis for shared agent context
const agentContext = await connection.get(`agent:context:${agentId}`);
await connection.set(`agent:context:${agentId}`, JSON.stringify(contextData), 'EX', 3600);
```

### Agent Registration & Lifecycle Pattern

**When to use**: Need to manage agent registration, health monitoring, and lifecycle states

**Trade-offs**: Requires health check endpoints and state machine implementation

```typescript
// Backend: Agent Registry Service
import { EventEmitter } from 'events';

interface AgentConfig {
  id: string;
  name: string;
  type: string;
  maxRetries: number;
  timeout: number;
}

interface AgentState {
  status: 'registered' | 'starting' | 'running' | 'idle' | 'error' | 'stopped';
  lastHeartbeat: number;
  healthScore: number;
  currentTask?: string;
  error?: string;
}

class AgentRegistry extends EventEmitter {
  private agents = new Map<string, AgentState>();
  private healthCheckInterval = 30000; // 30 seconds

  registerAgent(agentId: string, config: AgentConfig): void {
    this.agents.set(agentId, {
      status: 'registered',
      lastHeartbeat: Date.now(),
      healthScore: 100
    });
    this.emit('agent:registered', { agentId, config });
  }

  startAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');

    agent.status = 'starting';
    this.emit('agent:starting', { agentId });

    // Simulate startup
    setTimeout(() => {
      agent.status = 'running';
      this.emit('agent:started', { agentId });
    }, 1000);
  }

  stopAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');

    agent.status = 'stopped';
    this.emit('agent:stopped', { agentId });
  }

  recordHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.lastHeartbeat = Date.now();
    agent.healthScore = Math.min(100, agent.healthScore + 5);
  }

  checkHealth(): void {
    const now = Date.now();
    for (const [agentId, agent] of this.agents) {
      if (agent.status === 'running' || agent.status === 'idle') {
        const stale = now - agent.lastHeartbeat > this.healthCheckInterval * 2;
        if (stale) {
          agent.status = 'error';
          agent.error = 'Health check timeout';
          agent.healthScore = 0;
          this.emit('agent:unhealthy', { agentId, reason: 'timeout' });
        }
      }
    }
  }

  getAgentStatus(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): Array<{ id: string; state: AgentState }> {
    return Array.from(this.agents.entries()).map(([id, state]) => ({ id, state }));
  }
}

export const agentRegistry = new AgentRegistry();

// Health check endpoint for agents
app.post('/api/agents/:agentId/heartbeat', (req, res) => {
  const { agentId } = req.params;
  agentRegistry.recordHeartbeat(agentId);
  res.json({ success: true });
});
```

### Agent Health Monitoring Pattern

**When to use**: Need continuous health monitoring with metrics collection

**Trade-offs**: Additional overhead for metrics collection

```typescript
// Backend: Health monitoring with Prometheus metrics
import { Counter, Gauge, Histogram } from 'prom-client';

// Define metrics
const agentStatusGauge = new Gauge({
  name: 'agent_status',
  help: 'Current status of agents',
  labelNames: ['agent_id', 'agent_type']
});

const taskDurationHistogram = new Histogram({
  name: 'agent_task_duration_seconds',
  help: 'Duration of agent tasks',
  labelNames: ['agent_id', 'task_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const taskCounter = new Counter({
  name: 'agent_tasks_total',
  help: 'Total number of tasks processed',
  labelNames: ['agent_id', 'status']
});

// Middleware for health tracking
function trackAgentHealth(agentId: string, status: string) {
  const statusMap: Record<string, number> = {
    'running': 1,
    'idle': 2,
    'error': 3,
    'stopped': 4
  };
  agentStatusGauge.set({ agent_id: agentId }, statusMap[status] || 0);
}

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Authentication & Authorization Pattern

**When to use**: Need secure access control for agent operations

**Trade-offs**: Additional complexity; consider trade-off between security and ease of use

```typescript
// Backend: JWT Authentication with Passport
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';

// JWT Strategy configuration
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-secret-key'
};

passport.use(new JwtStrategy(jwtOptions, async (payload, done) => {
  try {
    const user = await findUserById(payload.id);
    if (user) return done(null, user);
    return done(null, false);
  } catch (err) {
    return done(err, false);
  }
}));

// Generate tokens
function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
}

// Protected route middleware
app.use('/api/agents', passport.authenticate('jwt', { session: false }));

// Rate limiting for agent actions
import rateLimit from 'express-rate-limit';

const agentActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' }
});

app.post('/api/agents/:agentId/stop', agentActionLimiter, (req, res) => {
  // Agent stop logic
});

### Structured Logging Pattern

**When to use**: Need centralized logging with search capabilities and debugging

**Trade-offs**: Additional storage and processing overhead

```typescript
// Backend: Winston logger with structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'agent-orchestration' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Agent-specific logging
function logAgentAction(agentId: string, action: string, metadata: object) {
  logger.info({
    message: `Agent ${action}`,
    agentId,
    action,
    ...metadata,
    timestamp: new Date().toISOString()
  });
}

// Usage
logAgentAction('agent-1', 'started', { type: 'worker', version: '1.0' });
logAgentAction('agent-1', 'task_completed', { taskId: 'task-123', duration: 1500 });
logAgentAction('agent-2', 'error', { error: 'Connection timeout', retry: true });
```

```typescript
// Backend: Pino logger (higher performance)
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

// Agent operations with Pino
logger.info({ agentId: 'agent-1', action: 'deploy' }, 'Agent deployment started');
logger.error({ agentId: 'agent-1', error: err }, 'Agent deployment failed');
```

---

## Similar Implementations

### LangChain Agents

- **Source**: https://github.com/langchain-ai/langchain
- **Approach**: Provides agent abstractions but requires custom orchestration layer for multi-agent coordination
- **Applicability**: Good foundation for agent logic, needs platform infrastructure

### CrewAI

- **Source**: https://github.com/crewAIInc/crewAI
- **Approach**: Multi-agent framework with role-based agents and task delegation
- **Applicability**: Useful for agent logic, platform still needed for deployment/monitoring

### AutoGen

- **Source**: https://github.com/microsoft/autogen
- **Approach**: Microsoft's multi-agent conversation framework
- **Applicability**: Strong for agent conversations, platform features need custom development

---

## Alternative Tech Stacks

### Python-Based Agents (Celery + Kafka)

**When to use**: Python is primary agent language; need enterprise-grade queuing

```python
# Python: Celery task queue
from celery import Celery
from kafka import KafkaProducer, KafkaConsumer
import json

app = Celery('agent_tasks', broker='kafka://localhost:9092')

@app.task
def process_agent_task(task_data):
    # Agent processing logic
    return {'status': 'completed', 'result': task_data}

# Kafka producer for events
producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

def publish_agent_event(event_type, agent_id, data):
    producer.send('agent-events', {
        'type': event_type,
        'agent_id': agent_id,
        'data': data,
        'timestamp': datetime.utcnow().isoformat()
    })
```

### Alternative Real-Time: Server-Sent Events (SSE)

**When to use**: Simpler unidirectional updates; works over HTTP/1.1; no WebSocket complexity

```typescript
// Backend: SSE endpoint
app.get('/api/agents/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Subscribe to agent events
  const handler = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  agentRegistry.on('agent:update', handler);

  // Cleanup on disconnect
  req.on('close', () => {
    agentRegistry.off('agent:update', handler);
  });
});

// Frontend: SSE client
const eventSource = new EventSource('/api/agents/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateAgentStatus(data);
};
```

### Alternative Message Queue: Kafka

**When to use**: High throughput; event sourcing; audit logs; replay capability

```typescript
// Backend: Kafka producer for agent events
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'agent-orchestration',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();
await producer.connect();

async function emitAgentEvent(topic: string, event: object) {
  await producer.send({
    topic,
    messages: [{
      key: event.agentId,
      value: JSON.stringify(event)
    }]
  });
}

// Kafka consumer for task processing
const consumer = kafka.consumer({ groupId: 'agent-workers' });
await consumer.subscribe({ topic: 'agent-tasks', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const task = JSON.parse(message.value?.toString() || '{}');
    await processAgentTask(task);
  }
});
```

### Alternative Monitoring Stack: ELK/EFK

**When to use**: Centralized logging; log analysis; compliance requirements

```yaml
# docker-compose.yml for ELK stack
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    ports:
      - "5044:5044"
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
```

### Alternative Auth: OAuth2/OIDC

**When to use**: Enterprise SSO; integration with identity providers

```typescript
// OAuth2 with node-oauth2-server
import oauth2 from 'oauth2orize';
import passport from 'passport';
import { OAuth2Client } from 'google-auth-library';

const server = oauth2.createServer();

// Token endpoint
server.token();

app.post('/oauth/token', passport.authenticate('oauth2-client-password', { session: false }), server.token());

// Google OAuth integration
const oauthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

async function verifyGoogleToken(token: string) {
  const ticket = await oauthClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
}
```

---

## Common Pitfalls & Solutions

| Issue | Impact | Solution |
|-------|--------|----------|
| Redis dependency in development | Medium | Use ioredis mock or in-memory alternatives for local dev |
| WebSocket reconnection race conditions | Medium | Implement proper connection state management |
| Task queue job loss on crash | High | Configure BullMQ with proper persistence and retry policies |
| Agent memory leaks | High | Implement TTL for shared context, monitor memory usage |
| Real-time update storms | Medium | Debounce updates, batch notifications |
| Security: Agent action isolation | High | Implement sandboxing, rate limiting, audit logging |
| **Queue deadlocks** | High | Avoid circular wait dependencies; use timeout-based job completion |
| **Scaling bottlenecks** | High | Implement horizontal scaling with queue partitioning; avoid single points of failure |
| **Disaster recovery** | High | Enable Redis persistence (RDB/AOF); implement regular backups; have failover strategy |
| **Task priority inversion** | Medium | Use BullMQ priority queues properly; avoid starvation of low-priority tasks |
| **Redis connection exhaustion** | High | Configure connection pooling; limit concurrent connections |
| **Race conditions in agent state** | High | Use atomic operations; implement optimistic locking for state transitions |
| **Unbounded queue growth** | High | Implement queue monitoring; set max queue size limits; configure TTL for stale tasks |
| **Silent task failures** | Medium | Configure dead letter queues; implement comprehensive error handling and logging |
| **Clock skew issues** | Medium | Use logical clocks or vector timestamps for distributed agent coordination |

---

## Recommendations

1. **Use BullMQ with Redis** for robust task queuing with priorities, retries, and concurrency control
2. **Use Socket.io** for real-time bidirectional communication with automatic reconnection
3. **Use Redis Pub/Sub** for inter-agent communication and shared memory
4. **Use React with shadcn/ui** for a modern, accessible dashboard
5. **Implement RBAC** with role-based permissions for agent access
6. **Add audit logging** for all agent operations for compliance and debugging
7. **Use TanStack Query** for server state management in React
8. **Implement graceful shutdown** to drain tasks before stopping agents
9. **Add Prometheus metrics** for agent health, task duration, and queue depth monitoring
10. **Use Winston or Pino** for structured JSON logging with appropriate log levels
11. **Implement JWT authentication** with Passport.js for secure API access
12. **Configure Redis persistence** (AOF + RDB) for disaster recovery
13. **Set up Grafana dashboards** for real-time visibility into agent performance
14. **Implement dead letter queues** for failed tasks that require manual intervention
15. **Use SSE instead of WebSocket** for simpler unidirectional real-time updates
16. **Consider Kafka** for high-throughput event streaming and audit requirements

---

## Implementation Guidance

### Installation

```bash
# Backend dependencies
npm install bullmq@5.28.2 socket.io@4.8.1 ioredis@5.4.2 express@4.21.2

# Monitoring dependencies
npm install prom-client@15.1.3

# Logging dependencies
npm install winston@3.17.0 pino@9.6.0 pino-pretty@13.0.0

# Authentication dependencies
npm install passport@0.7.0 passport-jwt@4.0.1 jsonwebtoken@9.0.2 helmet@8.0.0 cors@2.8.5 express-rate-limit@7.5.0

# Frontend dependencies
npm install @tanstack/react-query@5.64.1 zustand@5.0.3 socket.io-client@4.8.1
npx shadcn@latest init
```

### Configuration

**Redis Connection**:
```typescript
// config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});
```

**Environment Variables**:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
SOCKET_PORT=3001
```

### Integration Points

- **Agent Registry**: Store agent configs in Redis or database
- **Task Queue**: BullMQ queues for each agent type
- **Status Updates**: Socket.IO rooms per agent for targeted updates
- **Shared Context**: Redis hashes for agent context storage

---

## Code Examples

### Agent Status Store (Zustand)

```typescript
// stores/agentStore.ts
import { create } from 'zustand';

interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'error';
  lastTask?: string;
}

interface AgentStore {
  agents: Record<string, Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setAgents: (agents: Agent[]) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},
  updateAgent: (id, updates) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: { ...state.agents[id], ...updates }
      }
    })),
  setAgents: (agents) =>
    set(() => ({
      agents: agents.reduce((acc, agent) => ({ ...acc, [agent.id]: agent }), {})
    }))
}));
```

### Task Submission Hook

```typescript
// hooks/useTaskQueue.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface TaskPayload {
  agentId: string;
  taskType: string;
  data: Record<string, unknown>;
}

async function submitTask(payload: TaskPayload) {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}

export function useSubmitTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
}
```

---

## Sources & Verification

| Source | Type | Last Verified |
|--------|------|---------------|
| https://bullmq.io/ | Official | 2026-02-20 |
| https://socket.io/ | Official | 2026-02-20 |
| https://github.com/redis/node-redis | GitHub | 2026-02-20 |
| https://ui.shadcn.com/ | Official | 2026-02-20 |
| https://redis.io/docs/interact/pubsub/ | Official | 2026-02-20 |
| https://prometheus.io/docs/ | Official | 2026-02-20 |
| https://grafana.com/docs/ | Official | 2026-02-20 |
| https://github.com/winstonjs/winston | GitHub | 2026-02-20 |
| https://getpino.io/ | Official | 2026-02-20 |
| https://www.passportjs.org/docs/ | Official | 2026-02-20 |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-02-20 | Initial creation for task: Implement Agent Orchestration Platform |
| 2026-02-20 | Added monitoring tools (prom-client), logging libraries (winston, pino), authentication (passport, jwt), agent-specific patterns (registration, lifecycle, health monitoring), expanded pitfall coverage (15 issues including queue deadlocks, scaling, disaster recovery), added alternative tech stacks (Python/Celery/Kafka, SSE, ELK, OAuth2) |
