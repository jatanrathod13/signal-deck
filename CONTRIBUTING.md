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

`main` is protected. Direct pushes/commits to `main` are not allowed.

1. Create a focused branch from `main` (recommend prefix `codex/` or `feature/`).
2. Open a Pull Request to `main`.
3. Keep scope small and tied to one outcome.
4. Include tests for behavior changes.
5. Update docs when API or workflow behavior changes.
6. In PR description include:
   - Problem
   - Approach
   - Validation
   - Risks / rollback notes
7. Wait for required review approval before merge.

## Protected main workflow

The repository enforces:

1. Pull request required for `main`
2. At least 1 approving review
3. Last push must be approved
4. Conversation resolution required
5. No force push or branch deletion on `main`

If you have admin access, do not bypass protections except for urgent incident recovery.

## Code standards

Follow repository coding standards, including:

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
