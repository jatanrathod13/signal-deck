#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/new-worktree.sh <feature-name> [base-branch]

Creates a sibling git worktree on branch codex/<feature-name>.

Examples:
  scripts/new-worktree.sh feature-x
  scripts/new-worktree.sh feature-x develop
  scripts/new-worktree.sh codex/feature-x
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

feature="${1:-}"
base_branch="${2:-main}"

if [[ -z "$feature" ]]; then
  usage
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
repo_name="$(basename "$repo_root")"

if [[ "$feature" == codex/* ]]; then
  branch="$feature"
  raw_feature="${feature#codex/}"
else
  raw_feature="$feature"
  branch="codex/$feature"
fi

slug="$(printf '%s' "$raw_feature" | tr '/ ' '--' | tr -cd '[:alnum:]_.-')"
if [[ -z "$slug" ]]; then
  echo "Error: feature name produced an empty worktree path slug."
  exit 1
fi

worktree_path="$(dirname "$repo_root")/${repo_name}-${slug}"
if [[ -e "$worktree_path" ]]; then
  i=2
  while [[ -e "${worktree_path}-${i}" ]]; do
    i=$((i + 1))
  done
  worktree_path="${worktree_path}-${i}"
fi

if git -C "$repo_root" show-ref --verify --quiet "refs/heads/$branch"; then
  git -C "$repo_root" worktree add "$worktree_path" "$branch"
else
  git -C "$repo_root" worktree add -b "$branch" "$worktree_path" "$base_branch"
fi

cat <<EOF
Created worktree:
  Path:   $worktree_path
  Branch: $branch

Next:
  cd "$worktree_path"
EOF
