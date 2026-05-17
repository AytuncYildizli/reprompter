#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

"$SCRIPT_DIR/package-hermes-skill.sh"

if ! git -C "$REPO_DIR" diff --exit-code -- skills/reprompter; then
  echo "ERROR: Generated Hermes package differs from committed files." >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_DIR" status --porcelain -- skills/reprompter)" ]]; then
  echo "ERROR: Generated Hermes package has untracked or unstaged files:" >&2
  git -C "$REPO_DIR" status --short -- skills/reprompter >&2
  exit 1
fi
