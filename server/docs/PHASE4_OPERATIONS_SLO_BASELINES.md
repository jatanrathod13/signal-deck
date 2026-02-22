# Phase 4 Operations Guide and SLO Baselines

## Scope
This document defines baseline operational targets for:
- Dashboard CRUD and real-time observability
- Scheduling subsystem (`pg_cron` + fallback scheduler loop)
- Webhooks (inbound triggers + outbound delivery retries)

It is intended as a working baseline for Month 2 and should be tightened once production traffic data is available.

## Service-Level Objectives (Initial Baseline)

### API and Control Plane
- **SLO:** `99.5%` successful responses for core control APIs (`/api/agents`, `/api/tasks`, `/api/runs`, `/api/schedules`, `/api/webhooks`) over rolling 30 days.
- **SLI:** `2xx/3xx` responses ÷ total responses (excluding authenticated `4xx` that are expected by policy).
- **Error budget:** `0.5%` failure budget over 30 days.

### Scheduling
- **SLO:** `99.0%` of enabled schedule triggers enqueue a task successfully.
- **SLI:** successful schedule trigger count ÷ total due trigger attempts.
- **Latency SLO:** `p95` schedule trigger lag (`actual_trigger_time - expected_trigger_time`) < `60s`.

### Webhooks
- **SLO:** `98.0%` outbound webhook deliveries succeed within configured retry budget.
- **SLI:** delivered webhooks ÷ total delivery attempts finalized (delivered or exhausted).
- **Latency SLO:** `p95` time-to-delivery < `120s` for default retry policy.

## Alerting Baselines
- **P1:** Control-plane API success rate below `97%` for 10 minutes.
- **P1:** Scheduler loop stopped (`scheduler.running=false`) for > 2 minutes.
- **P1:** Outbound webhook pending backlog continuously increasing for > 15 minutes.
- **P2:** Webhook failed finalization rate > `10%` over 1 hour.
- **P2:** Schedule trigger lag `p95 > 120s` over 30 minutes.

## Runbooks

### Scheduler Not Triggering
1. Check `/ready` and `/api/system/ready` for `scheduler` and queue health.
2. Confirm schedule is `enabled` and `nextRunAt` is in the past.
3. Verify cron expression validity and timezone.
4. If `FEATURE_SCHEDULE_PG_CRON=true`, verify database function support for `upsert_workspace_schedule_job` and `pg_cron` availability.
5. Trigger manually via `POST /api/schedules/:id/trigger` and inspect task queue metrics.

### Webhook Deliveries Stuck Pending
1. Check `/ready` for webhook loop status.
2. Inspect webhook status, `attemptCount`, `nextAttemptAt`, and `error` fields.
3. Validate endpoint reachability and HTTP response codes.
4. Verify `WEBHOOK_SIGNING_SECRET` and any per-webhook `metadata.secret`.
5. Use `POST /api/webhooks/:id/test` to validate end-to-end dispatch.

### Inbound Webhook Trigger Failures
1. Verify `x-webhook-signature` matches expected HMAC for payload.
2. Confirm inbound webhook config exists for the event name (unless `ALLOW_UNREGISTERED_INBOUND_WEBHOOKS=true`).
3. Check payload shape includes `task.agentId` and `task.type` (or top-level equivalents).
4. Confirm referenced agent exists and workers are healthy.

## Operational Verification Checklist
- Build:
  - `cd server && npm run build`
  - `cd client && npm run build`
- Tests:
  - `cd server && npm test`
- Manual smoke checks:
  - Create schedule and trigger manually.
  - Create outbound webhook and run test dispatch.
  - Send signed inbound webhook and confirm task is queued.

## Notes on Fallback Behavior
- `pg_cron` registration is best effort and non-blocking.
- If `pg_cron` helpers are unavailable, fallback scheduler remains the source of execution continuity.
- Webhook retries use exponential backoff governed by:
  - `WEBHOOK_RETRY_BASE_SECONDS`
  - `WEBHOOK_RETRY_TICK_MS`
  - per-webhook `maxAttempts`
