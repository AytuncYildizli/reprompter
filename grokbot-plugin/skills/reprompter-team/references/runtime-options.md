# Repromptverse Phase 3 — runtime auto-pick, tool-schema guard, Options A-H

> Part of `reprompter-team`. Verbatim from root SKILL.md lines 841-956 (runtime auto-pick, tool-schema guard, Option A, critical tmux rules) and 994-1283 (Options B, C, D, H, G, E), in original order. `references/runtime/...` paths below are relative to the skill root (`../SKILL.md`), i.e. this directory's `runtime/` folder. Phase 4 and Expected cost & time stay in `../SKILL.md`. `scripts/<name>` paths resolve to the bundled `../../reprompter/scripts/<name>`.

#### Runtime auto-pick (default behaviour — do this first)

If the user explicitly named an option in their request (e.g. "use tmux", "run it sequentially", "via sessions_spawn"), honour that and skip the detection. Otherwise run the decision tree below top-to-bottom and use the first option whose capability is available.

| Order | Capability check | If true, use |
|-------|-----------------|--------------|
| 1 | `spawn_subagent` is present **and** at least two of `run_command`, `todo_write`, `ask_user_question` are in the current toolset (unambiguous Grok 4.3+ signature). | **Option F** — Grok CLI native parallel (F1: `spawn_subagent` with `fork_context=true`, `persona`, `capability_mode`; F2: shell-level `grok -p "..." --yolo --sandbox workspace &` then `wait`). **⚠️ In a git repo, get the user's explicit consent BEFORE launching Option F — data-egress gate right after this table.** Full contract and gotchas in `references/runtime/grok-cli-runtime.md`. |
| 2 | `delegate_task` is present **and** at least two of `terminal`, `process`, `read_file`, `write_file`, `patch`, `search_files`, `todo`, `skills_list`, or `skill_view` are in the current toolset (Hermes Agent signature). | **Option G** — Hermes Agent native parallel (G1: `delegate_task` batch; G2: shell-level `hermes -z` / `hermes chat -q` then `wait`; G3: Kanban only for durable workflows). Full contract and gotchas in `references/runtime/hermes-agent-runtime.md`. |
| 3 | **All four** of `TeamCreate`, `Agent`, `SendMessage`, and `TeamDelete` are listed in your current toolset. (Gating on `TeamCreate` alone is not enough — Option B's spawn/shutdown path needs the whole set; without it the run fails mid-execution rather than falling through to another option.) | **Option B** — native Claude Code teams; teammates can message each other; no tmux init or send-keys timing risk |
| 4 | A tool named `Workflow` is present in the current toolset (Claude dynamic Workflow runtime) — JS-scripted background orchestration with `agent()`/`parallel()`/`pipeline()` and schema-validated returns. Sits **below** Option B because the Workflow tool has **no** mid-run cross-agent messaging. | **Option H** — Claude dynamic Workflow tool; deterministic background fan-out via `pipeline`/`parallel` with schema-return handoffs and resumable runs; no mid-run cross-agent messaging. Full contract in `references/runtime/claude-workflow-runtime.md`. |
| 5 | `sessions_spawn` tool is listed in your current toolset | **Option C** — OpenClaw |
| 6 | `bash -c 'command -v tmux && { v=$(claude --version 2>/dev/null \| awk "{print \$1}"); [[ "$v" =~ ^(2\.[1-9]\|[3-9]) ]]; }'` exits 0. (Binary presence alone is insufficient — Option A needs `claude` ≥ 2.1 so `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is honoured; older CLIs accept the env var but don't enable team mode.) | **Option A** — tmux + child `claude --model opus`, visible panes |
| 7 | Running inside Codex (parallel sessions available) | **Option D** |
| 8 | None of the above | **Option E** — sequential fallback (works with any LLM) |

After picking, announce the selected option in one short line before starting Phase 3 work, so the user can redirect. Use this shape with the actual option and runtime you selected:

> Auto-picked **Option {letter}** ({runtime}) — {short detection reason}. Override by saying "use Option B", "use Option H (Workflow)", "use Option A (tmux)", "use Option D", "use Option G (Hermes)", or "use Option E" (sequential).

**⚠️ Grok Option F — data-egress consent gate (overrides the "don't ask" default above).** Option F runs `grok` (F1 `spawn_subagent` / F2 `grok -p`) in the caller's working directory, handing the repo's contents to xAI as model context. Earlier Grok Build versions additionally bundled the **entire tracked repo + full git history** and uploaded it (confirmed incident; not stopped by `--sandbox`, `--yolo`, or a read-only profile); xAI turned that off server-side on 2026-07-13 and the path is gone from the 2026-07-15 open-sourced code, but the off-state is a reversible server flag and the shipped binary is unverifiable. So for Option F **only**, the "in most runs you should not ask the user" default does NOT apply: before launching F1 or F2 inside a git repo, warn the user once, get explicit consent, and offer to route the run to another runtime (or a **non-git copy** of just the needed files created **outside any git repo** — e.g. a fresh dir under `/tmp`, verified with `git rev-parse --is-inside-work-tree` returning non-zero; note that a `.git`-removed subdirectory of the project is still inside the parent work tree, and a clone/worktree is still a repo). Full detail and the required warning: the "Data egress" section of `references/runtime/grok-cli-runtime.md`.

Why F is first for Grok: when an unambiguous Grok signature is detected (`spawn_subagent` + at least two of the supporting tools), Repromptverse must use Grok-native execution (Option F) to honour the "full Grok runtime support" claim. This check is intentionally strict to prevent false positives on other runtimes. Option B (Claude native teams with cross-agent `SendMessage`) is preferred on Claude Code surfaces because it offers richer inter-agent messaging than Grok subagents currently provide. The rest of the priority order is unchanged.

Why G is next for Hermes: `delegate_task` is a Hermes-specific fork/join primitive. When that tool appears with Hermes' file, terminal, skills, or todo tools, Repromptverse should use the native Hermes path instead of falling through to OpenClaw, tmux, Codex, or sequential mode. Hermes workers receive fresh context, so the parent must pass the full per-agent prompt and artifact path in each task's `context`.

Why H sits just below B on Claude surfaces: both are Claude-native, but the dynamic Workflow tool has **no mid-run cross-agent messaging** — workers cannot talk; data flows only through `pipeline()`/`parallel()` return values. So Option B stays the default when teammates must negotiate during the run (review/audit teams), and Option H wins when you want deterministic background fan-out, schema-validated return handoffs, and resumable runs (the script's `agent()` prefix is cached on `resumeFromRunId`). Full contract in `references/runtime/claude-workflow-runtime.md`.

#### Tool-schema guard (all options)

Before invoking any tool named in Options A–H, verify it appears in your current toolset and that the call signature matches the schema loaded for the current runtime. Modern CLI runtimes reject calls against an unknown tool or a non-matching signature instead of inferring intent. If a named tool is unfamiliar, halt and report back rather than substituting a similar-looking one.

Known pitfalls captured from 4.6 → 4.7 drift in this skill:

- **`Task` → `Agent`.** The legacy spawn tool was named `Task` and took `subagent_type` as a keyword argument. It has been split into `Agent(...)` for spawn and `TaskCreate` / `TaskUpdate` / `TaskList` for todos. Any example still calling the old spawn name is broken under 4.7.
- **`SendMessage` signature.** Current shape is `SendMessage(to=<name-or-"*">, message=<str-or-obj>)`. Legacy `type=` and `recipient=` kwargs do not exist on the current tool.
- **Broadcast restriction.** `SendMessage(to="*", ...)` accepts **plain strings only.** Structured payloads such as `{"type": "shutdown_request"}` must be sent per-agent by name; the runtime rejects structured broadcasts.
- **`TeamDelete` ordering.** `TeamDelete()` fails if any teammate is still active. Shutdown is async; in-process teammates need a turn yield to approve each `shutdown_request` before cleanup succeeds.
- **`TeamCreate` precedence.** `Agent(team_name=...)` errors if that team was not created first. Always call `TeamCreate` before any `Agent` with a `team_name` argument.

Canonical signatures Option B depends on. **These are reference documentation, not a schema enforced by the validator.** `npm run validate:tool-refs` is a blocklist — it catches known-bad shapes from this repo's history (obsolete tool names, reordered broadcast calls, hardcoded model pins) but does not positively verify that every call here matches its schema. If you change a signature below, update the linter's check set in `scripts/validate-tool-refs.js` in the same PR (and also any Option B flow that relies on the old shape).

```text
TeamCreate(team_name=<string>, description=<string>)

TaskCreate(subject=<string>, description=<string>)

Agent(
  description=<string>,           # required
  prompt=<string>,                 # required
  subagent_type=<string>,          # optional, e.g. "general-purpose"
  team_name=<string>,              # optional — requires prior TeamCreate
  name=<string>,                   # optional — used as SendMessage target
  model=<string>,                  # optional — "opus" / "sonnet" / "haiku"
  run_in_background=<bool>,        # optional — default false
)

SendMessage(to=<name-or-"*">, message=<str-or-obj>)

TaskList()  # used during polling; returns current task statuses

TeamDelete()
```

Never hardcode a specific model version string of the form `claude-<family>-<major>-<minor>` — use the bare alias (`opus`, `sonnet`, `haiku`) so the CLI resolves to the current latest automatically. The linter also enforces this.

#### Option A: tmux (Claude Code)

```bash
# 1. Start Claude Code with Agent Teams
tmux new-session -d -s {session} "cd /path/to/workdir && CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --model opus"
# placeholders:
# - {session}: unique tmux session name (example: rpt-auth-audit)
# - /path/to/workdir: absolute repository path for the target project (example: /tmp/reprompter-check)

# 2. Wait for startup
sleep 12

# 3. Send prompt — use -l (literal), Enter SEPARATE
# Include POLLING RULES to prevent lead TaskList loop bug
tmux send-keys -t {session} -l 'Create an agent team with N teammates. Use model opus for all tasks.

POLLING RULES:
- After sending tasks, poll TaskList at most 10 times
- If all tasks show "done" status, stop polling immediately
- After 3 consecutive TaskList calls showing the same status, stop polling regardless
- Once you stop polling: read the output files, then write synthesis
- Do not call TaskList more than 20 times total under any circumstances

Teammate 1 (ROLE): TASK. Write output to /tmp/rpt-{taskname}-{domain}.md. ... After all complete, synthesize into /tmp/rpt-{taskname}-final.md'
sleep 0.5
tmux send-keys -t {session} Enter

# 4. Monitor (poll every 15-30s) — show Status Line: Agents: ✅ N/T ⏳ N/T 🔄 N/T
tmux capture-pane -t {session} -p -S -100

# 5. Verify outputs
ls -la /tmp/rpt-{taskname}-*.md

# 6. Cleanup
tmux kill-session -t {session}
```

#### Critical tmux rules

⚠️ **WARNING: Default teammate model is HAIKU unless explicitly overridden. Always set `--model opus` in both CLI launch command and team prompt.**

| Rule | Why |
|------|-----|
| Always `send-keys -l` (literal flag) | Without it, special chars break |
| Enter sent SEPARATELY | Combined fails for multiline |
| sleep 0.5 between text and Enter | Buffer processing time |
| sleep 12 after session start | Claude Code init time |
| `--model opus` in CLI AND prompt | Default teammate = HAIKU |
| Each agent writes own file | Prevents file conflicts |
| Unique taskname per run | Prevents collisions between concurrent sessions |


#### Option B: TeamCreate (Claude Code native)

When using Claude Code with TeamCreate/SendMessage tools (native agent teams, no tmux needed):

```text
# 1. Create team
TeamCreate(team_name="rpt-{taskname}", description="Repromptverse: {task summary}")

# 2. Create tasks (one per agent)
TaskCreate(subject="Agent 1 task", description="Full reprompted prompt from Phase 2")
TaskCreate(subject="Agent 2 task", description="Full reprompted prompt from Phase 2")

# 3. Spawn teammates with the Agent tool (specify model=opus)
#    Note: In Claude Code ≥2.1, the tool is `Agent`. The old `Task` name referred
#    to the same spawn primitive but no longer exists as a callable tool. Using
#    `Task(...)` here causes the model to either fail the call or skip the spawn.
Agent(description="Agent 1 on rpt-{taskname}", subagent_type="general-purpose",
      team_name="rpt-{taskname}", name="agent-1", model="opus",
      prompt="You are {role} on the rpt-{taskname} team. Your task is Task #1. [full prompt]",
      run_in_background=true)
Agent(description="Agent 2 on rpt-{taskname}", subagent_type="general-purpose",
      team_name="rpt-{taskname}", name="agent-2", model="opus",
      prompt="You are {role} on the rpt-{taskname} team. Your task is Task #2. [full prompt]",
      run_in_background=true)

# 4. Wait for teammates to complete — show Status Line per poll cycle
# Status Line: Agents: ✅ N/T ⏳ N/T 🔄 N/T (derived from TaskList status)
# 5. Compile synthesis from teammate reports
# 6. Shutdown teammates and delete team
#    Two hard rules on the current runtime (verified on Claude Code 2.1+):
#    - SendMessage(to="*") ONLY accepts plain-string messages. Structured
#      payloads like {"type": "shutdown_request"} are rejected on broadcast,
#      so shutdown is sent per-agent by name.
#    - TeamDelete() errors if any teammate is still active. shutdown is
#      asynchronous (each teammate needs a turn to approve the request and
#      terminate), so wait for each agent to acknowledge before calling it.
#      Retry TeamDelete with a small backoff if needed.
SendMessage(to="agent-1", message={"type": "shutdown_request"})
SendMessage(to="agent-2", message={"type": "shutdown_request"})
# ... one SendMessage per spawned teammate
# (wait for each shutdown_response — in-process teammates need a turn yield)
TeamDelete()
```

**Advantages over tmux:** Teammates can message each other (cross-agent flags), shared TaskList for progress tracking, no tmux/terminal dependency, built-in idle/shutdown protocol.

**When to use TeamCreate vs tmux:** Use TeamCreate when agents need to communicate (review teams, audit teams). Use tmux when agents are fully independent and you want visible terminal panes.

#### Option C: sessions_spawn (OpenClaw only)

When tmux/Claude Code is unavailable but running inside OpenClaw:
```
sessions_spawn(task: "<per-agent prompt>", model: "opus", label: "rpt-{role}")
```
Note: `sessions_spawn` is an OpenClaw-specific tool. Not available in standalone Claude Code.

#### Option D: Codex CLI

Codex CLI 0.121.0+ offers two valid patterns for Repromptverse fan-out. Pick based on whether orchestration happens inside or outside the Codex session.

| Pattern | When to use | Mechanism |
|---|---|---|
| **D1: Native subagents** | In-session orchestration, shared context, single synthesis, per-agent TOML role definitions | `[agents]` config + prompt-driven spawn |
| **D2: Shell-level `codex exec`** | External orchestration, per-agent model/profile, structured stdout/stderr logs, total isolation | `codex exec --ephemeral --sandbox <mode> ... &` + `wait` |
| _Neither — cross-agent messaging required mid-run_ | Agents must talk while running | Use Option B (TeamCreate in Claude Code) — Codex has no cross-agent messaging primitive |

See `references/runtime/codex-runtime.md` for the full runtime contract (invocation, artifacts, retries, known gotchas).

**D1 — Native subagents (Codex 0.121.0+; `multi_agent` feature flag stabilized in 0.115.0 on 2026-03-16)**

Enable in `~/.codex/config.toml`:

```toml
[features]
multi_agent = true

[agents]
max_threads = 6       # concurrent workers (default)
max_depth = 1         # no sub-subagents by default
job_max_runtime_seconds = 1800
```

Define each repromptverse role once as `~/.codex/agents/<name>.toml`:

```toml
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
```

**Note:** `report_agent_job_result` is a Codex tool required only by `spawn_agents_on_csv` batch workers, not by ordinary prompt-spawned subagents. Do not add it to the normal D1 `developer_instructions` above — the tool is not registered for standard subagent roles.

Subagents are prompt-driven in Codex (not flag-driven). The orchestrator prompt fans out in natural language:

```
Spawn one rpt_audit_explorer subagent per audit dimension
(methodology, code, stats, narrative, attack-surface, claims).
Each subagent writes to /tmp/rpt-{taskname}-{dimension}.md.
After all six complete, read their artifacts and synthesize
the final report to /tmp/rpt-{taskname}-final.md.
```

The `[agents] max_threads` cap is enforced natively — no FIFO semaphore needed. Note: normal `spawn_agent` calls past the cap fail with an `AgentLimitReached` error rather than queueing, so keep the orchestrator's fan-out size ≤ `max_threads`. Known gotchas: issue #14866 (stuck "awaiting instruction", closed with linked fix) and issue #15177 (still open: model override metadata may leak back to parent model — prefer the `default` role when override fidelity matters).

**D2 — Shell-level `codex exec` (portable shell-level path, any Codex version with `codex exec` + `--ephemeral`)**

Shell-level parallelism works on any POSIX shell. `codex exec` is one-shot, so backgrounding each agent and waiting is the portable pattern:

```bash
# 0. Materialize per-agent prompt files (Phase 2 split).
#    Convention: /tmp/rpt-{taskname}-{agent}.prompt.md
ls /tmp/rpt-{taskname}-*.prompt.md

# 1. Launch each agent in the background. Workers must write their
#    artifact to /tmp/rpt-{taskname}-{agent}.md, so they need write
#    access to /tmp. --sandbox workspace-write permits this. In
#    `codex exec`, --full-auto is an alias for the same sandbox and
#    approval stays at `never` either way (verified in codex 0.121.0
#    source: exec/src/cli.rs + exec/src/lib.rs). Pick whichever flag
#    reads cleaner in your scripts.
#    Switch to --sandbox read-only ONLY if your workers are pure
#    analysis that captures findings via --output-last-message instead
#    of writing the .md artifact themselves (rename the .log to .md
#    after `wait`).
#    `--ephemeral` skips on-disk session state; recommended for
#    isolated parallel runs (historical reference: closed issue #11435).
MODEL="gpt-5.4"
for agent in planner critic synthesizer; do
  codex exec \
    --model "$MODEL" \
    --ephemeral \
    --sandbox workspace-write \
    --output-last-message "/tmp/rpt-{taskname}-${agent}.log" \
    "$(cat /tmp/rpt-{taskname}-${agent}.prompt.md)" \
    > "/tmp/rpt-{taskname}-${agent}.stdout" 2>&1 &
done

# 2. Wait for all background sessions.
wait

# 3. Verify each agent wrote its artifact (exclude .prompt.md inputs).
ls /tmp/rpt-{taskname}-*.md 2>/dev/null | grep -v '\.prompt\.md$'

# 4. Run Phase 4 evaluator loop.
```

Status Line during execution: Codex CLI has no built-in TaskList. Derive status from artifact presence — crucially, **exclude the `.prompt.md` input files** or the counter will report "done" before any agent writes output:

```bash
# Zero-match-safe, POSIX-compatible loop. Does not abort under
# `set -euo pipefail` when no artifacts exist yet or only .prompt.md
# inputs are present, and runs in dash (/bin/sh) as well as bash/zsh.
done=0
for f in /tmp/rpt-{taskname}-*.md; do
  [ -e "$f" ] || continue             # glob returned literal (no matches)
  case "$f" in *.prompt.md) continue ;; esac
  done=$((done + 1))
done
total=3
echo "Agents: ✅ $done/$total  ⏳ $((total-done))/$total"
```

**Retries:** Re-run `codex exec` for the failing agent with the delta prompt (Phase 4). Do NOT re-run the whole fleet.

**Concurrency cap (D2):** Default to 4 or the CPU count, whichever is lower. On Linux use `nproc`; on macOS use `sysctl -n hw.ncpu`. More than 4 concurrent Codex sessions against the same account can hit rate limits.

**If `wait` hangs (D2):** one agent stalled. Inspect `/tmp/rpt-{taskname}-*.stdout`, kill that PID, retry just that agent.

**Single-session fallback:** if the environment doesn't allow backgrounding or subagents (sandboxed shells, notebook runners), use Option E — the reprompted prompts are plain text and run identically in one session, just slower.

**When to pick D1 vs D2:**

| Situation | Pick |
|---|---|
| Agents share context; one summary output expected | D1 |
| Need per-agent log files or model/profile overrides | D2 |
| Orchestrating from CI or shell script outside Codex | D2 |
| You want fresh context per worker without re-ingesting the codebase | D1 |
| Codex < 0.121.0 or `multi_agent` feature disabled | D2 |
| Cross-agent messaging required mid-run | Neither — use Option B (TeamCreate in Claude Code) |

#### Option H: Claude dynamic Workflow tool

When a tool named `Workflow` is present in the current toolset (Claude dynamic Workflow runtime), Phase 3 can compile the Phase-2 per-agent prompts into a single runnable `.workflow.js` and run it via `Workflow({ scriptPath, args })`. Picked at Order 4 — **below Option B**, because the Workflow tool has **no mid-run cross-agent messaging**; data flows only through `pipeline()`/`parallel()` return values.

Because Option H has no mid-run messaging seam, `node scripts/run-supervisor.js --advise --run-id {runId} --json` applies only after the workflow returns.

Each Phase-2 reprompted prompt becomes an `agent(prompt, { schema })` call. Three emission patterns:

| Pattern | When | Shape |
|---|---|---|
| **H1: `pipeline()` default** | Sequential dependencies (fetch → transform → deploy); each item independent, no barrier | `pipeline(items, stage1, stage2)` |
| **H2: `parallel()` barrier** | Independent-domain agents whose results are synthesized/evaluated together (the common Repromptverse shape) | `(await parallel(roles.map(r => () => agent(r.prompt, { schema })))).filter(Boolean)` then synthesize |
| **H3: budget-aware depth** | A `+Nk` budget directive | **As the compiler emits it:** a fixed roster + agent-count caps (`maxItems: 20`, `VERIFY_CAP: 24`) and a completeness critic gated on `!budget.total \|\| budget.remaining() > 30000` — depth dials off near the ceiling, no roster scaling. (A literal `while (budget.remaining() > N) { … }` loop-until-budget is a valid *hand-authored* shape, but the compiler does not emit one.) |

Hard rules for the emitted script (full contract: `references/runtime/claude-workflow-runtime.md`): `meta` is a pure literal with `phase()` titles matching `meta.phases`; `runId`/`taskname` come from `args` (never generated in-script — wall-clock and randomness throw and break resume); `model` is omitted so agents inherit the main-loop model; `filter(Boolean)` after every `parallel()`/`pipeline()`. **Schema-validated returns are the single source of truth** — the script never reads the `/tmp/rpt-*.md` files back; the parent writes that compatibility mirror **after** the run returns (so Status Line / Phase-4 / flywheel keep working). High-risk forbidden surfaces (prod/auth/secret/...) block script emission (`blocked: true`, `script: null`); there is no in-tool override, so rescope the task to proceed.

**Ultracode:** when ultracode is on, the emitted script defaults to the thorough body — adversarial / perspective-diverse verify (3 distinct lenses: correctness/completeness/risk, a finding kept only on ≥2/3 non-refutation) plus a completeness critic. **Agent-count caps** keep it under the Workflow 1000-agent lifetime cap: `maxItems: 20` findings per role and `VERIFY_CAP = 24` (≤72 verify agents), with truncation logged. **Budget scaling (H3, as shipped):** the critic is gated on `!budget.total || budget.remaining() > 30000` so the extra pass dials off near the token ceiling — the roster itself is *not* budget-scaled. A budget directive (`+Nk` / `budget:` only — clamped to 100M; a bare `Nk tokens` is ambiguous with exfiltration and is **not** a cue) rides the command as `args.budget`, while the script prefers the live `budget` global. Lean off-ramp (`REPROMPTER_ULTRACODE=0` / `--no-ultracode`) keeps trivial reprompts cheap. Compiler: `scripts/workflow-command.js`.

#### Option G: Hermes Agent

Hermes Agent supports three valid Repromptverse execution patterns. Pick G1 by default for normal interactive runs.

| Pattern | When to use | Mechanism |
|---|---|---|
| **G1: `delegate_task` batch** | In-session parallel Repromptverse; parent needs final summaries before synthesis | `delegate_task(tasks=[...])` with one task per role |
| **G2: Shell-level Hermes** | External orchestration, per-worker logs, CI/headless scripts | Write prompt files with single-quoted heredocs, then run `hermes -z "$prompt_text"` or `hermes chat -q "$prompt_text"` in the background, then `wait` |
| **G3: Kanban** | Durable, restart-surviving, multi-profile, human-in-loop workflows | `kanban_create` + worker agents pulling/listing/completing cards |

See `references/runtime/hermes-agent-runtime.md` for the full runtime contract (invocation, artifacts, retries, `/goal`, Kanban, and known gotchas).

**G1 — Native delegation via `delegate_task` (recommended)**

Hermes child agents start with fresh conversation context. The parent must pass all relevant context in each task's `goal` and `context`; do not assume the child can see the parent's full transcript.

```text
delegate_task(tasks=[
  {
    "goal": "Repromptverse researcher worker for {taskname}",
    "context": "You are the researcher agent on rpt-{taskname}.\n\n[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT HERE]\n\nWrite your complete findings to /tmp/rpt-{taskname}-researcher.md. Use file:line citations. Do not speculate.",
    "toolsets": ["terminal", "file", "web", "skills"]
  },
  {
    "goal": "Repromptverse reviewer worker for {taskname}",
    "context": "You are the reviewer agent on rpt-{taskname}.\n\n[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT HERE]\n\nWrite your complete findings to /tmp/rpt-{taskname}-reviewer.md. Use file:line citations. Do not speculate.",
    "toolsets": ["terminal", "file", "web", "skills"]
  }
])
```

Default Hermes concurrency is bounded by `delegation.max_concurrent_children` (documented default 3). If the planned team is larger than the limit, split into batches or use G2/G3. Oversized batches return an error rather than silently queueing.

Status Line during G1: track the parent plan with Hermes `todo`, then combine returned child summaries with artifact checks (`ls /tmp/rpt-{taskname}-*.md`, excluding `.prompt.md` and `.stdout`) before Phase 4 synthesis.

**G2 — Shell-level `hermes -z` / `hermes chat -q`**

Use this when the parent is orchestrating from a shell script or needs separate stdout/stderr logs:

```bash
TASKNAME="audit-2026-05"
AGENTS=(researcher implementer reviewer)

for role in "${AGENTS[@]}"; do
  prompt_file="/tmp/rpt-${TASKNAME}-${role}.prompt.md"
  {
    printf 'You are the %s agent on the rpt-%s team.\n\n' "$role" "$TASKNAME"
    cat <<'REPROMPTER_PROMPT'
[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT FOR THIS ROLE]
REPROMPTER_PROMPT
    printf '\n\nWrite your complete findings to the exact file /tmp/rpt-%s-%s.md.\n' "$TASKNAME" "$role"
    printf 'Use file:line citations. Do not speculate.\n'
  } > "$prompt_file"

  prompt_text="$(cat "$prompt_file")"
  hermes -z "$prompt_text" \
    --toolsets terminal,file,web,skills \
    > "/tmp/rpt-${TASKNAME}-${role}.stdout" 2>&1 &
done

wait
```

Use `hermes chat -q "$prompt_text"` instead of `hermes -z "$prompt_text"` when you want the normal chat one-shot path rather than pure final text. Workers must still write `/tmp/rpt-{taskname}-{role}.md`.

**G3 — Hermes Kanban (explicit opt-in only)**

Do not auto-select Kanban for normal Repromptverse. Use it only when the user wants durable work that survives restarts, spans multiple Hermes profiles, needs human-in-loop checkpoints, or should be visible as a board. Kanban agents use the `kanban_*` toolset directly: task workers normally use lifecycle tools such as `kanban_show`, `kanban_complete`, `kanban_block`, `kanban_heartbeat`, and `kanban_comment`, while profiles that explicitly enable the Kanban toolset and are not scoped to one dispatcher task can also use orchestration tools such as `kanban_list`, `kanban_create`, `kanban_link`, and `kanban_unblock`.

**Known Hermes gotchas:**

- `delegate_task` is synchronous from the parent's perspective; the parent waits for child summaries before continuing.
- Child summaries are the only child state automatically returned to the parent. Intermediate tool outputs do not enter the parent context unless the child writes artifacts or summarizes them.
- Normal child agents cannot themselves use `delegate_task`, `clarify`, `memory`, `send_message`, or `execute_code` unless Hermes is configured for orchestrator/nested roles.
- Cross-agent messaging during a running G1 batch is not the default coordination surface. Use artifact files and parent synthesis, or use G3 Kanban for durable coordination.

#### Option E: Sequential (any LLM)

No parallel execution tools available? Run each agent's reprompted prompt one at a time in the same session. Works with any LLM (Claude, GPT, Gemini, Codex, etc.). Slower but fully platform-agnostic.

The reprompted prompts from Phase 2 are pure text. They work regardless of execution method.

---
