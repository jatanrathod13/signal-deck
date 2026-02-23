#!/usr/bin/env bash
set -euo pipefail

resolve_repo() {
  if [[ $# -gt 0 && -n "$1" ]]; then
    echo "$1"
    return 0
  fi

  local remote_url
  remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
  if [[ -z "${remote_url}" ]]; then
    return 1
  fi

  if [[ "${remote_url}" =~ ^https://github.com/([^/]+)/([^/.]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    return 0
  fi

  if [[ "${remote_url}" =~ ^git@github.com:([^/]+)/([^/.]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    return 0
  fi

  return 1
}

REPO="$(resolve_repo "${1:-}" || true)"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required"
  exit 1
fi

if [[ -z "${REPO}" ]]; then
  echo "Unable to determine repository slug. Pass it explicitly:"
  echo "./scripts/github/create-benchmark-issues.sh owner/repo"
  exit 1
fi

if ! gh repo view "${REPO}" >/dev/null 2>&1; then
  echo "Repository '${REPO}' is not accessible via current gh auth."
  echo "Pass a valid slug explicitly: ./scripts/github/create-benchmark-issues.sh owner/repo"
  exit 1
fi

echo "Creating benchmark issues in ${REPO}"

gh issue create --repo "${REPO}" \
  --title "Benchmark: Objective 01 - Deterministic Planning Path" \
  --label "type:benchmark" --label "phase-1" --label "area:orchestrator" --label "priority:P0" \
  --body "Track deterministic planning consistency for objective runs. See docs/community/BENCHMARK_OBJECTIVES.md."

gh issue create --repo "${REPO}" \
  --title "Benchmark: Objective 02 - Orchestration Failure Explainability" \
  --label "type:benchmark" --label "phase-1" --label "area:reliability" --label "priority:P0" \
  --body "Track failure-path explainability and actionable diagnostics. See docs/community/BENCHMARK_OBJECTIVES.md."

gh issue create --repo "${REPO}" \
  --title "Benchmark: Objective 03 - Governance Gate Roundtrip" \
  --label "type:benchmark" --label "phase-2" --label "area:governance" --label "priority:P1" \
  --body "Track approval pause/resume correctness for gated actions. See docs/community/BENCHMARK_OBJECTIVES.md."

gh issue create --repo "${REPO}" \
  --title "Benchmark: Objective 04 - End-to-End DAG Reliability" \
  --label "type:benchmark" --label "phase-1" --label "area:orchestrator" --label "priority:P1" \
  --body "Track dependency correctness and terminal-state consistency for DAG runs. See docs/community/BENCHMARK_OBJECTIVES.md."

gh issue create --repo "${REPO}" \
  --title "Benchmark: Objective 05 - Readiness and Policy Signal Accuracy" \
  --label "type:benchmark" --label "phase-2" --label "area:reliability" --label "priority:P1" \
  --body "Track readiness-review truthfulness across flag/dependency states. See docs/community/BENCHMARK_OBJECTIVES.md."

gh issue create --repo "${REPO}" \
  --title "Benchmark: Objective 06 - Data Durability Smoke (Supabase Path)" \
  --label "type:benchmark" --label "phase-3" --label "area:data-plane" --label "priority:P1" \
  --body "Track restart-safe state continuity with Supabase persistence path enabled. See docs/community/BENCHMARK_OBJECTIVES.md."

gh issue create --repo "${REPO}" \
  --title "Benchmark: Objective 07 - Operator UX Triage Time" \
  --label "type:benchmark" --label "phase-2" --label "area:ui" --label "priority:P2" \
  --body "Track time-to-diagnose for failed runs from observability surfaces. See docs/community/BENCHMARK_OBJECTIVES.md."

echo "Done. Next: create and pin the tracker issue using docs/community/PINNED_ISSUE_DRAFT.md"
