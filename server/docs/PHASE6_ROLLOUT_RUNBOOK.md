# Phase 6 Rollout Runbook (Priority 4 + 5)

## Scope
This runbook covers Phase 6 rollout for:
- IoT/MCP/provider integrations behind feature flags
- Reliability controls (HTTP rate limiting, circuit breakers, dead letter queue)
- Advanced orchestration (DAG + dynamic pool assignment)
- CLI/SDK/doc discoverability and production readiness review

## Feature Flags
- `FEATURE_MCP_SDK_CLIENT`
- `FEATURE_IOT_INTEGRATIONS`
- `FEATURE_PROVIDER_TOOLS`
- `FEATURE_EXTERNAL_AI_PROVIDERS`
- `FEATURE_HTTP_RATE_LIMIT`
- `FEATURE_CIRCUIT_BREAKERS`
- `FEATURE_DEAD_LETTER_QUEUE`
- `FEATURE_ADVANCED_DAG`
- `FEATURE_DYNAMIC_AGENT_POOLS`

## Staged Rollout Plan
1. Stage 0 (dark launch)
- Keep all new Phase 6 flags disabled.
- Deploy code and verify baseline health:
  - `GET /health`
  - `GET /ready`
  - `GET /api/system/runtime-policies`

2. Stage 1 (reliability controls)
- Enable:
  - `FEATURE_HTTP_RATE_LIMIT=true`
  - `FEATURE_CIRCUIT_BREAKERS=true`
  - `FEATURE_DEAD_LETTER_QUEUE=true`
- Verify:
  - `GET /api/system/runtime-policies` includes `reliability` snapshot
  - `GET /api/system/dlq` returns queue entries
  - `GET /api/system/readiness/review` shows resilience gates improving

3. Stage 2 (integration visibility)
- Enable:
  - `FEATURE_MCP_SDK_CLIENT=true`
- Optionally enable:
  - `FEATURE_IOT_INTEGRATIONS=true`
  - `FEATURE_PROVIDER_TOOLS=true`
  - `FEATURE_EXTERNAL_AI_PROVIDERS=true`
- Verify:
  - `GET /api/system/integrations` shows enabled templates
  - `GET /api/tools/catalog` reflects provider and MCP flags

4. Stage 3 (advanced orchestration)
- Enable:
  - `FEATURE_ADVANCED_DAG=true`
- Optional load-aware assignment:
  - `FEATURE_DYNAMIC_AGENT_POOLS=true`
- Verify:
  - `POST /api/plans/dag` accepts DAG graph and schedules ready nodes
  - Plan updates flow through standard run/task events

5. Stage 4 (operational review)
- Use readiness review API as go/no-go gate:
  - `GET /api/system/readiness/review`
- Require all stages to show `ready` before broad rollout.

## Rollback Procedure
1. Disable Phase 6 flags in reverse order:
- `FEATURE_DYNAMIC_AGENT_POOLS=false`
- `FEATURE_ADVANCED_DAG=false`
- integration flags
- reliability flags

2. Confirm service recovers to baseline:
- `GET /ready` returns status `ok`
- `GET /api/system/readiness/review` returns foundation stage as `ready`

3. Drain failed workload safely:
- Inspect `GET /api/system/dlq`
- Requeue valid tasks via `POST /api/system/dlq/:entryId/requeue`

## Operational Endpoints
- `GET /api/system/integrations`
- `GET /api/system/runtime-policies`
- `GET /api/system/dlq`
- `POST /api/system/dlq/:entryId/requeue`
- `GET /api/system/readiness/review`
- `GET /api/system/openapi.json`
