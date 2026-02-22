# Prioritized Roadmap - Filling the Gaps

> Generated: 2026-02-22
> Based on platform capability analysis

---

## Vision

Transform this platform from a solid agent orchestration foundation into a **production-ready, universally applicable AI agent platform** that can power any use case—from IoT/Arduino control to enterprise automation.

---

## Priority 1: Critical for Production (Month 1)

### 1.1 Persistence Layer (Supabase)
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Add Supabase | Set up Supabase project + TypeScript client | Easy | 1 day |
| Database Schema | Create tables for agents, tasks, plans, runs | Easy | 2 days |
| Agent Config Storage | Save agent configurations to DB | Easy | 1 day |
| Task History | Persist task execution history | Easy | 1 day |

**Why:** Supabase provides PostgreSQL + built-in Auth, Realtime, and auto-generated REST/GraphQL APIs. Eliminates need for separate auth implementation.

### 1.2 Authentication & Authorization (Supabase Auth)
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Supabase Auth Integration | Use Supabase Auth (email, OAuth, SSO) | Easy | 1 day |
| Role-Based Access | Implement admin/user roles via RLS policies | Easy | 1 day |
| API Key Management | Generate API keys via Supabaseanon/ service roles | Easy | 0.5 day |

**Why:** Supabase provides built-in auth with email/password, OAuth (Google, GitHub, etc.), and row-level security. No need to build JWT auth from scratch.

### 1.3 Health Checks & Observability
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Health Endpoints | `/health`, `/ready` for K8s | Easy | 0.5 day |
| Metrics Export | Prometheus-compatible metrics | Easy | 1 day |
| Structured Logging | JSON logs with correlation IDs | Easy | 1 day |

**Why:** Required for container orchestration and monitoring.

---

## Priority 2: Essential for Usability (Month 2)

### 2.1 Web Dashboard
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Agent Management UI | Create/Edit/Delete agents | Medium | 3 days |
| Task Monitoring UI | Real-time task status dashboard | Medium | 2 days |
| Execution Logs UI | View agent stdout/stderr | Easy | 1 day |
| Settings Page | Configure flags, env vars | Easy | 1 day |

**Why:** Users need a visual interface to manage agents.

### 2.2 Task Scheduling
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Cron Integration | Run tasks on schedule | Medium | 2 days |
| Recurring Tasks | Repeat tasks on interval | Medium | 2 days |
| Calendar View | Visualize scheduled tasks | Easy | 1 day |

**Why:** Many use cases require scheduled automation.

### 2.3 Webhooks & Events
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Webhook Triggers | Start agents via HTTP POST | Easy | 1 day |
| Webhook Notifications | Call URLs on task completion | Easy | 1 day |
| Event Bus | Internal event system for extensibility | Medium | 2 days |

**Why:** Need to integrate with external systems.

---

## Priority 3: Enterprise Features (Month 3)

### 3.1 Multi-Tenancy (Supabase Organizations)
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Supabase Organizations | Use Supabase orgs for workspace isolation | Easy | 1 day |
| Workspace RBAC | Per-workspace permissions via RLS | Medium | 2 days |
| Usage Quotas | Limit resources per workspace | Medium | 2 days |

**Why:** Supabase Organizations provides built-in multi-tenancy with isolated billing and RBAC.

### 3.2 Advanced Governance
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Approval Workflows | Multi-level approval chains | Medium | 2 days |
| Audit Logging | Track all actions for compliance | Medium | 2 days |
| Policy Engine | Complex rule-based governance | Hard | 5 days |

**Why:** Regulated industries need compliance.

### 3.3 Caching & Performance
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Redis Caching | Cache MCP tool schemas | Easy | 1 day |
| Response Caching | Cache repeated LLM responses | Medium | 2 days |
| Connection Pooling | Optimize DB/Redis connections | Easy | 1 day |

**Why:** Performance at scale.

---

## Priority 4: Universal Integrations (Month 4)

### 4.1 IoT/Arduino Support
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Arduino MCP Template | Pre-configured MCP for Arduino | Easy | 1 day |
| Johnny-Five Integration | CLI mode for hardware control | Easy | 2 days |
| ESP32 Support | WiFi-enabled device control | Medium | 3 days |
| Home Assistant MCP | Smart home integration | Medium | 3 days |

**Why:** Unlock physical world control.

### 4.2 More MCP Servers
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Filesystem MCP | Advanced file operations | Easy | 0.5 day |
| GitHub MCP | Issues, PRs, actions | Easy | 1 day |
| Database MCP | Query Supabase/Postgres via MCP | Easy | 1 day |
| Browser MCP | Playwright automation | Medium | 2 days |

**Why:** More tools = more use cases.

### 4.3 External AI Providers
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Anthropic Support | Claude models via Supabase Edge Functions | Easy | 1 day |
| Google AI | Gemini models via Supabase Edge Functions | Easy | 1 day |
| Local Models | Ollama/LM Studio integration | Medium | 2 days |

**Why:** Vendor flexibility. Use Supabase Edge Functions as the AI gateway layer.

---

## Priority 5: Polish & Scale (Month 5+)

### 5.1 Developer Experience
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| CLI Tool | Manage agents from terminal | Medium | 3 days |
| SDK/Client Library | TypeScript client for integrations | Medium | 3 days |
| Documentation | Auto-generated API docs | Easy | 2 days |

### 5.2 Reliability
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| Circuit Breakers | Prevent cascade failures | Medium | 2 days |
| Dead Letter Queue | Handle failed tasks gracefully | Easy | 1 day |
| Rate Limiting | Per-user/IP rate limits | Easy | 1 day |

### 5.3 Advanced Orchestration
| Task | Description | Difficulty | Effort |
|------|-------------|------------|--------|
| DAG Workflows | Complex dependency graphs | Hard | 5 days |
| Dynamic Agent Pools | Auto-scale agents based on load | Hard | 5 days |
| Agent Marketplace | Share/import agent templates | Medium | 3 days |

---

## Quick Win: Immediate Impact Tasks

These can be done in the first week:

1. **Add health endpoints** - 0.5 day
2. **Add structured logging** - 1 day
3. **Add Prometheus metrics** - 1 day
4. **Add API key auth** - 1 day
5. **Document environment variables** - 0.5 day
6. **Add Docker support** - 1 day

---

## Dependency Map

```
Priority 1 (Critical)
├── 1.1 Persistence Layer
│   └── Required for: Everything
├── 1.2 Authentication
│   └── Required for: Priority 2+
└── 1.3 Health Checks
    └── Required for: Priority 2+

Priority 2 (Usability)
├── 2.1 Web Dashboard
│   └── Required for: Enterprise sales
├── 2.2 Task Scheduling
│   └── Independent
└── 2.3 Webhooks
    └── Required for: Priority 3

Priority 3 (Enterprise)
├── 3.1 Multi-tenancy
│   └── Required for: Priority 5
├── 3.2 Governance
│   └── Independent
└── 3.3 Caching
    └── Required for: Scale

Priority 4 (Integrations)
├── 4.1 IoT Support
│   └── Independent
├── 4.2 More MCP
│   └── Independent
└── 4.3 More AI Providers
    └── Independent

Priority 5 (Polish)
└── All independent
```

---

## Effort Estimate Summary

| Priority | Total Effort | Timeline |
|----------|--------------|----------|
| P1: Critical | ~10 days | Month 1 |
| P2: Essential | ~15 days | Month 2 |
| P3: Enterprise | ~12 days | Month 3 |
| P4: Integrations | ~20 days | Month 4 |
| P5: Polish | ~20 days | Month 5+ |

**Total: ~77 days (~3.5 months) to production-ready**

> **Note:** Using Supabase instead of raw PostgreSQL saves ~4 days by eliminating:
> - Building JWT authentication from scratch
> - Implementing email/password reset flows
> - Setting up OAuth integrations
> - Building row-level security policies
>
> Supabase provides: PostgreSQL DB + Auth + Realtime subscriptions + Auto-generated APIs + Edge Functions

---

## Recommendations

### Start Here (Week 1)
1. Dockerize the application
2. Add health endpoints
3. Add basic authentication

### Then This (Month 1)
1. Add Supabase (PostgreSQL + Auth + Realtime)
2. Set up Supabase Auth
3. Add structured logging

### Then Scale (Month 2+)
1. Web dashboard
2. Task scheduling
3. IoT integrations
