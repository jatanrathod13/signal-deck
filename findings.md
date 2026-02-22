# Findings: Agentic Capabilities Enhancement

## Repository Facts Captured
- Execution engine already supports tool-loop behavior through AI SDK ToolLoopAgent.
- Task processing uses BullMQ with retry/backoff but task metadata currently relies on in-memory map.
- Worker and API paths exist for submit/get/cancel/retry flows.
- Shared memory service exists and is already integrated as tools in execution.
- Tracing exists with LangSmith and basic cost/usage metadata.
- MCP tool loading is dynamic and supports both HTTP and stdio transports.

## Observed Gaps vs Advanced Agentic System
1. Planning primitives missing
- No first-class `Plan` or `PlanStep` model.
- No decomposition service that converts goals into structured step graphs.

2. Orchestration model limited
- Queue currently handles flat tasks, not parent-child dependency graphs.
- No coordinator role that routes sub-tasks by capability.

3. Durability inconsistency
- Agent persistence uses Redis; task metadata in memory can be lost on restart.
- Potential drift between queue state and metadata state.

4. Tool governance needs hardening
- Dynamic MCP tools are powerful but lack explicit per-agent policy enforcement layer.
- No centrally enforced budget/time guardrails per tool family.

5. Memory architecture is coarse
- Shared memory exists but lacks tiering and retrieval strategy.
- No compaction/summarization cycle for long-running workflows.

6. Evaluation loop incomplete
- Tests exist, but no benchmark harness measuring orchestration quality over time.
- No explicit KPI gates for rollout decisions.

## Prioritized Capability Upgrades
1. Reliability first (durable task state + idempotency)
2. Planning model (structured decomposition)
3. Multi-agent orchestration (DAG + coordinator)
4. Tool policy and safety controls
5. Memory tiering and compaction
6. Evaluation and continuous improvement loop

## Proposed KPIs
- Task success rate
- P95 completion latency
- Average retries per task
- Tool-call failure rate
- Cost per successful task
- Plan-step completion ratio

## Open Design Questions
- Persistence store of record for tasks/plans: Redis only vs Redis+Postgres?
- Orchestration strategy: strict DAG scheduler vs event-driven adaptive scheduler?
- Policy engine location: inline middleware vs dedicated policy service?
- Memory retrieval ranking: heuristic vs embedding-based from start?

## Assumptions Used
- Existing stack (Express + BullMQ + Redis + AI SDK) remains in place.
- Enhancement should be incremental without pausing current task queue features.
- Initial release targets operator-visible reliability and control before autonomy depth.
