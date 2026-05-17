#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PACKAGE_DIR="$REPO_DIR/skills/reprompter"
PINNED_HERMES_COMMIT="1345dda0c"
PINNED_HERMES_VERSION="v0.14.0 (2026.5.16)"
DEFAULT_HERMES_DIR="$REPO_DIR/.cache/hermes-agent-$PINNED_HERMES_COMMIT"
HERMES_DIR="${HERMES_AGENT_DIR:-$DEFAULT_HERMES_DIR}"

if [[ ! -d "$PACKAGE_DIR" ]]; then
  echo "ERROR: Hermes package not found: $PACKAGE_DIR" >&2
  echo "Run scripts/package-hermes-skill.sh first." >&2
  exit 1
fi

if [[ ! -f "$HERMES_DIR/tools/skills_guard.py" ]]; then
  mkdir -p "$(dirname "$HERMES_DIR")"
  tmp_dir="$HERMES_DIR.tmp"
  rm -rf "$tmp_dir"
  git clone --filter=blob:none https://github.com/NousResearch/hermes-agent.git "$tmp_dir"
  git -C "$tmp_dir" checkout "$PINNED_HERMES_COMMIT"
  rm -rf "$HERMES_DIR"
  mv "$tmp_dir" "$HERMES_DIR"
fi

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
