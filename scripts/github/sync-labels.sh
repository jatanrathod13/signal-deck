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
  echo "./scripts/github/sync-labels.sh owner/repo"
  exit 1
fi

if ! gh repo view "${REPO}" >/dev/null 2>&1; then
  echo "Repository '${REPO}' is not accessible via current gh auth."
  echo "Pass a valid slug explicitly: ./scripts/github/sync-labels.sh owner/repo"
  exit 1
fi

create_or_update_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  if gh label list --repo "${REPO}" --limit 200 | awk '{print $1}' | grep -Fxq "${name}"; then
    gh label edit "${name}" --repo "${REPO}" --color "${color}" --description "${description}" >/dev/null
    echo "updated ${name}"
  else
    gh label create "${name}" --repo "${REPO}" --color "${color}" --description "${description}" >/dev/null
    echo "created ${name}"
  fi
}

create_or_update_label "phase-1" "1d76db" "Phase 1 roadmap work (objective-to-outcome reliability)"
create_or_update_label "phase-2" "0e8a16" "Phase 2 roadmap work (trust and human control)"
create_or_update_label "phase-3" "fbca04" "Phase 3 roadmap work (production data plane hardening)"
create_or_update_label "phase-4" "d4c5f9" "Phase 4 roadmap work (open-source extensibility)"
create_or_update_label "phase-5" "5319e7" "Phase 5 roadmap work (scale and operations)"
create_or_update_label "phase-unassigned" "bfdadc" "Phase not yet triaged"

create_or_update_label "type:bug" "d73a4a" "Something is broken"
create_or_update_label "type:feature" "a2eeef" "New feature request"
create_or_update_label "type:task" "c2e0c6" "Implementation task"
create_or_update_label "type:docs" "0075ca" "Documentation work"
create_or_update_label "type:benchmark" "f9d0c4" "Benchmark objective definition or execution"

create_or_update_label "status:triage" "fef2c0" "Needs triage"
create_or_update_label "status:ready" "c5def5" "Ready for implementation"
create_or_update_label "status:in-progress" "0e8a16" "Actively being worked"
create_or_update_label "status:blocked" "b60205" "Blocked by dependency/decision"
create_or_update_label "status:needs-feedback" "ffa500" "Requires maintainer/community feedback"
create_or_update_label "status:done" "5319e7" "Implemented and validated"

create_or_update_label "priority:P0" "b60205" "Critical and urgent"
create_or_update_label "priority:P1" "d93f0b" "High priority"
create_or_update_label "priority:P2" "fbca04" "Medium priority"
create_or_update_label "priority:P3" "c2e0c6" "Low priority"

create_or_update_label "area:runtime" "0366d6" "Core runtime and task lifecycle"
create_or_update_label "area:orchestrator" "0052cc" "Plan/orchestration services and APIs"
create_or_update_label "area:execution" "1d76db" "Execution service, model routing, tool runtime"
create_or_update_label "area:data-plane" "0e8a16" "Persistence, Supabase, storage, tenancy"
create_or_update_label "area:governance" "5319e7" "Approvals, policy, audit, compliance"
create_or_update_label "area:reliability" "d93f0b" "Rate limits, circuit breakers, DLQ, readiness"
create_or_update_label "area:ui" "c2e0c6" "Client UX, observability surfaces, workflows"
create_or_update_label "area:dx" "7057ff" "SDK, CLI, contributor/developer experience"
create_or_update_label "area:docs" "0075ca" "Documentation and guides"

create_or_update_label "good-first-issue" "7057ff" "Good first contribution"
create_or_update_label "help-wanted" "008672" "Community contributions encouraged"

echo "Labels synced for ${REPO}"
