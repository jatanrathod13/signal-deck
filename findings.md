# Findings & Decisions

## Requirements
- Review `ROADMAP.md` and produce a concrete implementation plan.
- Use Supabase MCP docs and web search to validate current best practices.
- Use Vercel AI SDK guidance to ensure AI/runtime parts are technically correct.
- Ground the plan in this repo's real current state.

## Research Findings
- Current server has no Supabase integration (`@supabase/*` not present) and relies on Redis + in-memory maps for persistence.
- Current server already has:
  - Task queue via BullMQ/Redis.
  - Health endpoints (`/health`, `/api/system/healthz`) and metrics endpoint (`/api/metrics`).
  - Conversation/run timeline, deep research profile flags, governance/evaluator services.
- Current client already has a dashboard and workspace shell with real-time event timeline.
- No Docker artifacts exist (`Dockerfile`/`docker-compose` missing).

## Supabase MCP + Docs Findings
- API keys:
  - Supabase recommends publishable (`sb_publishable_*`) + secret (`sb_secret_*`) keys; legacy `anon`/`service_role` are transitional.
  - Secret/service-role bypasses RLS and must stay server-only.
- Auth and RBAC:
  - Custom claims + auth hooks are the recommended RBAC pattern for app roles.
- Scheduling:
  - Supabase Cron uses `pg_cron`; docs recommend limiting concurrent jobs and keeping jobs short.
- Realtime:
  - Broadcast is recommended for scalability/security; Postgres Changes is simpler but less scalable.
- Auditability:
  - `pgaudit` is available for DB-level audit; Auth audit logs are available via Auth logging features.
- Organizations:
  - Supabase Organizations are platform grouping/billing/team units, not in-app tenant isolation.

## Vercel AI SDK Findings (Local ai@6 docs + Web)
- MCP:
  - `@ai-sdk/mcp` with HTTP transport is the recommended production approach.
  - `stdio` transport is local-only.
- Chat transport:
  - `useChat` request options should be configured through transport or request-level options, not legacy top-level hook options.
- Stream resume:
  - Resume support requires persistence + Redis stream handling and dedicated POST/GET endpoints.
  - Abort and resume are currently incompatible; UX must choose one mode.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Introduce a data-access layer (`repositories/`) and migrate service by service | Enables gradual migration from Redis/in-memory to Postgres without full rewrite |
| Add workspace-aware schema (`workspace_id`) on core entities | Enables RLS-backed multi-tenancy and future quotas |
| Keep Redis for queue/cache while shifting canonical state to Postgres | Preserves runtime behavior and lowers migration risk |
| Add auth middleware that resolves Supabase user + workspace membership | Required to enforce per-workspace access in routes/services |
| Convert roadmap "Supabase Organizations" to "workspaces in app DB" | Aligns roadmap with actual Supabase capability boundaries |
| Migrate MCP client internals to `@ai-sdk/mcp` behind feature flag | Safe incremental rollout and compatibility fallback |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Very large MCP doc payloads from search tool | Switched to targeted topic queries and direct URL checks |
| Phase 4 client build type mismatch (`ScheduleTaskPayload` strictness) | Updated client API payload typing to accept partial schedule payload while runtime validation remains server-side |
| Phase 4 webhook retry test race under fake timers | Used async timer advancement (`jest.advanceTimersByTimeAsync`) and asserted final delivery state |

## Resources
- Roadmap: `/Users/jatanrathod/Applications/context-engineering-kit-test/ROADMAP.md`
- Existing master plan (different scope): `/Users/jatanrathod/Applications/context-engineering-kit-test/IMPLEMENTATION_MASTER_PLAN.md`
- Key server entrypoint: `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/index.ts`
- Task persistence (current): `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/taskPersistenceService.ts`
- Conversation routes: `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/routes/conversationRoutes.ts`
- Execution service: `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/executionService.ts`
- Supabase API keys: https://supabase.com/docs/guides/api/api-keys
- Supabase billing/org model: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase cron: https://supabase.com/docs/guides/cron
- Supabase RLS/RBAC custom claims: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase auth audit logs: https://supabase.com/docs/guides/auth/audit-logs
- Supabase realtime DB changes: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- Vercel AI SDK MCP tools: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
- Vercel AI SDK transport: https://ai-sdk.dev/docs/ai-sdk-ui/transport
- Vercel AI SDK resume streams: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams

## Visual/Browser Findings
- Supabase docs explicitly state organization-level billing model and project grouping.
- Supabase docs state Broadcast as the recommended scalable realtime pattern.
- AI SDK docs state stream resume requires storage + Redis and separate resume endpoint.

## M1 Execution Update (2026-02-22)
- Added first Supabase migration scaffold at `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/supabase/migrations/202602230001_initial_m1_schema.sql`.
- Migration includes app-level tenancy schema + RLS:
  - Tables: `workspaces`, `workspace_members`, `agents`, `tasks`, `plans`, `plan_steps`, `runs`, `run_events`, `webhooks`, `schedules`, `audit_events`.
  - Enums for statuses and execution modes aligned with current server type unions.
  - Indexes for tenancy, status filtering, run event ordering, idempotency, webhook/schedule processing.
  - RLS helper functions (`is_workspace_member`, `has_workspace_role`) and table policies.
- Added repository contract scaffold in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/repositories/`:
  - `repositoryModels.ts`: persisted models, list filters, create-input contracts.
  - `repositoryInterfaces.ts`: workspace/member/agent/task/plan/run/webhook/schedule/audit repository interfaces.
  - `index.ts`: central exports.
- Build verification passed after scaffolding: `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm run build`.

## Phase 3 Completion Update (2026-02-22)
- Persistence layer:
  - Added Supabase repository implementations:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/repositories/supabase/supabaseWorkspaceRepository.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/repositories/supabase/supabaseAgentRepository.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/repositories/supabase/supabaseTaskRepository.ts`
  - Added feature-flagged persistence bridge:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/supabasePersistenceService.ts`
  - Wired Supabase persistence into:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/agentService.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/taskPersistenceService.ts`
  - Corrected migration ID strategy to align with existing string IDs (`agent-*`, `task-*`, `run-*`) while retaining workspace UUID tenancy keys.
- AuthN/AuthZ:
  - Added middleware at `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/middleware/authMiddleware.ts`.
  - Enforces Supabase JWT verification and workspace membership checks when `FEATURE_SUPABASE_AUTH=true`.
  - Uses `x-workspace-id` tenant scoping and attaches `req.auth`.
- Observability hardening:
  - Added structured logger: `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/lib/logger.ts`.
  - Added request correlation + request metrics middleware:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/middleware/requestContextMiddleware.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/observabilityService.ts`
  - Added readiness checks:
    - `/ready` (root)
    - `/api/system/ready`
    - checks Redis + Supabase DB + BullMQ queue via `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/readinessService.ts`.
  - Added Prometheus endpoint: `/api/metrics/prometheus`.
- Validation and runbooks:
  - Added tests:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/tests/authMiddleware.test.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/tests/readinessService.test.ts`
  - Added docs:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/docs/ENVIRONMENT_CONTRACT.md`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/docs/PHASE3_ROLLBACK_RUNBOOK.md`
  - Added migration tooling helper:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/scripts/listMigrations.js`
    - `npm run migrations:list`
- Final verification:
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm run build` passed.
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm test` passed (17 suites, 115 tests).

## Phase 4 Completion Update (2026-02-22)
- Scheduling subsystem:
  - Added scheduler runtime service with fallback execution loop and cron parsing:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/scheduleService.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/lib/cronUtils.ts`
  - Added schedule CRUD + manual trigger routes:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/routes/scheduleRoutes.ts`
  - Added Supabase schedule repository:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/repositories/supabase/supabaseScheduleRepository.ts`
  - Added pg_cron helper migration:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/supabase/migrations/202602230002_phase4_scheduler_helpers.sql`
- Webhook subsystem:
  - Added webhook runtime service for inbound triggers, outbound dispatch, and retry loop:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/webhookService.ts`
  - Added webhook CRUD + test + inbound trigger routes:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/routes/webhookRoutes.ts`
  - Added Supabase webhook repository:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/repositories/supabase/supabaseWebhookRepository.ts`
  - Wired outbound webhook notifications to task lifecycle in:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/worker/taskWorker.ts`
- Dashboard expansion:
  - Added new operations UI surfaces:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/client/src/components/ObservabilityPanel.tsx`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/client/src/components/ScheduleManager.tsx`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/client/src/components/WebhookManager.tsx`
  - Extended dashboard tabs and mobile nav in:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/client/src/components/Dashboard.tsx`
  - Added agent edit support (PATCH API + client editor):
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/routes/agentRoutes.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/agentService.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/client/src/components/AgentCard.tsx`
- Real-time observability additions:
  - Added socket events `schedule-triggered` and `webhook-delivery` end-to-end.
  - Added operations event store:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/client/src/stores/operationsStore.ts`
- Operational documentation + SLO baseline:
  - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/docs/PHASE4_OPERATIONS_SLO_BASELINES.md`
  - Updated env contract:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/docs/ENVIRONMENT_CONTRACT.md`
- Verification:
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm run build` passed.
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm test` passed (20 suites, 123 tests).
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/client && npm run build` passed.

## Phase 5 Completion Update (2026-02-23)
- App-level multi-tenancy:
  - Added request-scoped workspace context service (`/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/workspaceContextService.ts`) and wired it through request/auth middleware.
  - Tenant-aware filtering/enforcement now applies in core runtime stores: agents/tasks/plans/conversations/runs/schedules/webhooks.
  - Core entities now carry `workspaceId` in runtime types where needed (`server/types/index.ts`).
- Governance workflows + auditability:
  - Added governance workflow API surface at `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/routes/governanceRoutes.ts`.
  - Added durable audit logging service with Supabase insert + in-memory fallback at `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/auditService.ts`.
  - Approval lifecycle now writes audit events (`governance.approval.requested`, `.resolved`, `.timed_out`) and workspace scoping is enforced.
- Caching + connection pooling policies:
  - Added bounded TTL cache with metrics and invalidation (`/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/cacheService.ts`).
  - Added runtime policy snapshot service (`/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/runtimePolicyService.ts`) and `/api/system/runtime-policies` endpoint.
  - Redis connection policy moved into typed config (`/Users/jatanrathod/Applications/context-engineering-kit-test/server/config/redis.ts`) and reused by queue/worker clients.
  - Supabase admin client now uses timeout-aware fetch policy (`server/src/lib/supabaseClient.ts`).
- Quota metering + enforcement:
  - Added quota service (`/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/quotaService.ts`) with workspace-scoped task/hour and run/day windows.
  - Enforced quotas in task submission and conversation run start paths with 429 responses.
  - Added `/api/system/quotas` endpoint for current workspace usage reporting.
- Schema:
  - Added Phase 5 migration `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/supabase/migrations/202602230003_phase5_governance_quota.sql` with:
    - `workspace_governance_workflows`
    - `workspace_quota_policies`
    - `workspace_quota_usage`
    - indexes, triggers, and RLS policies.
- Verification:
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm run build` passed.
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm test` passed (19 suites, 120 tests).
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/client && npm run build` passed.

## Phase 6 Completion Update (2026-02-23)
- IoT/MCP/provider integrations behind feature flags:
  - Added integration catalog service at `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/integrationCatalogService.ts`.
  - Added `GET /api/system/integrations` for category-filtered templates (`iot|mcp|provider`).
  - Extended feature-flag surface in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/types/index.ts`:
    - `FEATURE_IOT_INTEGRATIONS`
    - `FEATURE_EXTERNAL_AI_PROVIDERS`
    - `FEATURE_MCP_SDK_CLIENT` gating now enforced before MCP tool loading.
  - Provider catalog exposure now requires both `FEATURE_PROVIDER_TOOLS` and `FEATURE_EXTERNAL_AI_PROVIDERS`.
- CLI/SDK/docs and reliability controls:
  - Added SDK client:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/sdk/orchestrationClient.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/sdk/index.ts`
  - Added CLI:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/cli/orchestratorCli.ts`
    - `npm run cli` in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/package.json`.
  - Added API docs endpoint:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/apiDocsService.ts`
    - `GET /api/system/openapi.json`.
  - Added reliability controls:
    - HTTP rate limiting middleware (`FEATURE_HTTP_RATE_LIMIT`) in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/middleware/rateLimitMiddleware.ts`.
    - Circuit breaker service (`FEATURE_CIRCUIT_BREAKERS`) in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/circuitBreakerService.ts`.
    - Dead letter queue service (`FEATURE_DEAD_LETTER_QUEUE`) in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/deadLetterQueueService.ts`.
    - Worker now records failed tasks to DLQ in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/worker/taskWorker.ts`.
- Advanced orchestration:
  - Added DAG orchestration with cycle/dependency validation in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/orchestratorService.ts`.
  - Added `POST /api/plans/dag` in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/routes/planRoutes.ts`.
  - Added load-aware `least_loaded` assignment strategy for dynamic pools behind `FEATURE_DYNAMIC_AGENT_POOLS`.
  - Extended orchestration strategy union to include `dag`.
- Production readiness review and staged rollout:
  - Added readiness review service and endpoint:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/productionReadinessService.ts`
    - `GET /api/system/readiness/review`.
  - Expanded runtime policy/readiness surfaces with reliability snapshots:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/runtimePolicyService.ts`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/src/services/readinessService.ts`.
  - Added docs:
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/docs/PHASE6_CLI_SDK_GUIDE.md`
    - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/docs/PHASE6_ROLLOUT_RUNBOOK.md`
    - Updated `/Users/jatanrathod/Applications/context-engineering-kit-test/server/docs/ENVIRONMENT_CONTRACT.md`.
- Test additions:
  - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/tests/integrationCatalogService.test.ts`
  - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/tests/rateLimitMiddleware.test.ts`
  - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/tests/circuitBreakerService.test.ts`
  - `/Users/jatanrathod/Applications/context-engineering-kit-test/server/tests/deadLetterQueueService.test.ts`
  - Expanded orchestration tests in `/Users/jatanrathod/Applications/context-engineering-kit-test/server/tests/orchestratorService.test.ts`.
- Verification:
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm run build` passed.
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/server && npm test` passed (24 suites, 135 tests).
  - `cd /Users/jatanrathod/Applications/context-engineering-kit-test/client && npm run build` passed.
