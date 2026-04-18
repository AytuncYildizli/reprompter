# Codex CLI Runtime Contract

Canonical reference for running Repromptverse on OpenAI Codex CLI. Used by Phase 3 Option D (D1 native subagents and D2 shell-level parallelism).

**Target:** Codex CLI 0.121.0+ (native subagents shipped 2026-03-16).

---

## When to pick D1 (native subagents) vs D2 (shell-level)

| Situation | Pick |
|---|---|
| Agents share context; one synthesis output expected | D1 |
| Need per-agent log files or model/profile overrides | D2 |
| Orchestrating from CI or shell script outside Codex | D2 |
| You want fresh context per worker without re-ingesting the codebase | D1 |
| Codex < 0.121.0 or `multi_agent` feature disabled | D2 |
| Cross-agent messaging required mid-run | Neither — use Option B (TeamCreate in Claude Code) |

---

## D1: Native subagents (in-session orchestration)

### Prerequisites

```toml
# ~/.codex/config.toml
[features]
multi_agent = true

[agents]
max_threads = 6               # concurrent workers (hard cap)
max_depth = 1                 # no sub-subagents by default
job_max_runtime_seconds = 1800
```

### Define a Repromptverse role once

```toml
# ~/.codex/agents/rpt_audit_explorer.toml
name = "rpt_audit_explorer"
description = "Read-only exploration for Repromptverse audit fan-out."
model = "gpt-5.4"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
developer_instructions = """
You are one of N parallel audit workers. Write your findings to the
artifact path specified by the orchestrator. Cite file:line for every
claim. Do not speculate. Call report_agent_job_result exactly once
before going idle.
"""
# Optional: mcp_servers, nickname_candidates
```

### Invocation (prompt-driven)

Subagents in Codex are spawned in natural language from the orchestrator prompt, not via a flag. Example:

```
Spawn one rpt_audit_explorer subagent per audit dimension
(methodology, code, stats, narrative, attack-surface, claims).
Each subagent writes to /tmp/rpt-{taskname}-{dimension}.md.
After all six complete, read their artifacts and synthesize
the final report to /tmp/rpt-{taskname}-final.md.
```

### Concurrency

`[agents] max_threads` is enforced by the Codex runtime — no FIFO semaphore needed. Submitting 8 workers with `max_threads = 6` queues 2 and runs 6 concurrently.

### Depth

`max_depth = 1` means subagents cannot spawn sub-subagents. Raising depth is possible but token cost compounds quadratically. No documented ceiling.

### Known gotchas (as of 0.121.0)

- **Issue #14866** — subagents can get stuck in "awaiting instruction" if model routing misfires. Kill and respawn the stuck worker; do not wait indefinitely.
- **Issue #15177** — `model = "gpt-5.4-mini"` overrides may leak back to `gpt-5.4` in child metadata. Fixed in 0.122.0-alpha.
- Each subagent consumes tokens independently — plan budget accordingly.

---

## D2: Shell-level `codex exec` (external orchestration)

### Invocation

```bash
codex exec \
  --ephemeral \
  --full-auto \
  --sandbox read-only \
  --model "$MODEL" \
  --output-last-message "$LOG" \
  -C "$REPO" \
  "$PROMPT_TEXT"
```

- `--ephemeral` is **required** for parallel runs. Without it, issue #11435 can corrupt sessions via shared session-restore state.
- `--full-auto` is required so the session runs without interactive approval prompts (blocking bg workers).
- `--output-last-message` captures the final assistant turn; useful when an artifact is missing post-mortem.
- `--sandbox read-only` is the right default for audits. Bump to `workspace-write` only if you want fixes applied.
- `$PROMPT_TEXT` is the full reprompted prompt from Phase 2. Pass via `"$(cat ...)"`; do not pipe via stdin (Codex treats stdin as a conversation continuation in some modes).

### Artifact contract (shared with `repromptverse-template.md`)

- One writer per file.
- Path: `/tmp/rpt-{taskname}-{agent}.md`.
- Missing artifact after `wait` returns → retry that agent only.

### Parallelism pattern

```bash
#!/usr/bin/env bash
set -euo pipefail

MODEL="gpt-5.4"
TASKNAME="audit-2026-04"
AGENTS=(methodology code stats narrative attack-surface claims)

for agent in "${AGENTS[@]}"; do
  codex exec \
    --ephemeral \
    --full-auto \
    --sandbox read-only \
    --model "$MODEL" \
    --output-last-message "/tmp/rpt-${TASKNAME}-${agent}.log" \
    "$(cat /tmp/rpt-${TASKNAME}-${agent}.prompt.md)" \
    > "/tmp/rpt-${TASKNAME}-${agent}.stdout" 2>&1 &
done

wait  # blocks until all backgrounded sessions finish
ls -la /tmp/rpt-${TASKNAME}-*.md
```

### Concurrency cap

Default to 4 or `nproc`, whichever is lower. More than 4 concurrent Codex sessions against the same account can hit rate limits.

For a hard cap, use a FIFO semaphore:

```bash
MAX_PARALLEL=4
sem=$(mktemp -u)
mkfifo "$sem"
exec 9<>"$sem"
rm "$sem"
for _ in $(seq 1 "$MAX_PARALLEL"); do echo >&9; done

for agent in "${AGENTS[@]}"; do
  read -u 9
  (
    codex exec --ephemeral --full-auto --model "$MODEL" \
      "$(cat "/tmp/rpt-${TASKNAME}-${agent}.prompt.md")" \
      > "/tmp/rpt-${TASKNAME}-${agent}.stdout" 2>&1
    echo >&9
  ) &
done
wait
```

### Status Line

Codex CLI has no built-in TaskList. Derive status from artifact presence:

```bash
done=$(ls /tmp/rpt-${TASKNAME}-*.md 2>/dev/null | wc -l)
total=${#AGENTS[@]}
echo "Agents: ✅ $done/$total  ⏳ $((total-done))/$total"
```

### Retries

Re-run `codex exec` for the failing agent with the delta prompt (see SKILL.md Phase 4). Do NOT re-run the whole fleet.

### If `wait` hangs

One agent stalled. Inspect `/tmp/rpt-${TASKNAME}-*.stdout` for the stuck session, kill that PID, retry just that agent.

---

## What Codex CLI does NOT provide (as of 0.121.0)

- No `TaskList` equivalent → use filesystem polling (D2) or rely on native subagent join (D1).
- No cross-agent messaging mid-run → if agents need to talk, use Option B (TeamCreate in Claude Code) instead.
- No built-in retry → Phase 4 drives retries with fresh `codex exec` calls or subagent respawns.
- No per-file tool-call interception (Claude Code's `PreToolUse`/`PostToolUse` has no Codex equivalent as of 0.121.0).

---

## Sources

All accessed 2026-04-18:

- [Codex Subagents — OpenAI Developers](https://developers.openai.com/codex/subagents)
- [Codex CLI overview — OpenAI Developers](https://developers.openai.com/codex/cli)
- [Codex Advanced Configuration — OpenAI Developers](https://developers.openai.com/codex/config-advanced)
- [openai/codex releases](https://github.com/openai/codex/releases) — v0.121.0 dated 2026-04-15
- [Issue #11435 — multiple parallel codex exec instances interfere via shared session restore](https://github.com/openai/codex/issues/11435)
- [Issue #14866 — subagent stuck in awaiting-instruction](https://github.com/openai/codex/issues/14866)
- [Issue #15177 — subagent model override metadata leak](https://github.com/openai/codex/issues/15177)
