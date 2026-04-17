#!/usr/bin/env bash
# Validate SKILL.md and reference templates for obsolete tool signatures.
#
# Each check below is a regex that should NOT match in any skill-side
# file. Each matched line is a regression — either a pre-2.1 Claude Code
# tool shape that opus 4.7 rejects at the runtime schema layer, or a
# foreign-product reference that doesn't belong in a reprompter surface.
#
# Exit 0 = clean, exit 1 = drift detected. Designed to slot next to
# scripts/validate-templates.sh in the validation toolchain.
#
# When you need to add a new check:
#   1. Add a `check "<human-name>" '<regex>' $TARGETS...` line below.
#   2. Cross-reference the PR that introduced or fixed the pattern so the
#      rationale doesn't rot.
#   3. Run this script against a known-bad fixture to confirm the regex
#      matches only what you intend.

set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FAIL=0

check() {
  local name="$1"; shift
  local pattern="$1"; shift
  # Remaining positional args are paths/globs to scan.
  local hits
  hits="$(grep -rn -E "$pattern" "$@" 2>/dev/null || true)"
  if [ -n "$hits" ]; then
    echo "FAIL: $name"
    echo "$hits" | sed 's/^/  /'
    echo ""
    FAIL=1
  fi
}

SKILL_FILE="SKILL.md"
REFERENCES_DIR="references"
SCRIPTS_DIR="scripts"

echo "Validating tool references in $SKILL_FILE and $REFERENCES_DIR/ ..."
echo ""

# --- Obsolete spawn signature (pre-2.1 Task tool) ------------------------
# Claude Code 2.1 split the legacy Task spawn tool into Agent() (spawn)
# plus TaskCreate/TaskUpdate/TaskList (todos). Old shape silently fails
# under opus 4.7.  Fixed: PR #23.
check "Obsolete Task(subagent_type=...) spawn — use Agent(...) instead (PR #23)" \
  'Task\(subagent_type=' \
  "$SKILL_FILE" "$REFERENCES_DIR"

# --- Pre-2.1 SendMessage keyword arguments -------------------------------
# Current signature is SendMessage(to=<name>, message=<str-or-obj>).
# `type=<...>` or `recipient=<...>` as top-level kwargs are the pre-2.1
# shape and get rejected.  Fixed: PR #25.
check "Pre-2.1 SendMessage(type=/recipient=) keyword arguments (PR #25)" \
  'SendMessage\([^)]*(\btype=|\brecipient=)' \
  "$SKILL_FILE" "$REFERENCES_DIR"

# --- Broadcast with structured payload -----------------------------------
# SendMessage(to="*", ...) only accepts plain strings. Structured bodies
# like {"type": "shutdown_request"} are rejected on broadcast and must be
# sent per-agent.  Fixed: PR #27.
check "Broadcast SendMessage with structured payload (PR #27)" \
  'SendMessage\(to="\*"[^)]*message=\{' \
  "$SKILL_FILE" "$REFERENCES_DIR"

# --- Foreign MCP references ----------------------------------------------
# Claude Flow is a third-party MCP orchestrator, not a reprompter
# surface. Mentioning it in a reprompter template points users at the
# wrong runtime.  Fixed: PR #26.
check "Claude Flow / mcp__claude-flow__ references (PR #26)" \
  'Claude[ -]Flow|mcp__claude-flow__' \
  "$SKILL_FILE" "$REFERENCES_DIR"

# --- Hardcoded old model version strings ---------------------------------
# Scripts and templates should use the 'opus'/'sonnet'/'haiku' aliases
# so the CLI resolves to the current latest. Hardcoded 4-0..4-6 strings
# will silently pin users to older releases.
check "Hardcoded pre-4.7 model version strings (use aliases instead)" \
  'claude-(opus-4-[0-6]|sonnet-4-[0-5]|haiku-4-[0-4])\b' \
  "$SKILL_FILE" "$REFERENCES_DIR" "$SCRIPTS_DIR"

if [ "$FAIL" = "0" ]; then
  echo "OK: no tool-reference drift detected."
  exit 0
else
  echo "FAIL: drift detected. Fix the matches above."
  exit 1
fi
