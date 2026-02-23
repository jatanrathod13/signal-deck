# Public Benchmark Objectives (v1)

These are the first benchmark issues to create and pin for community traction.

## How to use this file

1. Create one GitHub issue per objective below.
2. Add labels shown in each objective block.
3. Link each issue inside a pinned tracker issue.

## Objective 01: Deterministic Planning Path

### Purpose
Validate that a standard objective consistently creates a traceable plan and completion summary.

### Suggested labels
- `type:benchmark`
- `phase-1`
- `area:orchestrator`
- `priority:P0`

### Prompt
Research a technical topic, produce a concise summary, and include a validation checklist.

### Acceptance
- Run reaches terminal state (`completed` or `failed`) with explicit reason.
- Timeline includes planning and execution phase events.
- Output summary is non-empty and operator-readable.

## Objective 02: Orchestration Failure Explainability

### Purpose
Verify that failed runs provide actionable failure context.

### Suggested labels
- `type:benchmark`
- `phase-1`
- `area:reliability`
- `priority:P0`

### Prompt
Trigger a run that intentionally causes a tool or execution failure.

### Acceptance
- Run transitions to `failed` with clear error reason.
- Timeline contains failure event(s) and diagnostic context.
- Failure can be retried/requeued with documented path.

## Objective 03: Governance Gate Roundtrip

### Purpose
Ensure approval-required actions pause and resume correctly.

### Suggested labels
- `type:benchmark`
- `phase-2`
- `area:governance`
- `priority:P1`

### Prompt
Execute an objective that invokes at least one approval-gated tool/action.

### Acceptance
- Approval request is emitted and visible.
- Run pauses pending decision.
- Approve and deny paths both behave as expected.

## Objective 04: End-to-End DAG Reliability

### Purpose
Validate DAG orchestration behavior under realistic multi-step dependencies.

### Suggested labels
- `type:benchmark`
- `phase-1`
- `area:orchestrator`
- `priority:P1`

### Prompt
Run a DAG objective with at least 4 steps and explicit dependencies.

### Acceptance
- Dependencies respected (no step starts before prerequisites).
- Terminal state reflects aggregate DAG success/failure.
- Plan and step status transitions are consistent.

## Objective 05: Readiness and Policy Signal Accuracy

### Purpose
Confirm readiness review aligns with active flags/runtime state.

### Suggested labels
- `type:benchmark`
- `phase-2`
- `area:reliability`
- `priority:P1`

### Prompt
Evaluate readiness report across multiple feature-flag configurations.

### Acceptance
- Report status reflects true dependency/flag state.
- Blocked stages identify explicit gate reasons.
- Operators can use report as go/no-go signal.

## Objective 06: Data Durability Smoke (Supabase Path)

### Purpose
Validate restart-safe run/task state with Supabase persistence path enabled.

### Suggested labels
- `type:benchmark`
- `phase-3`
- `area:data-plane`
- `priority:P1`

### Prompt
Run objective, restart services, and verify state continuity.

### Acceptance
- Core state survives restart.
- Workspace scoping remains correct.
- No data mismatch between runtime and persisted records.

## Objective 07: Operator UX Triage Time

### Purpose
Measure how quickly an operator can diagnose a failed run from UI/API surfaces.

### Suggested labels
- `type:benchmark`
- `phase-2`
- `area:ui`
- `priority:P2`

### Prompt
Use observability and run intelligence surfaces to diagnose a seeded failure.

### Acceptance
- Root cause identified within 5 minutes.
- Required signals are present without raw-log hunting.
- Suggested remediation path is clear.

