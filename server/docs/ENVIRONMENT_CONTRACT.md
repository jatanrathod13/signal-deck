# Environment Variable Contract (Phase 6)

## Core Runtime
- `PORT`: HTTP server port (default `3001`)
- `REDIS_HOST`: Redis host (default `localhost`)
- `REDIS_PORT`: Redis port (default `6379`)
- `REDIS_PASSWORD`: Optional Redis password
- `REDIS_MAX_RETRIES_PER_REQUEST`: Optional `ioredis` retry count (`null` or non-negative integer, default `null`)
- `REDIS_ENABLE_OFFLINE_QUEUE`: Enable offline command queueing (`true|false`, default `false`)
- `REDIS_CONNECT_TIMEOUT_MS`: Redis connect timeout in milliseconds (default `10000`)
- `REDIS_RETRY_CAP_MS`: Retry backoff cap in milliseconds (default `2000`)
- `LOG_LEVEL`: `fatal|error|warn|info|debug|trace|silent` (default `info`)

## Supabase Persistence
- `FEATURE_SUPABASE_PERSISTENCE`: Enables Supabase persistence bridge for agent/task state (`true|false`)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SECRET_KEY`: Preferred server secret key for admin operations
- `SUPABASE_SERVICE_ROLE_KEY`: Legacy fallback key if `SUPABASE_SECRET_KEY` is not set
- `DEFAULT_WORKSPACE_ID`: Workspace UUID used by current persistence bridge
- `SUPABASE_READ_TIMEOUT_MS`: Supabase request timeout in milliseconds (default `10000`)

## Supabase AuthN/AuthZ
- `FEATURE_SUPABASE_AUTH`: Enables JWT verification + workspace membership checks (`true|false`)
- `SUPABASE_JWT_SECRET`: Optional HS256 verification secret (useful for local/testing)
- `ALLOW_SERVICE_ROLE_BYPASS`: Optional bypass for service tokens (`true|false`, default `false`)

## Model Provider/Tracing
- `OPENAI_API_KEY`: OpenAI provider key
- `AI_GATEWAY_API_KEY`: Optional AI gateway key
- `LANGSMITH_TRACING`: Enables tracing (`true|false`)
- `LANGSMITH_API_KEY`: Required when `LANGSMITH_TRACING=true`

## Phase 6 Integrations
- `FEATURE_MCP_SDK_CLIENT`: Enables MCP server tool loading (`true|false`)
- `FEATURE_IOT_INTEGRATIONS`: Enables IoT integration templates in system catalog (`true|false`)
- `FEATURE_PROVIDER_TOOLS`: Enables provider-native tool pathways (`true|false`)
- `FEATURE_EXTERNAL_AI_PROVIDERS`: Enables non-default provider catalogs (Anthropic/Google/local) (`true|false`)

## Queue Settings
- `TASK_JOB_ATTEMPTS`: BullMQ retries per job (default `1`)
- `TASK_JOB_BACKOFF_DELAY_MS`: Exponential backoff seed delay (default `1000`)
- `WORKER_CONCURRENCY`: Worker concurrency (default `10`)
- `WORKER_RATE_LIMIT`: Worker per-second limiter max (default `10`)

## Reliability Controls
- `FEATURE_HTTP_RATE_LIMIT`: Enables per-workspace/IP API rate limiting (`true|false`)
- `HTTP_RATE_LIMIT_WINDOW_MS`: Rate limiter rolling window in milliseconds (default `60000`)
- `HTTP_RATE_LIMIT_MAX_REQUESTS`: Max API requests allowed in each window per scope (default `120`)
- `FEATURE_CIRCUIT_BREAKERS`: Enables circuit breaker protection around unstable dependencies (`true|false`)
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD`: Failures before opening a circuit (default `3`)
- `CIRCUIT_BREAKER_RESET_TIMEOUT_MS`: Open-state cool-down before half-open probe (default `30000`)
- `CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS`: Max concurrent probe calls in half-open state (default `1`)
- `CIRCUIT_BREAKER_OPERATION_TIMEOUT_MS`: Timeout applied to guarded operations (default `20000`)
- `FEATURE_DEAD_LETTER_QUEUE`: Enables task dead-letter capture on worker failures (`true|false`)
- `DLQ_MAX_ENTRIES`: Max in-memory dead-letter entries before oldest eviction (default `500`)

## Advanced Orchestration
- `FEATURE_ADVANCED_DAG`: Enables `POST /api/plans/dag` DAG workflow endpoint (`true|false`)
- `FEATURE_DYNAMIC_AGENT_POOLS`: Enables load-aware `least_loaded` assignment strategy (`true|false`)

## Cache and Runtime Policy
- `CACHE_DEFAULT_TTL_MS`: Default in-memory cache TTL in milliseconds (default `5000`)
- `CACHE_MAX_ENTRIES`: Max cache entries before LRU-style eviction (default `500`)

## Quotas
- `FEATURE_QUOTA_ENFORCEMENT`: Enables workspace quota checks (`true|false`, default `true`)
- `QUOTA_MAX_TASKS_PER_HOUR`: Max submitted tasks per workspace per hour (default `500`)
- `QUOTA_MAX_RUNS_PER_DAY`: Max conversation runs per workspace per day (default `200`)
- `QUOTA_USE_REDIS`: Use Redis counters instead of in-memory counters for quota windows (`true|false`, default `false`)

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
