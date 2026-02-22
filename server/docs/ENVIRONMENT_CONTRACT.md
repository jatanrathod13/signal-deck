# Environment Variable Contract (Phase 4)

## Core Runtime
- `PORT`: HTTP server port (default `3001`)
- `REDIS_HOST`: Redis host (default `localhost`)
- `REDIS_PORT`: Redis port (default `6379`)
- `REDIS_PASSWORD`: Optional Redis password
- `LOG_LEVEL`: `fatal|error|warn|info|debug|trace|silent` (default `info`)

## Supabase Persistence
- `FEATURE_SUPABASE_PERSISTENCE`: Enables Supabase persistence bridge for agent/task state (`true|false`)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SECRET_KEY`: Preferred server secret key for admin operations
- `SUPABASE_SERVICE_ROLE_KEY`: Legacy fallback key if `SUPABASE_SECRET_KEY` is not set
- `DEFAULT_WORKSPACE_ID`: Workspace UUID used by current persistence bridge

## Supabase AuthN/AuthZ
- `FEATURE_SUPABASE_AUTH`: Enables JWT verification + workspace membership checks (`true|false`)
- `SUPABASE_JWT_SECRET`: Optional HS256 verification secret (useful for local/testing)
- `ALLOW_SERVICE_ROLE_BYPASS`: Optional bypass for service tokens (`true|false`, default `false`)

## Model Provider/Tracing
- `OPENAI_API_KEY`: OpenAI provider key
- `AI_GATEWAY_API_KEY`: Optional AI gateway key
- `LANGSMITH_TRACING`: Enables tracing (`true|false`)
- `LANGSMITH_API_KEY`: Required when `LANGSMITH_TRACING=true`

## Queue Settings
- `TASK_JOB_ATTEMPTS`: BullMQ retries per job (default `1`)
- `TASK_JOB_BACKOFF_DELAY_MS`: Exponential backoff seed delay (default `1000`)

## Scheduler
- `SCHEDULER_TICK_MS`: Fallback scheduler polling interval in milliseconds (default `10000`)
- `FEATURE_SCHEDULE_PG_CRON`: Enables best-effort `pg_cron` job registration (`true|false`, default `true`)
- `SUPABASE_DEFAULT_USER_ID`: Optional user id stamped on schedule records created by server-side automation

## Webhooks
- `WEBHOOK_RETRY_TICK_MS`: Retry loop polling interval in milliseconds (default `5000`)
- `WEBHOOK_RETRY_BASE_SECONDS`: Exponential retry base delay in seconds (default `30`)
- `WEBHOOK_REQUEST_TIMEOUT_MS`: Outbound webhook HTTP timeout in milliseconds (default `10000`)
- `WEBHOOK_SIGNING_SECRET`: Global HMAC secret used for webhook signing/verification when per-webhook secret is not set
- `ALLOW_UNREGISTERED_INBOUND_WEBHOOKS`: Allows inbound triggers even without registered inbound webhook definitions (`true|false`, default `false`)
