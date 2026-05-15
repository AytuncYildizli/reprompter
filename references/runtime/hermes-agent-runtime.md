# Hermes Agent Runtime Contract

Canonical reference for running RePrompter on Nous Research Hermes Agent. Used by the `/goal` preflight lane and Phase 3 Option G (G1 `delegate_task`, G2 shell-level Hermes, G3 Kanban).

**Target:** Hermes Agent v0.13.0 / 2026.5.7 or later for `/goal` and Kanban-era behavior.

---

## `/goal` preflight with RePrompter

Hermes Agent exposes a persistent `/goal <objective>` command. Use RePrompter as the intent preflight step before setting that goal.

1. Ask RePrompter to improve the rough goal.
2. RePrompter infers the user's intent and builds the expanded prompt first.
3. RePrompter compresses that expanded prompt into a dense one-line `/goal <summary of expanded prompt>` command.
4. Review the Goal Command Card for the exact command, risk, missing inputs, verification, and expanded prompt basis.
5. Run the generated command in Hermes.
6. Optionally send the expanded prompt basis as the next normal message after the goal is set.

Example:

```text
reprompt this for Hermes /goal: ship a safe checkout migration with tests and rollback
```

Then in Hermes:

```text
/goal Ship a safe checkout migration by mapping current checkout flows, identifying rollback boundaries, preserving payment/session/order behavior, implementing the smallest compatible changes, adding regression coverage for critical checkout paths, and proving rollback plus compatibility through unit, integration, and checkout smoke checks.
```

Required Goal Command Card shape:

| Field | Content |
|---|---|
| Goal Command | Exact one-line `/goal <summary of expanded prompt>` command |
| Compressed From | `Expanded RePrompter prompt` |
| Objective | One sentence naming the reprompted intent Hermes should pursue |
| Runtime | `Hermes Agent` |
| Mode | `/goal preflight` |
| Paste Into | Hermes TUI prompt, as-is |
| Risk Level | `low` / `medium` / `high` |
| Missing Inputs | Up to 3 unknowns, or `none` |
| Verification | 2-4 checks the later goal should run |
| Quality | Before score -> after score, with the weakest remaining dimension |

Operational notes:

- `/goal <text>` sets a standing objective across turns.
- Hermes checks progress after each turn and may continue until the objective is complete, paused/cleared, or the budget is exhausted.
- Useful controls: `/goal status`, `/goal pause`, `/goal resume`, and `/goal clear`.
- Goal state survives `/resume`.
- User messages preempt the continuation loop.
- Default continuation budget is documented as 20 turns (`goals.max_turns`).
- RePrompter does not intercept slash commands; the user still pastes/runs the generated `/goal` command.

Optional tuning:

```toml
[goals]
max_turns = 20
```

---

## When to pick G1, G2, or G3

| Situation | Pick |
|---|---|
| Normal in-session Repromptverse fan-out; parent needs child summaries before synthesis | G1 `delegate_task` |
| Need per-agent stdout/stderr logs, shell scripts, CI/headless orchestration, or strict external artifact verification | G2 shell-level Hermes |
| Work must survive restarts, span multiple profiles, wait for humans, or remain visible as a durable board | G3 Kanban |
| Agents must message each other continuously during execution | G3 Kanban, or use Option B in Claude Code if native cross-agent messaging is required |
| No Hermes parallel tools are visible | Option E sequential |

Default to **G1** unless the user explicitly asks for durable Kanban or shell-level orchestration.

---

## G1: Native delegation via `delegate_task`

### Critical context rule

Hermes child agents start with a fresh conversation. They receive only the `goal` and `context` the parent supplies. The parent must pass the full per-agent XML prompt, interviewContext, artifact path, relevant repo/runtime constraints, and success criteria to every child.

### Invocation

Use a batch call when launching more than one role:

```text
delegate_task(tasks=[
  {
    "goal": "Repromptverse researcher worker for {taskname}",
    "context": "You are the researcher agent on rpt-{taskname}.\n\n[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT HERE]\n\nWrite your complete findings to /tmp/rpt-{taskname}-researcher.md. Use file:line citations for every claim. Do not speculate. Finish after writing the artifact.",
    "toolsets": ["terminal", "file", "web", "skills"]
  },
  {
    "goal": "Repromptverse reviewer worker for {taskname}",
    "context": "You are the reviewer agent on rpt-{taskname}.\n\n[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT HERE]\n\nWrite your complete findings to /tmp/rpt-{taskname}-reviewer.md. Use file:line citations for every claim. Do not speculate. Finish after writing the artifact.",
    "toolsets": ["terminal", "file", "web", "skills"]
  }
])
```

Single-task form is valid for one worker:

```text
delegate_task(
  goal="Repromptverse implementer worker for {taskname}",
  context="[FULL PER-AGENT PROMPT + /tmp/rpt-{taskname}-implementer.md artifact contract]",
  toolsets=["terminal", "file", "skills"]
)
```

### Toolsets

Use only the toolsets the worker needs:

- `terminal` for commands and tests.
- `file` for reading/writing/patching files.
- `web` for live research.
- `skills` when the child must inspect RePrompter or other installed skills.
- `todo` for worker-local task tracking.

### Concurrency

Hermes documents `delegation.max_concurrent_children` with default 3. If a batch exceeds the configured limit, Hermes returns an error instead of silently queueing or truncating. Keep teams at or below the limit, split into batches, or use G2/G3.

```toml
[delegation]
max_concurrent_children = 3
max_spawn_depth = 1
```

Keep `max_spawn_depth = 1` for normal Repromptverse. Use nested orchestrator roles only when the user explicitly wants nested delegation.

### Status Line during G1

The parent can track its own plan with Hermes `todo`, then verify artifacts after child summaries return:

```bash
done=0
for f in /tmp/rpt-${TASKNAME}-*.md; do
  [ -e "$f" ] || continue
  case "$f" in *.prompt.md|*.stdout) continue ;; esac
  done=$((done + 1))
done
echo "Agents: ✅ $done/${TOTAL}  ⏳ $((TOTAL-done))/${TOTAL}"
```

### Retries

Retry only the failed or low-quality worker with a delta prompt. Do not respawn the whole team.

### Known G1 gotchas

- `delegate_task` is synchronous from the parent perspective; the parent waits for child summaries.
- Only the final child summary automatically enters parent context. Intermediate tool results do not.
- Leaf children normally cannot use `delegate_task`, `clarify`, `memory`, `send_message`, or `execute_code` unless Hermes is configured for orchestrator/nested roles.
- Parent interruptions cancel running children. For durable long-running work, use G3 Kanban or background shell jobs.
- There is no default mid-run cross-agent messaging in G1. Use artifact handoffs and parent synthesis.

---

## G2: Shell-level Hermes

Use shell-level Hermes when the orchestrator is outside an interactive Hermes session or when per-worker logs are required.

### `hermes -z` final-text path

```bash
TASKNAME="audit-2026-05"
AGENTS=(researcher implementer reviewer)

for role in "${AGENTS[@]}"; do
  hermes -z "
You are the ${role} agent on the rpt-${TASKNAME} team.

[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT FOR THIS ROLE]

Write your complete findings to the exact file /tmp/rpt-${TASKNAME}-${role}.md.
Use file:line citations. Do not speculate.
" \
    --toolsets terminal,file,web,skills \
    > "/tmp/rpt-${TASKNAME}-${role}.stdout" 2>&1 &
done

wait
```

### `hermes chat -q` one-shot path

```bash
hermes chat -q "[FULL PER-AGENT PROMPT]" \
  --toolsets terminal,file,skills \
  > "/tmp/rpt-${TASKNAME}-${role}.stdout" 2>&1 &
```

Use `hermes -z` when you want only final text. Use `hermes chat -q` when you want the normal chat one-shot behavior.

### Artifact contract

- Path: `/tmp/rpt-{taskname}-{agent-role}.md`
- One writer per file.
- The orchestrator must verify the artifact exists after `wait`.
- Exclude `.prompt.md` and `.stdout` when counting completed agents.

### Failure handling

Capture PIDs when running more than a few workers so failing jobs surface cleanly. If one worker hangs, kill only that PID and retry that role with a delta prompt.

---

## G3: Hermes Kanban

Kanban is not the default Repromptverse path. Use it only when the workflow needs durable cards rather than short fork/join delegation.

Use Kanban when:

- Work should survive restarts.
- Different Hermes profiles should pick up cards independently.
- A human needs to inspect, block, unblock, or comment on work.
- The task spans hours or days.
- The parent should not block waiting for child results.

Relevant tools:

- Task lifecycle: `kanban_show`, `kanban_complete`, `kanban_block`, `kanban_heartbeat`, `kanban_comment`
- Orchestration/fan-out: `kanban_create`, `kanban_link`
- Orchestrator-only by runtime guard: `kanban_list`, `kanban_unblock`

Keep the same RePrompter artifact contract (`/tmp/rpt-{taskname}-{role}.md`) even when Kanban is the coordination surface.

---

## What Hermes Agent does NOT provide

- G1 `delegate_task` does not give children the parent's full transcript automatically. Pass full context explicitly.
- G1 is not durable. Parent interruption cancels children.
- G1 does not provide native continuous cross-agent messaging by default.
- Oversized `delegate_task` batches error when above the configured concurrency limit.
- Kanban is powerful but heavier than normal Repromptverse; do not use it as the default for short runs.
- `/goal` does not replace RePrompter's expanded prompt. RePrompter still compresses first, then the user runs `/goal <objective>`.

When the above limitations matter, switch to G2, G3, Option B in Claude Code, or Option E sequential depending on the user's runtime and durability needs.

---

## Sources

All accessed 2026-05-15:

- https://github.com/NousResearch/hermes-agent
- https://github.com/NousResearch/hermes-agent/releases/tag/v2026.5.7
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/goals.md
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/delegation.md
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/kanban.md
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/cli-commands.md
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/slash-commands.md

---

**End of Hermes Agent Runtime Contract**

This document is additive. It does not modify any behavior for users on Claude Code, Codex CLI, OpenClaw, or Grok CLI.

**Auto-selection:** The central "Runtime auto-pick" decision tree in SKILL.md (Phase 3 Execute lane) includes an explicit check for the Hermes tool surface. When `delegate_task` is present together with at least two supporting Hermes tools, Repromptverse **automatically routes to Option G** without manual instruction.
