#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

"$SCRIPT_DIR/package-plugin.sh"

if ! git -C "$REPO_DIR" diff --exit-code -- plugin .claude-plugin/marketplace.json; then
  echo "ERROR: Generated Claude Code plugin package differs from committed files." >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_DIR" status --porcelain -- plugin .claude-plugin/marketplace.json)" ]]; then
  echo "ERROR: Generated Claude Code plugin package has untracked or unstaged files:" >&2
  git -C "$REPO_DIR" status --short -- plugin .claude-plugin/marketplace.json >&2
  exit 1
fi
