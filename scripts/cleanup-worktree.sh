#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/cleanup-worktree.sh <feature-name> [main-branch]

Merges codex/<feature-name> into the main branch, removes its worktree, and
deletes the codex branch.

Examples:
  scripts/cleanup-worktree.sh feature-x
  scripts/cleanup-worktree.sh codex/feature-x
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

feature="${1:-}"
main_branch="${2:-main}"

if [[ -z "$feature" ]]; then
  usage
  exit 1
fi

if [[ "$feature" == codex/* ]]; then
  branch="$feature"
else
  branch="codex/$feature"
fi

repo_root="$(git rev-parse --show-toplevel)"

if ! git -C "$repo_root" show-ref --verify --quiet "refs/heads/$branch"; then
  echo "Error: branch '$branch' does not exist."
  exit 1
fi

if ! git -C "$repo_root" diff --quiet || ! git -C "$repo_root" diff --cached --quiet; then
  echo "Error: local changes detected in $repo_root. Commit/stash before cleanup."
  exit 1
fi

if ! git -C "$repo_root" show-ref --verify --quiet "refs/heads/$main_branch"; then
  echo "Error: main branch '$main_branch' does not exist."
  exit 1
fi

git -C "$repo_root" checkout "$main_branch" >/dev/null
if git -C "$repo_root" rev-parse --abbrev-ref --symbolic-full-name "${main_branch}@{upstream}" >/dev/null 2>&1; then
  git -C "$repo_root" pull --ff-only
fi

ahead_count="$(git -C "$repo_root" rev-list --count "${main_branch}..${branch}")"
if [[ "$ahead_count" -gt 0 ]]; then
  git -C "$repo_root" merge --no-ff "$branch" -m "merge: $branch into $main_branch"
else
  echo "No commits to merge from $branch into $main_branch. Continuing cleanup."
fi

worktree_path="$(
  git -C "$repo_root" worktree list --porcelain | awk -v target="refs/heads/$branch" '
    $1 == "worktree" { wt = $2 }
    $1 == "branch" && $2 == target { print wt; exit }
  '
)"

if [[ -n "${worktree_path:-}" && -d "$worktree_path" ]]; then
  git -C "$repo_root" worktree remove "$worktree_path"
fi

git -C "$repo_root" branch -d "$branch"

cat <<EOF
Merged and cleaned up:
  Main branch: $main_branch
  Removed branch: $branch
  Removed worktree: ${worktree_path:-not found}
EOF
