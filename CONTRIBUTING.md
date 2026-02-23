# Contributing to Signal Deck

Thanks for helping build Signal Deck.

## Contribution focus

Signal Deck is execution-first. Prioritize contributions that improve:

1. Objective-to-outcome reliability
2. Run observability and diagnostics
3. Governance and safety controls
4. Open-source onboarding and developer experience

## Local setup

## Server

```bash
cd server
npm install
npm run dev
```

## Client

```bash
cd client
npm install
npm run dev
```

## Quality checks

```bash
cd server && npm run build
cd server && npm test
cd client && npm run build
cd client && npm run lint
```

## Branching and pull requests

1. Create a focused branch from `main`.
2. Keep scope small and tied to one outcome.
3. Include tests for behavior changes.
4. Update docs when API or workflow behavior changes.
5. In PR description include:
   - Problem
   - Approach
   - Validation
   - Risks / rollback notes

## Code standards

Follow repository guidance in `AGENTS.md`, including:

1. TypeScript strictness and naming conventions
2. Route/service patterns
3. Test location and style
4. Error handling conventions

## Good first contribution areas

1. Improve run intelligence visualizations and diagnostics
2. Add integration tests for objective-to-plan-to-completion flows
3. Improve docs around setup, feature flags, and production rollout
4. Add developer tooling for sample orchestration scenarios

## Reporting issues

When opening an issue, include:

1. Expected behavior
2. Actual behavior
3. Reproduction steps
4. Logs or API response snippets
5. Environment details (local/staging, flags, keys configured)

## Docs discipline

If behavior changes, update at least one of:

1. `README.md`
2. `ROADMAP.md`
3. `docs/PRODUCT_DIRECTION.md`
4. `docs/ARCHITECTURE.md`

## GitHub labels and benchmark setup

If label taxonomy is missing on a fresh repo clone:

```bash
./scripts/github/sync-labels.sh
```

To create the initial benchmark objective issue set:

```bash
./scripts/github/create-benchmark-issues.sh
```

To create and pin the benchmark tracker issue:

```bash
./scripts/github/create-pinned-tracker-issue.sh
```
