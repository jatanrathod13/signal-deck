 # Master Implementation Plan: Deep Research + AI SDK Platform Upgrade

## Summary
This plan implements all roadmap items end-to-end in a way that supports parallel Codex execution across multiple worktrees without merge chaos.
Canonical tracking artifact path: `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/IMPLEMENTATION_MASTER_PLAN.md`.
In this planning turn, the file content is fully specified; the first execution thread will create the file at that path and keep it updated.

## Root Artifact Structure (Single Master Plan)
Use one root markdown file with these fixed sections so every thread writes to the same schema:

1. `Program Status`
2. `Dependency Graph`
3. `Milestones`
4. `Parallel Lane Board`
5. `API and Type Contracts`
6. `Test Matrix`
7. `Rollout and Flags`
8. `Risks and Decisions`
9. `Change Log`

Use these status values only: `TODO`, `IN_PROGRESS`, `BLOCKED`, `IN_REVIEW`, `DONE`.

## Parallel Execution Model (Domain Lanes)
Use domain lanes (selected) with strict file ownership to reduce conflicts.

| Lane | Scope | Primary Paths |
|---|---|---|
| Lane A: Runtime Core | Planner determinism, orchestration, model routing | `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/services/executionService.ts`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/services/orchestratorService.ts`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/types/index.ts` |
| Lane B: Integrations | MCP migration, provider-native tools, tool catalog | `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/services/mcpClientService.ts`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/routes/toolRoutes.ts`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/services/executionService.ts` |
| Lane C: UX + Realtime | Chat transport unification, resumable streams, run intelligence UI | `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/client/src/components/AgentWorkspace.tsx`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/client/src/hooks/useSocket.tsx`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/client/src/hooks/useConversations.ts`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/client/src/lib/api.ts` |
| Lane D: Trust + Observability | Evaluator loop, governance approvals, telemetry/tracing hardening | `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/services/tracingService.ts`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/routes/runRoutes.ts`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/services/toolPolicyService.ts` |
| Lane E: Productization | Packaging direction, docs, admin defaults, rollout guidance | `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/.specs`, `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/AGENTS.md` (if needed), root docs |

Branch naming per thread: `codex/<lane>-<milestone>-<short-topic>`.

## Milestones and Dependencies

### M0: Contract Freeze and Baseline
Goal: lock interfaces before parallel coding.

1. Freeze new types and endpoint contracts in one PR.
2. Add feature flags and defaults.
3. Add test scaffolds for new flows.

Exit criteria:
1. Contract table approved.
2. All lanes can start independently.

### M1: Core Foundation (selected Wave 1)
Implements roadmap items:
1. Deterministic planner + structured outputs.
2. Dynamic model routing per step.
3. Realtime transport unification groundwork.

Deliverables:
1. Replace heuristic-only plan generation with schema-backed planner pipeline.
2. Add route selection logic by task class, tool need, and budget.
3. Introduce single canonical run-stream path and compatibility shim for existing socket consumers.

Exit criteria:
1. A run produces structured plan metadata.
2. Model route decisions are logged per step.
3. Reconnect/resume works without duplicated final answers.

### M2: Deep Research Mode
Implements roadmap item:
1. Deep research mode with parallel subagents and synthesis.

Deliverables:
1. Add `executionProfile=deep_research` and research config input.
2. Add parallel research phases: discover, extract, cross-check, synthesize.
3. Emit source artifacts and confidence scoring in run output.
4. UI mode switch and source panel in workspace.

Exit criteria:
1. User can run deep research from existing conversation flow.
2. Final answer includes structured sources and confidence summary.

### M3: Integrations Upgrade
Implements roadmap items:
1. Provider-native tools exposure.
2. MCP migration to AI SDK MCP client.

Deliverables:
1. Migrate from custom MCP wrapper to `@ai-sdk/mcp` client path.
2. Expose provider tools as toggles in catalog and policy.
3. Add compatibility layer so existing MCP server config still works.

Exit criteria:
1. Existing MCP configs continue working.
2. Provider tool enable/disable is policy-controlled and visible.

### M4: Trust, Governance, and Run Intelligence
Implements roadmap items:
1. Evaluator loop.
2. Governance controls.
3. Run intelligence timeline.

Deliverables:
1. Add evaluator pass before `finalAnswer` completion.
2. Add approval checkpoints for risky tools/actions.
3. Convert raw run events into grouped timeline phases with bottleneck and failure insights.
4. Strengthen tracing consistency and token/cost visibility.

Exit criteria:
1. Low-score outputs auto-revise or fail with reason.
2. Approval-required actions pause and resume correctly.
3. Timeline shows phase summaries, not only raw JSON blobs.

### M5: Product Packaging and Launch Readiness
Implements roadmap item:
1. Product packaging direction.

Deliverables:
1. Positioning and docs: “Team AI Ops for research + execution.”
2. Admin defaults and templates for common team setups.
3. Launch checklist and SLO dashboard definitions.

Exit criteria:
1. Docs and defaults enable quick adoption by first customer teams.
2. All feature flags have staged rollout plans.

## Public APIs, Interfaces, and Type Changes

### Server Type Additions
Update `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/types/index.ts`:

1. Add `ExecutionProfile = 'standard' | 'deep_research'`.
2. Add `ResearchDepth = 'quick' | 'standard' | 'deep'`.
3. Extend `AgentConfig` with:
   - `modelRouting`
   - `providerTools`
   - `evaluationPolicy`
   - `governancePolicy`
4. Extend `RunEventType` with:
   - `research.finding`
   - `research.source`
   - `model.route.selected`
   - `evaluation.completed`
   - `approval.requested`
   - `approval.resolved`
   - `stream.resumed`
5. Add `RunArtifacts` shape for sources, evaluator result, approvals, and route decisions.

### Conversation Message API Contract
Update `/api/conversations/:conversationId/messages` request schema in `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/routes/conversationRoutes.ts` and matching client types in `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/client/src/lib/api.ts`:

1. Add optional `executionProfile`.
2. Add optional `research` object:
   - `depth`
   - `parallelism`
   - `requireCitations`
   - `maxSources`
3. Preserve backward compatibility when absent.

### Run API Additions
Extend `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/routes/runRoutes.ts`:

1. `GET /api/runs/:runId/intelligence` returns grouped phases, bottlenecks, tool failure summary, route summary.
2. `GET /api/runs/:runId/artifacts` returns sources, evaluator scorecard, approvals, citation map.
3. `POST /api/runs/:runId/approvals/:approvalId` handles approve/deny for pending checkpoints.

### Tool Catalog API Additions
Extend `/Users/jatanrathod/.codex/worktrees/8d51/context-engineering-kit-test/server/src/routes/toolRoutes.ts` response:

1. Add provider tool capabilities with source `provider`.
2. Include policy status and reason for disabled tools.

## Implementation Work Packages (Parallel-Ready)

| Package ID | Lane | Milestone | Deliverable | Depends On |
|---|---|---|---|---|
| WP-00 | A | M0 | Contract freeze PR with type and API stubs | none |
| WP-01 | A | M1 | Structured planner output pipeline | WP-00 |
| WP-02 | A | M1 | `prepareStep` model routing + route logging | WP-00 |
| WP-03 | C | M1 | Unified stream transport + resume compatibility | WP-00 |
| WP-04 | A | M2 | Deep research orchestration phases | WP-01, WP-02 |
| WP-05 | C | M2 | Deep research UX mode, sources panel, confidence view | WP-03, WP-04 |
| WP-06 | B | M3 | MCP migration to `@ai-sdk/mcp` with fallback compatibility | WP-00 |
| WP-07 | B | M3 | Provider-native tools in catalog and policy | WP-00 |
| WP-08 | D | M4 | Evaluator loop + auto-revision/fail policy | WP-01 |
| WP-09 | D | M4 | Governance approvals lifecycle | WP-00, WP-03 |
| WP-10 | C | M4 | Run intelligence timeline UI | WP-03, WP-08, WP-09 |
| WP-11 | D | M4 | Tracing consistency and cost/token improvements | WP-00 |
| WP-12 | E | M5 | Product packaging docs + rollout playbook | WP-05, WP-10 |

## Testing and Acceptance Scenarios

### Unit Tests
1. Planner outputs valid schema for ambiguous and explicit objectives.
2. Routing picks expected model classes for cheap vs complex tasks.
3. MCP adapter preserves tool contracts and error mapping.
4. Evaluator decisions follow threshold policy.
5. Approval state machine handles timeout, approve, deny.

### Integration Tests
1. Conversation message with `executionProfile=deep_research` creates multi-phase run.
2. Run artifacts endpoint returns sources and evaluator scorecard.
3. Provider tools can be enabled and denied via policy.
4. Resume after disconnect continues same run without duplicate completion.

### End-to-End Scenarios
1. User requests deep research, sees live progress, receives cited final answer.
2. Risky tool request pauses run until approval; approve resumes and completes.
3. Failed tool phase triggers evaluator failure handling with clear user explanation.
4. Run intelligence page identifies longest phase and primary failure reason.

### Regression Gates
1. Existing `tool_loop` and `claude_cli` flows remain functional.
2. Existing conversation creation and basic run retrieval APIs remain backward compatible.
3. Existing socket event consumers still receive core events during migration window.

## Rollout and Feature Flags
Define and use these flags:

1. `FEATURE_DEEP_RESEARCH`
2. `FEATURE_MCP_SDK_CLIENT`
3. `FEATURE_PROVIDER_TOOLS`
4. `FEATURE_EVALUATOR_LOOP`
5. `FEATURE_APPROVAL_GATES`
6. `FEATURE_RUN_INTELLIGENCE_UI`
7. `FEATURE_RESUMABLE_STREAM_TRANSPORT`

Rollout order:
1. Internal dark launch.
2. Team-only beta.
3. Default-on for new agents.
4. Progressive enable for existing agents.

## Progress Tracking

| ID | Lane | Milestone | Scope | Owner | Status | Branch | PR | Last Update | Blocker |
|---|---|---|---|---|---|---|---|---|---|
| WP-00 | A | M0 | Contract freeze — types + API stubs + feature flags | Agent | DONE | `codex/a-m0-contracts` | — | 2026-02-22 | none |
| WP-01 | A | M1 | Structured planner output pipeline | Agent | DONE | `codex/a-m1-planner` | — | 2026-02-22 | none |
| WP-02 | A | M1 | `prepareStep` model routing + route logging | Agent | DONE | `codex/a-m1-routing` | — | 2026-02-22 | none |
| WP-03 | C | M1 | Unified stream transport + resume compatibility | Agent | DONE | `codex/c-m1-transport` | — | 2026-02-22 | none |
| WP-04 | A | M2 | Deep research orchestration phases | Agent | DONE | `codex/a-m2-research` | — | 2026-02-22 | none |
| WP-05 | C | M2 | Deep research UX mode, sources panel, confidence view | Agent | DONE | `codex/c-m2-research-ux` | — | 2026-02-22 | none |
| WP-06 | B | M3 | MCP migration to `@ai-sdk/mcp` with fallback compatibility | Agent | DONE | `codex/b-m3-mcp` | — | 2026-02-22 | none |
| WP-07 | B | M3 | Provider-native tools in catalog and policy | Agent | DONE | `codex/b-m3-provider-tools` | — | 2026-02-22 | none |
| WP-08 | D | M4 | Evaluator loop + auto-revision/fail policy | Agent | DONE | `codex/d-m4-evaluator` | — | 2026-02-22 | none |
| WP-09 | D | M4 | Governance approvals lifecycle | Agent | DONE | `codex/d-m4-governance` | — | 2026-02-22 | none |
| WP-10 | C | M4 | Run intelligence timeline UI | Agent | DONE | `codex/c-m4-intelligence` | — | 2026-02-22 | none |
| WP-11 | D | M4 | Tracing consistency and cost/token improvements | Agent | DONE | `codex/d-m4-tracing` | — | 2026-02-22 | none |
| WP-12 | E | M5 | Product packaging docs + rollout playbook | Agent | DONE | `codex/e-m5-packaging` | — | 2026-02-22 | none |

## Assumptions and Defaults
1. Existing queue and run/event model remains the core runtime; no platform rewrite.
2. Conversation API remains the primary entrypoint; deep research is a profile, not a separate product surface.
3. Backward compatibility is mandatory for existing agents and client hooks.
4. MCP migration prioritizes compatibility first, then removal of legacy wrapper code.
5. Evaluation thresholds default to conservative values and can be tuned later.
6. Approval gates default to off globally and on per-agent policy.
7. AI Gateway continues as default route when configured; OpenAI direct remains fallback.
8. Master tracking file in repo root is the single source of truth for parallel thread coordination.
