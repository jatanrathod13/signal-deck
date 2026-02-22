# AGENTS.md

Guidelines for AI agents working in this Agent Orchestration Platform repository.

## Project Overview

This is an Agent Orchestration Platform with:
- **Client**: React + TypeScript + Vite + Tailwind CSS + Zustand + TanStack Query
- **Server**: Express + TypeScript + Socket.IO + BullMQ + Redis
- **Agents Workflow**: Support for both sequential and parallel team orchestration, integrating Vercel AI SDK and local Claude CLI tools via Model Context Protocol (MCP).

## Build/Lint/Test Commands

### Client (`cd client`)
```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Type check + build for production
npm run lint         # ESLint check
npm run preview      # Preview production build
```

### Server (`cd server`)
```bash
npm run dev          # Start with ts-node (port 3001)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled JS from dist/
npm test             # Run all Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Running Single Tests
```bash
# Server - run specific test file
cd server && npx jest tests/agentService.test.ts

# Server - run specific test by pattern
cd server && npx jest -t "should create agent"

# Server - run tests matching pattern
cd server && npx jest --testNamePattern="deployAgent"
```

## Code Style Guidelines

### TypeScript
- **Strict mode enabled** - no implicit any
- Use explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use `unknown` over `any` when type is uncertain

### Naming Conventions
- **Files**: PascalCase for components (`AgentCard.tsx`), camelCase for utilities (`useAgents.ts`)
- **Components**: PascalCase (`AgentCard`, `Dashboard`)
- **Hooks**: camelCase starting with `use` (`useAgents`, `useSocket`)
- **Functions**: camelCase (`deployAgent`, `submitTask`)
- **Types/Interfaces**: PascalCase (`Agent`, `TaskStatus`)
- **Constants**: UPPER_SNAKE_CASE for true constants

### Imports (Client)
Order: React → External libs → Absolute `@/*` → Relative imports
```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { AgentCard } from './AgentCard';
```

### Imports (Server)
Order: Node built-ins → External libs → Absolute `@/*` → Relative imports
```typescript
import { EventEmitter } from 'events';
import express from 'express';
import { Agent } from '@/types';
import { emitAgentStatus } from './socketService';
```

### React Patterns
- Use functional components with hooks
- Use Zustand for global state (see `stores/agentStore.ts`)
- Use TanStack Query for server state (`useAgents.ts` pattern)
- Use `cn()` utility for conditional Tailwind classes

### Error Handling
- **Server**: Throw descriptive errors; handle in Express middleware
- **Client**: Use try/catch in async handlers; log errors to console
- **Tests**: Use `expect().toThrow()` for error cases

### Comments
- File header JSDoc with description
- Function JSDoc for exported functions with `@param` and `@returns`
- Inline comments only for complex logic

### Testing
- Tests located in `server/tests/`
- Use `beforeEach` to reset singleton state
- Mock external dependencies (Redis, Socket.IO)
- Test files: `*.test.ts` pattern

### Key Technologies
- **Client**: React 18, Zustand 5, TanStack Query 5, Socket.IO client, Tailwind CSS 3
- **Server**: Express 4, Socket.IO 4, BullMQ 5, Redis (ioredis), Zod 4, Vercel AI SDK, MCP SDK, LangSmith for tracing
- **Build**: Vite (client), tsc (server), Jest + ts-jest (testing)

### File Structure
```
client/src/
  components/     # React components
  hooks/          # Custom hooks (TanStack Query)
  stores/         # Zustand stores
  lib/            # Utilities, API clients
  types/          # TypeScript types

server/src/
  services/       # Business logic (Execution modes: ToolLoop, ClaudeCLI, Orchestration, Tracing, MCP)
  routes/         # Express routes (Agents, Tasks, Plans, Executions)
  
server/tests/     # Jest tests
server/types/     # Shared TypeScript types
server/worker/    # BullMQ Task / Flow workers
```

### Environment Variables
- Client: Vite uses `import.meta.env.VITE_*`
- Server: `process.env.*` with dotenv
- Key vars: `PORT`, `REDIS_HOST`, `REDIS_PORT`
