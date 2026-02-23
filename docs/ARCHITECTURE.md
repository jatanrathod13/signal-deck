# Architecture Overview

## Runtime components

1. Client (`React + Vite`)
   - Workspace UI
   - Agent/task/observability panels
   - Socket event consumption
2. API (`Express + Socket.IO`)
   - Routes for agents, tasks, plans, runs, schedules, webhooks, governance
3. Orchestration layer
   - Plan generation and dependency management
   - Sequential/parallel/DAG execution strategies
4. Execution layer
   - Tool-loop runtime
   - Claude CLI runtime
   - Tool policy, model routing, evaluator, governance hooks
5. Queue + worker (`BullMQ + Redis`)
   - Asynchronous task execution
   - Retry, failure handling, child-task chaining
6. Persistence/data plane
   - Redis-backed runtime caches/stores
   - Supabase feature-flagged repositories and schema

## Objective-to-outcome sequence

1. User submits objective in conversation endpoint.
2. API creates run and root task.
3. Task enters queue and worker starts execution.
4. If orchestration is needed, plan is generated and step tasks are queued.
5. Worker executes step tasks and updates run/task/plan state.
6. Governance and evaluator policies apply during execution.
7. Run ends in completed/failed/cancelled with timeline events and artifacts.

## Reliability and safety layers

1. Request-level rate limits
2. Circuit breakers around unstable dependencies
3. Dead-letter queue for failed tasks
4. Quota enforcement per workspace
5. Readiness gates for staged rollout decisions

## Operational surfaces

1. `/health`, `/ready`, `/api/system/healthz`
2. `/api/system/readiness/review`
3. `/api/metrics` and `/api/metrics/prometheus`
4. Socket events for run/task/schedule/webhook updates

## Storage strategy

Current approach:

1. Queue and hot runtime state use Redis and in-memory caches.
2. Supabase persistence/auth are behind feature flags for staged adoption.

Target approach:

1. Supabase as durable system of record for core entities.
2. Redis retained for queueing and low-latency runtime needs.

## Design principles

1. Deterministic execution beats magical behavior.
2. Every failure must be observable and actionable.
3. Governance should be enforceable, not advisory.
4. Feature rollout must be flag-driven and reversible.

