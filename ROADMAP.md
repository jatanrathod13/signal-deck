# Signal Deck Roadmap

Updated: February 23, 2026

## North Star

Build the best open-source control plane for AI execution:

**Objective -> deterministic plan -> governed execution -> verifiable outcome**

## Product Scope (New Direction)

Signal Deck is not a generic chatbot framework.  
Signal Deck is an execution platform for teams that need:

- Multi-step orchestration
- Human-in-the-loop approvals
- Production-grade observability and reliability
- Repeatable automations (schedules, webhooks, APIs)

## Current Baseline (Already Implemented)

- Chat-first objective submission and run events
- Orchestration modes: sequential, parallel, DAG
- Queue-backed worker execution (BullMQ)
- Tool-loop and Claude CLI execution modes
- Run intelligence and artifacts endpoints
- Governance approvals, quotas, and audit hooks
- Reliability controls (rate limiting, circuit breakers, DLQ)
- Scheduler and webhook subsystems
- Supabase schema and feature-flagged persistence/auth bridges

## 2026 Roadmap

## Phase 1 (Weeks 1-4)

### Theme
Objective-to-outcome reliability.

### Deliverables

1. Make plan creation deterministic for objective runs (explicit planning contract, fewer heuristic branches).
2. Ensure every objective run can be traced from root task to terminal status with consistent artifacts.
3. Add full integration tests for:
   - objective submission -> plan creation -> child tasks -> completion
   - failure paths and retry paths
4. Harden run summaries to always produce operator-grade end-state output.

### Exit Criteria

1. >= 95% run completion for internal benchmark objectives.
2. 100% of runs include consistent run timeline + summary.
3. No silent failures (all failures observable with reason).

## Phase 2 (Weeks 5-8)

### Theme
Trust and human control.

### Deliverables

1. Approval UX parity for all gated actions (not only API-level lifecycle).
2. Evaluator loop promotion from heuristic to stronger model-backed evaluation flow.
3. Run intelligence UX:
   - clear phases
   - bottleneck surfacing
   - tool failure diagnostics
4. Operator playbooks for fail/rollback/requeue workflows.

### Exit Criteria

1. High-risk tool actions are fully pausable/resumable with approvals.
2. Operators can diagnose failed runs in under 5 minutes from UI.
3. Evaluation signals are visible and actionable per run.

## Phase 3 (Weeks 9-14)

### Theme
Production data plane hardening.

### Deliverables

1. Supabase persistence parity for all core runtime entities (not only partial bridges).
2. Make workspace-scoped auth + membership checks default production path.
3. Storage migration docs and rollout scripts for Redis->Supabase ownership boundaries.
4. Data retention and archival policies for run/event growth.

### Exit Criteria

1. Restart-safe execution with durable state across agents/tasks/plans/runs/events.
2. Tenant boundaries validated with integration tests.
3. Runbook for migration and rollback validated in staging.

## Phase 4 (Weeks 15-22)

### Theme
Open-source extensibility and adoption.

### Deliverables

1. Stable plugin/integration contract for tools and provider adapters.
2. Template packs for common use cases:
   - software delivery
   - incident operations
   - research synthesis
3. Better SDK ergonomics and CLI coverage for automation teams.
4. Contributor experience improvements (issue templates, examples, docs paths).

### Exit Criteria

1. External contributors can add a new integration without touching core runtime.
2. Time-to-first-success for new users < 15 minutes.
3. SDK/CLI cover top day-1 workflows.

## Phase 5 (Weeks 23-32)

### Theme
Scale and team operations.

### Deliverables

1. Multi-agent capacity controls and workload balancing improvements.
2. Advanced DAG features (branching policies, retries, compensation hooks).
3. SLO dashboards and automated rollback guards.
4. Usage analytics for workspace-level cost and performance governance.

### Exit Criteria

1. Stable performance under sustained concurrency benchmarks.
2. Documented operational SLOs with alerting thresholds.
3. Large-run scenarios complete with predictable latency and failure handling.

## Open Source Execution Plan

## Immediate Repo Priorities

1. Keep `README.md`, `ROADMAP.md`, and product docs current every phase.
2. Label issues by phase (`phase-1`, `phase-2`, etc.) and onboarding (`good-first-issue`).
3. Publish reference examples in-repo for repeatable objective runs.

## Community Hooks

1. Public benchmark objectives and weekly run-quality reports.
2. “Build with Signal Deck” integration examples.
3. Contributor calls for focused roadmap slices, not random feature drift.

## Success Metrics

## Product Metrics

1. Objective completion rate.
2. Median time from objective submission to terminal run status.
3. Approval turnaround latency.
4. Failure recoverability rate (retry/requeue success).

## Open Source Metrics

1. Time to first successful local run for new contributors.
2. Docs completeness and stale-doc regression rate.
3. External contribution throughput per phase.

## Not in Scope (For Now)

1. Broad “AI everything” expansion that does not improve objective-to-outcome execution.
2. Unbounded provider/integration additions without stable contracts.
3. UI-only polish work disconnected from runtime reliability, governance, or observability outcomes.

