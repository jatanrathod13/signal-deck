# Task Plan: Enhance Agentic Capabilities

## Goal
Upgrade the platform from single-task execution to a robust multi-agent orchestration system with explicit planning, reliable execution, governed tool use, and measurable quality improvements.

## Scope
- Server orchestration capabilities
- Agent planning/decomposition
- Task graph execution and coordination
- Memory architecture and retrieval
- Tool policy/safety controls
- Observability and evaluation
- Minimal client updates required for visibility/control

## Non-Goals
- Full visual redesign of dashboard
- Multi-tenant auth overhaul
- Provider migration away from current AI SDK stack

## Current Baseline (Observed)
- ToolLoopAgent execution with base tools and optional MCP tools
- BullMQ queue + worker for async task handling
- Redis-backed shared memory service
- LangSmith tracing integration
- Realtime socket events for task/agent state
- In-memory task metadata store (restart-sensitive)

## Phases

### Phase 0 - Discovery and Alignment
status: complete
owner: codex
outputs:
- Baseline architecture inventory
- Gap list for agentic maturity
- Prioritized roadmap draft
acceptance:
- Clear list of what exists vs. missing for advanced agentic workflows

### Phase 1 - Reliability Foundation
status: pending
owner: backend
outputs:
- Durable task persistence (Redis or Postgres-backed metadata)
- Idempotent task submission and retry keys
- Normalized error taxonomy + failure metadata
- Worker/task lifecycle hardening for restart safety
acceptance:
- No task-loss across process restart
- Duplicate submit protection validated
- Retry behavior deterministic and observable

### Phase 2 - Planning Layer
status: pending
owner: backend
outputs:
- Plan and PlanStep domain models and storage
- Planner service to decompose objectives into executable steps
- Plan revision history and status transitions
- New APIs for plan create/read/update
acceptance:
- Complex objective produces explicit multi-step plan
- Step statuses are queryable and recoverable

### Phase 3 - Multi-Agent Orchestration
status: pending
owner: backend
outputs:
- Coordinator/orchestrator service for parent-child tasks
- Dependency-aware step execution (DAG style)
- Agent handoff contract via structured payload + memory keys
- Cancellation propagation and retry strategy across child tasks
acceptance:
- Parent task can schedule and monitor child tasks end-to-end
- Dependency blocks/unblocks operate correctly

### Phase 4 - Memory Intelligence
status: pending
owner: backend
outputs:
- Memory tiers: working, episodic, shared
- Retrieval policies by scope (task/agent/global)
- Memory compaction/summarization jobs
- Retention and TTL policy per memory tier
acceptance:
- Cross-task context retrieval improves completion quality
- Context size controlled via compaction policies

### Phase 5 - Tool Governance and Safety
status: pending
owner: backend
outputs:
- Per-agent tool allowlist/denylist and policy checks
- Input/output schema validation guardrails
- Tool timeout/retry/circuit breaker policy
- Auditable tool invocation logs with policy decisions
acceptance:
- Invalid or unauthorized tool calls are blocked deterministically
- Tool failures degrade gracefully without crashing orchestration

### Phase 6 - Observability, Evaluation, and Iteration
status: pending
owner: backend + qa
outputs:
- Evaluation harness with baseline benchmark suite
- KPI dashboards (success rate, latency, retries, cost, tool errors)
- Post-run critique loop (automatic analysis of failures)
- Regression gates for new orchestration changes
acceptance:
- Baseline metrics captured and tracked weekly
- At least one improvement loop closes from findings to fix

### Phase 7 - Client Visibility and Operator UX
status: pending
owner: frontend
outputs:
- Execution graph/timeline view for plans and steps
- Parent-child task links, blockers, and retry actions
- Tool activity and memory access traces in UI
- Failure reason surfaces with remediation hints
acceptance:
- Operator can diagnose failed orchestration without reading server logs

## Dependencies and Sequencing
1. Phase 1 before 2/3 (durability first)
2. Phase 2 before 3 (planner outputs feed orchestrator)
3. Phase 3 before 7 (UI depends on orchestration data)
4. Phase 5 can start after 2 but should complete before production rollout
5. Phase 6 starts with baseline in Phase 1 and deepens through all phases

## Risks and Mitigations
- Risk: In-memory task state drift with worker state
  mitigation: single source of truth + reconciliation loop
- Risk: Tool explosion from MCP endpoints
  mitigation: explicit tool policy layer and per-agent tool budget
- Risk: Token/cost growth from long contexts
  mitigation: memory tiering and compaction
- Risk: Complex orchestration regressions
  mitigation: benchmark suite + regression gates

## Deliverables
- Architectural design doc for planning + orchestration state machine
- API contract updates for plan/step/task graph endpoints
- Migration scripts for persistence layer
- End-to-end integration tests for multi-agent workflows
- KPI report and benchmark baseline

## Milestone Timeline (Target)
- Week 1-2: Phase 1
- Week 2-3: Phase 2
- Week 3-5: Phase 3
- Week 4-5: Phase 4 (overlapping)
- Week 5-6: Phase 5
- Week 6-8: Phase 6
- Week 7-8: Phase 7

## Definition of Done (Program-Level)
- Multi-step objective is automatically planned, delegated, executed, and traceable
- Failure handling supports cancellation, retries, and operator diagnostics
- Tool execution is policy-governed and auditable
- KPIs show measurable improvement vs baseline

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| None | 0 | N/A |
