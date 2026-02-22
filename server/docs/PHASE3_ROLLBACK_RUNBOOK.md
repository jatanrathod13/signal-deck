# Phase 3 Rollback Runbook

## Scope
This runbook rolls back the Phase 3 production-core changes:
- Supabase-backed persistence bridge
- Supabase JWT/workspace auth middleware
- request correlation + structured logs + `/ready` endpoint

## Rollback Triggers
- Elevated 5xx rates after deploy
- Repeated auth failures for known-good users
- Supabase dependency instability affecting API availability
- Queue throughput degradation after observability/auth rollout

## Immediate Stabilization (No Redeploy Required)
1. Disable Supabase persistence:
   - set `FEATURE_SUPABASE_PERSISTENCE=false`
2. Disable Supabase auth middleware:
   - set `FEATURE_SUPABASE_AUTH=false`
3. Keep Redis/BullMQ live:
   - ensure `REDIS_HOST`, `REDIS_PORT` are valid
4. Restart server processes.

Expected result: API returns to Redis/in-memory backed behavior with pre-Phase-3 auth posture.

## Full Code Rollback
1. Identify the last known-good commit before Phase 3 merge.
2. Revert Phase 3 commit(s) in a new rollback commit:
   - `git revert <phase3_commit_sha>`
3. Redeploy from rollback commit.
4. Validate:
   - `/health` returns 200
   - `/api/system/healthz` returns healthy dependencies
   - task submission/processing flow completes end-to-end

## Data Considerations
- Phase 3 migration created new Supabase tables and policies.
- Rollback of app code does not require dropping DB objects.
- If DB schema rollback is required, apply a dedicated down migration after traffic is stable.

## Verification Checklist
1. Redis ping stable in `/api/system/healthz`.
2. Queue worker processing and completion metrics recover.
3. Error rate returns to baseline.
4. Websocket task/agent events still flow.
5. No sustained authentication 401/403 spikes (if auth disabled).

## Post-Rollback Follow-up
1. Capture incident timeline and blast radius.
2. Add/adjust canary gating for `FEATURE_SUPABASE_PERSISTENCE` and `FEATURE_SUPABASE_AUTH`.
3. Patch forward in a small-scope release with targeted tests.
