# Grok CLI Runtime Contract

Canonical reference for running Repromptverse on Grok CLI (xAI). Used by Phase 3 Option F (spawn_subagent in-session orchestration and shell-level `grok -p` parallelism).

**Target:** Grok CLI 4.3+ (released April 2026 with stable `spawn_subagent`, `todo_write`, `ask_user_question`, headless `-p` mode, and sandbox profiles).

---

## `/goal` preflight with RePrompter

**Not supported on Grok CLI.**

Grok CLI does not expose a native `/goal` slash command, thread-level persistent objective, or equivalent to Codex `features.goals` or Claude Code CLI v2.1.139+ `/goal`.

Grok users must use:
- **Single mode** (Smart Interview → structured prompt), or
- **Repromptverse** (full team planning and execution via Option F)

The generated prompt can then be fed to a subsequent `grok -p "..."` call or pasted into any other runtime.

The Goal Command Card and `/goal <compressed summary>` compression flow are therefore disabled for Grok. The rest of the skill (Single, Repromptverse, Reverse) works identically.

---

## When to pick F1 (spawn_subagent) vs F2 (shell-level)

| Situation | Pick |
|-----------|------|
| Agents share high-level context via `fork_context`; one synthesis output expected | F1 |
| Need per-agent log files, model-compatible effort overrides, or named sessions (`-s`) | F2 |
| Orchestrating from CI / headless script outside an interactive Grok session | F2 |
| You want fresh context per worker without re-ingesting the full codebase | F1 |
| Running under heavy sandbox (`read-only` or `strict`) and want isolated workers | F1 (with `capability_mode="read-only"`) |
| Cross-agent messaging required mid-run | Neither — fall back to Option B (TeamCreate in Claude Code) or use parent-orchestrated file handoff |

---

## F1: Native subagents via `spawn_subagent` (in-session orchestration)

### Prerequisites

Subagents are enabled by default in Grok 4.3+.

Optional configuration in `~/.grok/config.toml`:

```toml
[subagents]
enabled = true
default_model = "grok-build"
max_depth = 2

[subagents.toggle]
explore = true
plan = true

[subagents.models]
explore = "grok-build"   # lighter model for research workers
```

### Recommended invocation for Repromptverse roles

Use the `spawn_subagent` tool (documented as `task` tool in the user guide) with these parameters:

```text
spawn_subagent(
  description="Repromptverse {role} worker for {taskname}",
  subagent_type="general-purpose",     # or "explore" / "plan"
  persona="implementer",               # or "researcher", "reviewer", custom
  fork_context=true,                   # CRITICAL: gives the worker the original user prompt + interviewContext
  capability_mode="execute",           # or "read-write" / "read-only"
  prompt="You are the {role} agent on the rpt-{taskname} team.

[PASTE THE FULL PHASE-2 REPROMTED XML PROMPT HERE]

Write your complete findings to the exact file /tmp/rpt-{taskname}-{role}.md
Use file:line citations for every claim.
Do not speculate. Finish by going idle after writing the artifact."
)
```

**Why these parameters:**
- `fork_context=true` — the subagent receives a copy of the parent's conversation history (the original rough prompt, Smart/Dimension Interview answers, team plan, etc.) without the orchestrator having to repeat everything in the prompt.
- `persona` — shapes tone and output style (implementer is pragmatic, researcher is thorough).
- `capability_mode` — restricts the worker (read-only for pure analysis agents is safest).

### Concurrency

Grok manages subagent concurrency via the TUI (Tasks pane with Ctrl+T) and config. Keep fan-out reasonable (4–6 agents) to avoid context and rate-limit pressure. Each subagent has an independent context window.

### Depth

Default depth limit prevents runaway nesting. Repromptverse orchestrators should stay at depth 1 (orchestrator spawns workers, workers do not spawn further subagents unless explicitly needed).

### Status Line during F1

The orchestrator uses `todo_write` for its own tracking + periodically runs `list_dir` or `run_command` with `ls /tmp/rpt-{taskname}-*.md` (excluding `.prompt.md` and `.stdout` files) to build the compact status line:

```
Agents: ✅ 3/5  ⏳ 1/5  🔄 1/5 (retry 1)
```

### Retries

Re-spawn only the failing agent with a delta prompt (Phase 4 of Repromptverse). Do not re-spawn the whole fleet.

### Known gotchas (Grok 4.3 as of May 2026)

- Subagents are fully independent sessions. There is no built-in `SendMessage` equivalent between them mid-run. All coordination must go through the parent orchestrator or shared artifact files in `/tmp`.
- `fork_context` copies history at spawn time. Later parent context is not automatically visible to already-running subagents.
- Sandbox profiles are inherited by subagents. If the parent was started with `--sandbox read-only`, workers cannot write `/tmp/rpt-*.md` unless the profile explicitly allows `/tmp`.
- `--effort` / `--reasoning-effort` are headless-only and model-dependent. Do not pass them to the default `grok-build` model unless you have verified support, because unsupported models reject the request before any worker starts.
- Tool allow-listing via `--tools` / `--disallowed-tools` in headless mode also affects subagent spawning (`Agent(explore)` syntax).
- `todo_write` calls made by a subagent are local to that subagent's session and not automatically visible in the parent's Tasks pane.
- When using custom personas or roles, the definition must exist in `~/.grok/personas/*.toml` or `~/.grok/roles/*.toml`, otherwise spawn fails (fail-closed).

---

## F2: Shell-level `grok -p` (external orchestration)

### Invocation (recommended pattern)

```bash
TASKNAME="audit-2026-05"
MODEL="grok-build"
AGENTS=(researcher implementer reviewer)

for role in "${AGENTS[@]}"; do
  grok -p "
You are the ${role} agent on the rpt-${TASKNAME} team.

[PASTE THE FULL PHASE-2 REPROMTED XML PROMPT FOR THIS ROLE]

Write your complete findings to the exact file /tmp/rpt-${TASKNAME}-${role}.md.
Use file:line citations. Do not speculate.
" \
    --yolo \
    --sandbox workspace \
    --model "$MODEL" \
    --output-format json \
    > "/tmp/rpt-${TASKNAME}-${role}.stdout" 2>&1 &
done

wait   # blocks until all backgrounded grok -p sessions finish
```

### Artifact contract (identical to all other runtimes)

- Path: `/tmp/rpt-{taskname}-{agent-role}.md`
- One writer per file.
- The orchestrator (or external script) must verify the artifact exists after `wait` returns.
- Exclude any `.prompt.md` or `.stdout` files when counting completed agents.

### Status Line (same logic as Codex D2)

```bash
done=0
for f in /tmp/rpt-${TASKNAME}-*.md; do
  [ -e "$f" ] || continue
  case "$f" in *.prompt.md|*.stdout) continue ;; esac
  done=$((done + 1))
done
echo "Agents: ✅ $done/${#AGENTS[@]}  ⏳ $((${#AGENTS[@]} - done))/${#AGENTS[@]}"
```

### Retries & failure handling

Re-run only the failing agent's `grok -p` command with a delta prompt. Inspect its `.stdout` for the error.

If `wait` hangs, `kill` the specific PID and retry that agent.

### Concurrency cap

Default to 4 or `sysctl -n hw.ncpu` (macOS) / `nproc` (Linux), whichever is lower. More than 4–5 concurrent Grok sessions against the same account can hit rate limits.

Use a FIFO semaphore exactly like the Codex D2 example in `codex-runtime.md` when you need a hard cap.

---

## What Grok CLI does NOT provide (as of 4.3)

- Native `TeamCreate` / `SendMessage` / `TeamDelete` team abstraction with cross-agent messaging inside a single session (use `spawn_subagent` + shared `/tmp` files + parent orchestration instead).
- A `/goal` slash command or persistent thread objective.
- A built-in `TaskList` that is automatically shared across `spawn_subagent` workers (derive status from artifact files or `todo_write` in the orchestrator only).
- Full hook matcher aliases for every Claude-style tool name (only `Bash`, `Read`, `Edit`, `Write`, `Grep` have automatic mapping; advanced names like `TeamCreate`, `Agent`, `SendMessage` require explicit translation in the Grok-specific instructions).
- Automatic cross-subagent communication primitives (subagents are independent sessions).

When any of the above are required, fall back to Option B (TeamCreate in Claude Code) or Option E (sequential).

---

## Sources

All accessed 2026-05-15:

- `~/.grok/docs/user-guide/08-skills.md`
- `~/.grok/docs/user-guide/04-slash-commands.md`
- `~/.grok/docs/user-guide/15-subagents.md`
- `~/.grok/docs/user-guide/13-headless-mode.md`
- `~/.grok/docs/user-guide/10-hooks.md`
- `~/.grok/docs/user-guide/17-sandbox.md`
- Phase 1 Architecture Design Doc (`/tmp/grok-cli-support-design.md`)
- Live Grok 4.3 tool surface and config system (April 2026 release)

---

**End of Grok CLI Runtime Contract**

This document is additive. It does not modify any behavior for users on Claude Code, Codex CLI, or OpenClaw.

**Auto-selection:** The central "Runtime auto-pick" decision tree in SKILL.md (Phase 3 Execute lane) now includes an explicit Order-1 check for the Grok tool surface. When `spawn_subagent` is present together with at least two of `run_command`, `todo_write`, `ask_user_question` in the current toolset, Repromptverse **automatically routes to Option F** (this contract) without any manual instruction. You only need to read this file the first time you see the Grok Support section activate in a Repromptverse run.
