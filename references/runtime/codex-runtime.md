# Codex CLI Runtime Contract

Canonical reference for running Repromptverse on OpenAI Codex CLI. Used by Phase 3 Option D (D1 native subagents and D2 shell-level parallelism).

**Target:** Codex CLI 0.121.0+ (`multi_agent` feature flag stabilized in 0.115.0 on 2026-03-16; default-enabled in current releases).

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
claim. Do not speculate. Finish by going idle; the orchestrator reads
the artifact file, not a tool call.
"""
# Optional: mcp_servers, nickname_candidates
```

**On `report_agent_job_result`:** This tool is registered for `spawn_agents_on_csv` batch workers (one worker per CSV row), not for ordinary prompt-spawned `spawn_agent` subagents. Do not instruct a standard D1 worker to call it — the tool may not be available in that role's tool set. If you need CSV fan-out, define a separate CSV-worker role whose `developer_instructions` includes the `report_agent_job_result` call; see OpenAI Codex subagents docs for the `spawn_agents_on_csv` contract.

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

`[agents] max_threads` caps open agent threads. Normal `spawn_agent` calls past the cap fail with an `AgentLimitReached` error — they do **not** queue (source: `reserve_spawn_slot` in openai/codex 0.121.0). Keep the orchestrator's fan-out size ≤ `max_threads`. For true fan-out that normalizes requested concurrency against the cap, use `spawn_agents_on_csv` instead.

### Depth

`max_depth = 1` means subagents cannot spawn sub-subagents. Raising depth is possible but token cost compounds quadratically. No documented ceiling.

### Known gotchas (as of 0.121.0)

- **Issue #14866** — subagents could get stuck in "awaiting instruction" when model routing misfired. Closed with a linked fix; if you still see it, kill and respawn the stuck worker.
- **Issue #15177** — still open as of 2026-04-18. A custom-role `model` override (e.g., `gpt-5.4-mini`) can leak back to the parent model (`gpt-5.4`) in child metadata. Prefer the built-in `default` role, or accept the leak, when model fidelity matters.
- Each subagent consumes tokens independently — plan budget accordingly.

---

## D2: Shell-level `codex exec` (external orchestration)

### Invocation

```bash
# Default D2 worker. --sandbox workspace-write is required whenever the
# worker writes its own artifact file; /tmp is writable under this mode.
# Use --sandbox read-only only for pure analysis workers that capture
# findings via --output-last-message instead of writing the .md artifact
# themselves.
codex exec \
  --ephemeral \
  --sandbox workspace-write \
  --model "$MODEL" \
  --output-last-message "$LOG" \
  -C "$REPO" \
  "$PROMPT_TEXT"
```

- `--ephemeral` is recommended for parallel runs so backgrounded workers do not write rollout files that could be restored into each other (historical reference: closed issue #11435, which motivated the flag). Not strictly required on current Codex, but still the safe default for isolated fan-out.
- `--sandbox workspace-write` permits writes to the workspace and `/tmp`, which workers need to produce `/tmp/rpt-{taskname}-{agent}.md` artifacts. In `codex exec` (headless) mode, `--sandbox workspace-write` and `--full-auto` are functionally equivalent — `--full-auto` is documented in Codex 0.121.0 (`codex-rs/exec/src/cli.rs`) as "Convenience alias for low-friction sandboxed automatic execution (--sandbox workspace-write)", and exec hardcodes `approval_policy = AskForApproval::Never` (`codex-rs/exec/src/lib.rs`) regardless of which flag selected the sandbox. Pick whichever reads cleaner in your scripts. The interactive Codex TUI uses a different approval default, so the `--full-auto` vs `--sandbox` distinction matters there but not in `codex exec`.
- `--sandbox read-only` is safe only for pure-analysis workers that do not write artifact files. In that case, use `--output-last-message "$ARTIFACT.md"` to capture the final message directly to the artifact path (the CLI writes the file, not the sandboxed agent).
- `codex exec` defaults approval policy to `never` in headless mode, so you do not need an explicit `-a` flag for backgrounded workers. The global `approval_policy` in `config.toml` applies to the interactive TUI.
- `--output-last-message` captures the final assistant turn; useful as a fallback artifact when the agent did not write its own file.
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
    --sandbox workspace-write \
    --model "$MODEL" \
    --output-last-message "/tmp/rpt-${TASKNAME}-${agent}.log" \
    "$(cat /tmp/rpt-${TASKNAME}-${agent}.prompt.md)" \
    > "/tmp/rpt-${TASKNAME}-${agent}.stdout" 2>&1 &
done

wait  # blocks until all backgrounded sessions finish
# Verify each agent wrote its artifact (exclude .prompt.md inputs).
ls /tmp/rpt-${TASKNAME}-*.md 2>/dev/null | grep -v '\.prompt\.md$'
```

### Concurrency cap

Default to 4 or the CPU count, whichever is lower. On Linux use `nproc`; on macOS use `sysctl -n hw.ncpu`. More than 4 concurrent Codex sessions against the same account can hit rate limits.

For a hard cap, use a FIFO semaphore. The `trap` inside the subshell returns the token even when `codex exec` exits non-zero under `set -e`, preventing deadlock:

```bash
MAX_PARALLEL=4
sem=$(mktemp -u)
mkfifo "$sem"
exec 9<>"$sem"
rm "$sem"
for _ in $(seq 1 "$MAX_PARALLEL"); do echo >&9; done

pids=()
for agent in "${AGENTS[@]}"; do
  read -u 9
  (
    trap 'echo >&9' EXIT
    codex exec --ephemeral --sandbox workspace-write --model "$MODEL" \
      "$(cat "/tmp/rpt-${TASKNAME}-${agent}.prompt.md")" \
      > "/tmp/rpt-${TASKNAME}-${agent}.stdout" 2>&1
  ) &
  pids+=("$!")
done

# Wait on explicit PIDs so a failing worker surfaces instead of being
# hidden by `wait` without args. The D2 retry contract requires failure
# visibility at this layer so the caller can retry individual agents.
status=0
for pid in "${pids[@]}"; do
  wait "$pid" || status=1
done
exec 9>&-
# Fail fast so downstream Phase 4 synthesis does not run on missing or
# stale agent artifacts. Use `return` instead of `exit` if this block
# lives inside a function.
exit "$status"
```

### Status Line

Codex CLI has no built-in TaskList. Derive status from artifact presence. **Exclude `.prompt.md` input files** — they share the `rpt-${TASKNAME}-*.md` glob with artifacts, and counting them falsely reports "done" before any agent has written output:

```bash
# Zero-match-safe, POSIX-compatible loop. Safe under `set -euo pipefail`
# even when no artifacts exist yet or only .prompt.md inputs are present
# (both cases would abort an `ls | grep | wc` pipeline: ls exits 2 on no
# match; grep exits 1 on no output). Also runs in dash (/bin/sh).
done=0
for f in /tmp/rpt-${TASKNAME}-*.md; do
  [ -e "$f" ] || continue             # glob returned the literal pattern
  case "$f" in *.prompt.md) continue ;; esac
  done=$((done + 1))
done
total=${#AGENTS[@]}
echo "Agents: ✅ $done/$total  ⏳ $((total-done))/$total"
```

Why a loop instead of `find`: on macOS `/tmp` is a symlink to `/private/tmp`, and `find /tmp -maxdepth 1` does not descend through the symlink without `-L`. Shell glob expansion resolves the path transparently and works on both Linux and macOS without a flag.

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
