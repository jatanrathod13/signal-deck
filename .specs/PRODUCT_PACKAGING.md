# Product Packaging & Launch Readiness Guide

## Positioning
**Agent Orchestration Platform — Team AI Ops for Research + Execution**

A unified platform for deploying, orchestrating, and governing AI agents across team workflows. Built for teams that need structured reasoning, auditable tool usage, and deep research capabilities with enterprise-grade controls.

## Key Features

### 1. Deep Research Mode
- Multi-phase research pipeline: discover → extract → cross-check → synthesize
- Parallel subagent orchestration with source artifacts and confidence scoring
- Citation mapping with verifiable sources
- Configurable research depth: quick, standard, deep

### 2. Dynamic Model Routing
- Per-step model selection based on task complexity, tool requirements, and budget
- Heuristic task classification (simple, general, tool_heavy, complex)
- Route decision logging for full observability
- Configurable routing policies per agent

### 3. Evaluator Loop
- Automated quality scoring against configurable criteria (completeness, accuracy, relevance, coherence)
- Auto-revision with feedback-driven improvement attempts
- Threshold-based pass/fail with detailed feedback
- Evaluation results included in run artifacts

### 4. Governance & Approval Gates
- Tool-level approval checkpoints for risky actions
- Pending/approved/denied/timed_out lifecycle management
- Auto-timeout with configurable durations
- Real-time approval request and resolution via API

### 5. Run Intelligence
- Automatic phase grouping from raw run events
- Bottleneck identification (longest phase analysis)
- Tool failure summaries with error counts and last-error details
- Route decision timeline visibility
- Total duration and per-phase metrics

### 6. Enhanced Tracing & Cost Visibility
- Expanded model pricing database (GPT-4o, o1, o3-mini, Claude 3 variants)
- Per-tool latency breakdown
- Per-tool cost accumulation
- Tool call detail timeline

### 7. Feature Flag Rollout System
Seven independent feature flags for staged rollout:
- `FEATURE_DEEP_RESEARCH` — Deep research orchestration
- `FEATURE_MCP_SDK_CLIENT` — MCP SDK client migration
- `FEATURE_PROVIDER_TOOLS` — Provider-native tools exposure
- `FEATURE_EVALUATOR_LOOP` — Output evaluation loop
- `FEATURE_APPROVAL_GATES` — Governance approval gates
- `FEATURE_RUN_INTELLIGENCE_UI` — Run intelligence timeline UI
- `FEATURE_RESUMABLE_STREAM_TRANSPORT` — Resumable stream transport

## Rollout Plan

### Phase 1: Internal Dark Launch
- All flags `false` by default
- Teams enable via environment variables
- Monitoring for regressions in existing flows

### Phase 2: Team-Only Beta
- Enable `FEATURE_EVALUATOR_LOOP` and `FEATURE_RUN_INTELLIGENCE_UI`
- Collect feedback on evaluation thresholds
- Tune model routing parameters

### Phase 3: Default-On for New Agents
- `FEATURE_DEEP_RESEARCH`, `FEATURE_PROVIDER_TOOLS` enabled by default
- New agent templates include governance policies
- Documentation updated for new defaults

### Phase 4: Progressive Enable for Existing Agents
- Gradual enablement with rollback capability
- Per-agent override support
- SLO monitoring dashboards in place

## Admin Defaults & Templates

### Default Evaluation Policy
```json
{
  "enabled": true,
  "minScoreThreshold": 0.5,
  "maxRevisionAttempts": 2,
  "criteria": ["completeness", "accuracy", "relevance", "coherence"]
}
```

### Default Governance Policy
```json
{
  "enabled": false,
  "autoApproveTimeout": 60000,
  "requireApprovalTools": [],
  "notifyOnApproval": true
}
```

### Default Model Routing
```json
{
  "defaultModel": "gpt-4o-mini",
  "complexityThreshold": 0.6,
  "budgetModel": "gpt-4o-mini",
  "toolRequiredModel": "gpt-4o"
}
```

### Default Research Config
```json
{
  "depth": "standard",
  "parallelism": 3,
  "requireCitations": true,
  "maxSources": 10
}
```

## SLO Definitions

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Run completion rate | > 95% | < 90% |
| Mean run latency | < 30s | > 60s |
| Evaluator pass rate | > 80% | < 60% |
| Approval resolution time | < 60s | > 120s |
| Tool error rate | < 5% | > 10% |
| Deep research source quality | > 0.6 confidence | < 0.4 |

## Quick Adoption Guide

1. **Deploy an agent** via POST /api/agents with desired config
2. **Create a conversation** via POST /api/conversations
3. **Send messages** with optional `executionProfile` and `research` config
4. **Monitor runs** via GET /api/runs/:id/intelligence
5. **Review artifacts** via GET /api/runs/:id/artifacts
6. **Manage approvals** via POST /api/runs/:id/approvals/:approvalId

## API Contract Summary

### New Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/runs/:runId/intelligence | Grouped phase timeline with insights |
| GET | /api/runs/:runId/artifacts | Sources, evaluator scorecard, approvals |
| POST | /api/runs/:runId/approvals/:approvalId | Approve/deny pending checkpoints |

### Extended Request Schema
```typescript
// POST /api/conversations/:id/messages
{
  content: string;
  executionProfile?: 'standard' | 'deep_research';
  research?: {
    depth: 'quick' | 'standard' | 'deep';
    parallelism?: number;
    requireCitations?: boolean;
    maxSources?: number;
  };
}
```

### New Run Event Types
- `research.finding` — Research finding with confidence
- `research.source` — Discovered source
- `model.route.selected` — Model routing decision
- `evaluation.completed` — Evaluation result
- `approval.requested` — Governance gate triggered
- `approval.resolved` — Approval decision made
- `stream.resumed` — Stream reconnected
