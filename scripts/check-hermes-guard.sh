#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PACKAGE_DIR="$REPO_DIR/skills/reprompter"
PINNED_HERMES_COMMIT="1345dda0c"
PINNED_HERMES_VERSION="v0.14.0 (2026.5.16)"
DEFAULT_HERMES_DIR="$REPO_DIR/.cache/hermes-agent-$PINNED_HERMES_COMMIT"
HERMES_DIR="${HERMES_AGENT_DIR:-$DEFAULT_HERMES_DIR}"

validate_hermes_checkout() {
  if [[ ! -f "$HERMES_DIR/tools/skills_guard.py" ]]; then
    echo "ERROR: Hermes checkout missing tools/skills_guard.py: $HERMES_DIR" >&2
    exit 1
  fi

  actual_commit="$(git -C "$HERMES_DIR" rev-parse --verify HEAD 2>/dev/null || true)"
  if [[ -z "$actual_commit" ]]; then
    echo "ERROR: Hermes checkout is not a git checkout: $HERMES_DIR" >&2
    exit 1
  fi

  case "$actual_commit" in
    "$PINNED_HERMES_COMMIT"*) ;;
    *)
      echo "ERROR: Hermes checkout is $actual_commit, expected $PINNED_HERMES_COMMIT ($PINNED_HERMES_VERSION)" >&2
      exit 1
      ;;
  esac
}

if [[ ! -d "$PACKAGE_DIR" ]]; then
  echo "ERROR: Hermes package not found: $PACKAGE_DIR" >&2
  echo "Run scripts/package-hermes-skill.sh first." >&2
  exit 1
fi

if [[ -z "${HERMES_AGENT_DIR:-}" && ! -f "$HERMES_DIR/tools/skills_guard.py" ]]; then
  mkdir -p "$(dirname "$HERMES_DIR")"
  tmp_dir="$DEFAULT_HERMES_DIR.tmp"
  rm -rf "$tmp_dir"
  git clone --filter=blob:none https://github.com/NousResearch/hermes-agent.git "$tmp_dir"
  git -C "$tmp_dir" checkout "$PINNED_HERMES_COMMIT"
  rm -rf "$DEFAULT_HERMES_DIR"
  mv "$tmp_dir" "$DEFAULT_HERMES_DIR"
fi

validate_hermes_checkout

echo "Using Hermes Guard $PINNED_HERMES_VERSION ($PINNED_HERMES_COMMIT)"
echo "Hermes source: $HERMES_DIR"

PYTHONPATH="$HERMES_DIR" python3 - "$PACKAGE_DIR" <<'PY'
from pathlib import Path
import sys

from tools.skills_guard import scan_skill, format_scan_report

package = Path(sys.argv[1])
result = scan_skill(package, source="AytuncYildizli/reprompter")
print(format_scan_report(result))
if result.verdict != "safe":
    raise SystemExit(1)
PY
