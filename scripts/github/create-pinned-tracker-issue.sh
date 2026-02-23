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
BODY_FILE="docs/community/PINNED_ISSUE_DRAFT.md"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required"
  exit 1
fi

if [[ -z "${REPO}" ]]; then
  echo "Unable to determine repository slug. Pass it explicitly:"
  echo "./scripts/github/create-pinned-tracker-issue.sh owner/repo"
  exit 1
fi

if [[ ! -f "${BODY_FILE}" ]]; then
  echo "Missing ${BODY_FILE}"
  exit 1
fi

if ! gh repo view "${REPO}" >/dev/null 2>&1; then
  echo "Repository '${REPO}' is not accessible via current gh auth."
  echo "Pass a valid slug explicitly: ./scripts/github/create-pinned-tracker-issue.sh owner/repo"
  exit 1
fi

ISSUE_URL="$(
  gh issue create --repo "${REPO}" \
    --title "Signal Deck Public Benchmark Tracker (v1)" \
    --label "type:benchmark" --label "status:ready" --label "phase-1" \
    --body-file "${BODY_FILE}"
)"

echo "Created tracker issue: ${ISSUE_URL}"

ISSUE_ID="$(gh issue view "${ISSUE_URL}" --json id -q '.id')"

if gh api graphql -f query='mutation($issueId:ID!){ pinIssue(input:{issueId:$issueId}) { issue { number url } } }' -f issueId="${ISSUE_ID}" >/dev/null 2>&1; then
  echo "Pinned tracker issue successfully."
else
  echo "Issue created but automatic pin failed. Pin manually in GitHub UI."
fi

