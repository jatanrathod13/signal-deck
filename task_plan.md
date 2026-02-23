# Task Plan: Implement ROADMAP.md with Concrete Execution Plan

## Goal
Create an implementation-ready plan for `ROADMAP.md` that is grounded in the current codebase and verified with current Supabase and Vercel AI SDK guidance.

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery and Gap Analysis
- [x] Read `ROADMAP.md` end-to-end
- [x] Inventory current client/server capabilities
- [x] Identify completed vs missing roadmap items
- [x] Capture findings in `findings.md`
- **Status:** complete

### Phase 2: Platform Decisions and Architecture Freeze
- [x] Validate Supabase constraints (Auth, RLS, API keys, cron, realtime, audit)
- [x] Validate Vercel AI SDK constraints (MCP client, transport, stream resume)
- [x] Finalize target architecture and sequencing dependencies
- [x] Document key decisions and tradeoffs
- **Status:** complete

### Phase 3: Priority 1 (Month 1) Build Plan
- [x] Add initial Supabase schema migration scaffold (`workspaces`, `workspace_members`, `agents`, `tasks`, `plans`, `plan_steps`, `runs`, `run_events`, `webhooks`, `schedules`, `audit_events`) + baseline RLS
- [x] Define workspace-scoped repository interfaces for incremental service migration
- [x] Implement Supabase repository implementations and wire into existing services behind feature flags
- [x] Implement AuthN/AuthZ with Supabase Auth + JWT verification middleware
- [x] Implement observability hardening (health, readiness, metrics, structured logs)
- [x] Ship smoke/integration tests and rollback runbook
- **Status:** complete

### Phase 4: Priority 2 (Month 2) Build Plan
- [x] Expand dashboard for CRUD + real-time run/task observability
- [x] Add scheduling subsystem (pg_cron + fallback worker scheduler)
- [x] Add webhooks (inbound triggers + outbound notifications + retries)
- [x] Ship operational documentation and SLO baselines
- **Status:** complete

### Phase 5: Priority 3 (Month 3) Build Plan
- [x] Implement app-level multi-tenancy (workspaces/tenants in DB, not Supabase orgs)
- [x] Add governance workflows and auditability
- [x] Add caching strategy and connection pooling policies
- [x] Add quota metering and enforcement
- **Status:** complete

### Phase 6: Priority 4+5 (Month 4+) Build Plan
- [ ] Add IoT/MCP/provider integrations behind feature flags
- [ ] Add CLI/SDK/docs and reliability controls (DLQ/rate limit/circuit breaker)
- [ ] Add advanced orchestration (DAG, dynamic pools)
- [ ] Production readiness review and staged rollout
- **Status:** pending

### Phase 7: Delivery and Handoff
- [ ] Publish final implementation plan + milestone trackers
- [ ] Confirm dependencies/owners/acceptance criteria
- [x] Start execution with Week 1 quick wins
- **Status:** in_progress

## Key Questions
1. Should we keep Redis as cache/queue while moving source-of-truth state to Supabase Postgres? (Recommended: yes)
2. Should tenant isolation be soft (workspace_id + RLS) or hard (schema/database per tenant)? (Recommended: soft first)
3. Should scheduling be DB-native (`pg_cron`) or app-worker only? (Recommended: `pg_cron` for deterministic recurring tasks)
4. Should stream resumption be enabled immediately in chat UX? (Recommended: phase it in after persistence is complete)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use Supabase Postgres as system of record for agents/tasks/plans/runs | Current state is mostly in-memory + Redis; roadmap requires durable production persistence |
| Keep BullMQ/Redis for execution queue in early phases | Minimizes migration risk while persistence/auth changes land |
| Implement app multi-tenancy via `workspaces` + membership tables + RLS | Supabase Organizations are billing/team constructs, not runtime tenant boundaries |
| Use Supabase publishable + secret key model, avoid new `service_role` dependence where possible | Supabase recommends publishable/secret keys and explicit handling for elevated access |
| Prefer Realtime Broadcast for high-scale event fanout; start with Postgres Changes where simple | Supabase docs recommend Broadcast for scalability/security |
| Migrate MCP integration to `@ai-sdk/mcp` with HTTP transport in production | AI SDK docs recommend HTTP transport for production; stdio local only |
| Plan stream resume as opt-in and mutually exclusive with abort UX | AI SDK docs note abort and resume are incompatible |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `client` build type mismatch in schedule payload typing | 1 | Updated client API payload contract to allow partial payload and keep server-side validation authoritative |
| Webhook retry test timing race with fake timers | 1 | Reworked test timing to use async timer advancement and final-state assertions |

## Notes
- Current repo already has strong run intelligence/evaluator/governance scaffolding in `server/src/services`.
- Priority should target missing production foundations first: persistence, auth, observability hardening, and tenancy.
- Week 1 quick wins should be executed before broad feature expansion.
- M1 execution has started with migration/interface scaffolding to unblock repository implementation work in the next step.
- Phase 3 completion artifacts now include:
  - Supabase repository implementations for workspace/member/agent/task in `server/src/repositories/supabase`.
  - Feature-flagged Supabase persistence bridge wired into `agentService` and `taskPersistenceService`.
  - Supabase JWT + workspace membership auth middleware (`FEATURE_SUPABASE_AUTH`).
  - Structured request logging + correlation IDs + Prometheus request metrics.
  - `/ready` and `/api/system/ready` dependency checks (Redis + Supabase + queue).
  - Smoke/integration coverage for auth and readiness plus rollback/env docs.
- Phase 4 completion artifacts now include:
  - Schedule subsystem with fallback loop, pg_cron registration attempts, and CRUD/trigger APIs (`/api/schedules`).
  - Webhook subsystem with inbound triggers, outbound notifications, retry loop, and CRUD/test APIs (`/api/webhooks`).
  - Real-time socket events for scheduler and webhook delivery observability (`schedule-triggered`, `webhook-delivery`).
  - Dashboard expansion with dedicated Observability, Schedules, and Webhooks tabs plus agent edit support.
  - Operational documentation and SLO baseline at `server/docs/PHASE4_OPERATIONS_SLO_BASELINES.md`.
- Phase 5 completion artifacts now include:
  - Request-scoped workspace context via `AsyncLocalStorage` and tenant-aware filtering across agents, tasks, plans, runs, schedules, and webhooks.
  - Governance workflow APIs and auditability:
    - `server/src/routes/governanceRoutes.ts`
    - `server/src/services/auditService.ts`
    - Audit hooks in governance/schedule/webhook/task flows.
  - Caching and policy controls:
    - `server/src/services/cacheService.ts`
    - `server/src/services/runtimePolicyService.ts`
    - `GET /api/system/runtime-policies` and readiness cache telemetry.
  - Quota metering + enforcement:
    - `server/src/services/quotaService.ts`
    - Task submission/run-start quota checks and `GET /api/system/quotas`.
  - Redis/supabase connection policy hardening:
    - `server/config/redis.ts` policy exports and runtime option support.
    - `server/src/lib/supabaseClient.ts` timeout-aware fetch wrapper.
  - Phase 5 schema migration:
    - `server/src/supabase/migrations/202602230003_phase5_governance_quota.sql`.
