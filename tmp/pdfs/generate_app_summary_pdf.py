from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib import colors

output_path = 'output/pdf/agent-orchestration-app-summary.pdf'

doc = SimpleDocTemplate(
    output_path,
    pagesize=letter,
    leftMargin=40,
    rightMargin=40,
    topMargin=36,
    bottomMargin=36,
)

styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name='TitleCustom',
    parent=styles['Title'],
    fontName='Helvetica-Bold',
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#111827'),
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name='SectionHeader',
    parent=styles['Heading2'],
    fontName='Helvetica-Bold',
    fontSize=11,
    leading=14,
    textColor=colors.HexColor('#111827'),
    spaceBefore=6,
    spaceAfter=3,
))
styles.add(ParagraphStyle(
    name='BodySmall',
    parent=styles['BodyText'],
    fontName='Helvetica',
    fontSize=9,
    leading=12,
    textColor=colors.HexColor('#1f2937'),
    spaceAfter=2,
))
styles.add(ParagraphStyle(
    name='BulletSmall',
    parent=styles['BodyText'],
    fontName='Helvetica',
    fontSize=8.8,
    leading=11.5,
    textColor=colors.HexColor('#1f2937'),
))
styles.add(ParagraphStyle(
    name='MonoSmall',
    parent=styles['BodyText'],
    fontName='Courier',
    fontSize=8.2,
    leading=10.5,
    textColor=colors.HexColor('#111827'),
))

story = []

story.append(Paragraph('Agent Orchestration Platform - One-Page App Summary', styles['TitleCustom']))
story.append(Paragraph('Source basis: repository code in client/ and server/, plus AGENTS.md.', styles['BodySmall']))

story.append(Paragraph('What it is', styles['SectionHeader']))
story.append(Paragraph(
    'A full-stack TypeScript application for deploying agents, submitting and tracking tasks, and coordinating multi-step plans with real-time updates. '
    'The client uses React + TanStack Query + Zustand, while the server uses Express + Socket.IO + BullMQ + Redis plus AI SDK execution services.',
    styles['BodySmall']
))

story.append(Paragraph('Who it\'s for', styles['SectionHeader']))
story.append(Paragraph(
    'Primary persona: Not found in repo. Inferred from routes/components and service names: developers or operator teams managing AI agent lifecycles and queued orchestration tasks.',
    styles['BodySmall']
))

story.append(Paragraph('What it does', styles['SectionHeader']))
feature_items = [
    'Deploy, list, start, stop, restart, and delete agents via REST (`/api/agents`) with Redis-backed persistence and Socket.IO status events.',
    'Submit, filter, retry, cancel, and inspect task graphs (`/api/tasks`), including parent/child links, dependencies, and idempotency keys.',
    'Process queued jobs through BullMQ workers with status transitions (`pending`, `blocked`, `processing`, `completed`, `failed`, `cancelled`) and completion/failure handling.',
    'Run agent tasks through AI SDK ToolLoopAgent + OpenAI model selection, tool-policy governance, memory tools, MCP tool loading, and optional trace metadata.',
    'Create orchestration plans (`/api/plans`) from step prompts; automatically enqueue ready steps and advance/fail plan status as tasks finish.',
    'Manage shared memory (`/api/memory`) with key/value CRUD and TTL plus tiered namespaces (`working`, `episodic`, `shared`).',
    'Expose metrics snapshots (`/api/metrics`) for submitted/completed/failed tasks, tool calls/failures, and plan progress.',
]

story.append(ListFlowable([
    ListItem(Paragraph(item, styles['BulletSmall']), leftIndent=6) for item in feature_items
], bulletType='bullet', start='circle', leftIndent=14, bulletFontName='Helvetica', bulletFontSize=7.5, spaceAfter=2))

story.append(Paragraph('How it works (repo-evidenced architecture)', styles['SectionHeader']))
arch_items = [
    'Frontend: `client/src/App.tsx` initializes `useSocket()` and wraps `Dashboard` in React Query provider. Dashboard tabs render `AgentDeploy`, `AgentList`, `TaskQueue`, and `MemoryPanel`.',
    'API client layer: `client/src/lib/api.ts` calls REST endpoints for agents/tasks/plans/memory/metrics and provides SSE streaming helper for agent execution.',
    'Server entry: `server/src/index.ts` wires Express routes, health check, global error handler, and Socket.IO server; boots persistence stores and starts worker.',
    'Core services: `agentService`, `taskQueueService`, `planService`, `orchestratorService`, `executionService`, `sharedMemoryService`, `metricsService`, and `socketService`.',
    'Data flow: UI action -> REST route -> service -> Redis/BullMQ persistence -> worker executes task (AI/tool loop) -> service updates status/metrics -> Socket.IO emits realtime updates -> UI state refreshes.',
    'Auth model: Not found in repo (no enforced API auth in route wiring).',
]
story.append(ListFlowable([
    ListItem(Paragraph(item, styles['BulletSmall']), leftIndent=6) for item in arch_items
], bulletType='bullet', start='circle', leftIndent=14, bulletFontName='Helvetica', bulletFontSize=7.5, spaceAfter=2))

story.append(Paragraph('How to run (minimal getting started)', styles['SectionHeader']))
run_lines = [
    '1. Start Redis locally (`localhost:6379`) or set `REDIS_HOST` / `REDIS_PORT`.',
    '2. Install dependencies: in `client/` run `npm install`; in `server/` run `npm install`.',
    '3. Start server: `cd server && npm run dev` (default port 3001).',
    '4. Start client: `cd client && npm run dev` (Vite port 3000, proxies `/api` and `/socket.io` to 3001).',
    '5. Open the client URL shown by Vite (typically `http://localhost:3000`).',
    '6. Environment template file (`.env.example`): Not found in repo.',
]
for line in run_lines:
    story.append(Paragraph(line, styles['MonoSmall']))

story.append(Spacer(1, 4))
story.append(Paragraph('Generated on repository evidence only; unspecified product/ops details are marked as Not found in repo.', styles['BodySmall']))

doc.build(story)
print(output_path)
