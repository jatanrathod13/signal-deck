# Phase 6 CLI/SDK Guide

## CLI
Run from `server/`:

```bash
npm run cli -- help
npm run cli -- health
npm run cli -- readiness-review
npm run cli -- submit-task --agent <agentId> --type <taskType> --prompt "Hello"
```

Optional env vars:
- `ORCHESTRATOR_BASE_URL` (default `http://localhost:3001`)
- `ORCHESTRATOR_WORKSPACE_ID`
- `ORCHESTRATOR_API_KEY`

## SDK
Import the SDK client:

```ts
import { OrchestrationClient } from './src/sdk';

const client = new OrchestrationClient({
  baseUrl: 'http://localhost:3001',
  workspaceId: 'workspace-default'
});

await client.getHealth();
await client.submitTask({
  agentId: 'agent-1',
  type: 'chat',
  data: { prompt: 'Summarize this' }
});
```

## API Docs
- OpenAPI JSON: `GET /api/system/openapi.json`
- Production readiness review: `GET /api/system/readiness/review`
- Integrations catalog: `GET /api/system/integrations`
- Dead letter queue: `GET /api/system/dlq`
