# Hermes Agent and Grok CLI support

> Part of `reprompter-team` (`../SKILL.md`). Verbatim from root SKILL.md lines 2000-2071. `references/runtime/...` paths are relative to the skill root, i.e. this directory's `runtime/` folder; Options F and G are in `runtime-options.md`.

## Hermes Agent Support (Additive Section — Zero Impact on Claude, Codex, OpenClaw, Grok)

When the current toolset includes `delegate_task` together with at least two of `terminal`, `process`, `read_file`, `write_file`, `patch`, `search_files`, `todo`, `skills_list`, or `skill_view`, you are executing under Hermes Agent.

In this environment:

- Single mode, Smart Interview, Dimension Interview, pattern library usage, prompt generation (Phases 1–2), quality scoring, evaluation loop, flywheel, Reverse Reprompter, and all template logic remain identical to other runtimes. No change in behavior or output format.

- `/goal` preflight is supported. Hermes accepts `/goal <objective>`, exposes `/goal status`, `/goal pause`, `/goal resume`, and `/goal clear`, and runs a bounded continuation loop until success, pause/clear, or budget exhaustion. The Goal Command Card should use:
  - `Runtime`: `Hermes Agent`
  - `Paste Into`: `Hermes TUI prompt, as-is`
  - `Mode`: `/goal preflight`

- For Repromptverse Phase 3 execution, treat this as **Option G** (Hermes-native parallel):
  - Use `delegate_task(tasks=[...])` for in-session parallel workers (G1 — recommended for most interactive runs).
  - Or shell-level external orchestration: write each prompt with a single-quoted heredoc, load it into `prompt_text`, then run `hermes -z "$prompt_text" --toolsets terminal,file,web,skills &` and `wait` (G2).
  - Use Hermes Kanban only when the user explicitly asks for durable, restart-surviving, multi-profile, or human-in-loop orchestration (G3).
  - Every worker **must** be explicitly instructed in its prompt/context to write its final output to the exact path `/tmp/rpt-{taskname}-{role}.md` (identical artifact contract used by all other runtimes).
  - Hermes `delegate_task` children start from fresh context. The parent must pass the full per-agent XML prompt, interviewContext, artifact path, and success criteria through each task's `goal` / `context`.

- Full invocation examples, `delegate_task` batch shape, `hermes -z` and `hermes chat -q` shell-level usage, Kanban boundaries, concurrency recommendations, retry patterns, `/goal` behavior, and the complete list of Hermes gotchas are documented in:

  `references/runtime/hermes-agent-runtime.md`

Read that file the first time you detect Hermes-native tools in the current environment.

This section is purely additive. The Phase 3 "Runtime auto-pick" decision tree (see above) contains an explicit Order-2 check for the Hermes tool surface (`delegate_task` plus at least two supporting Hermes tools). When this signature is detected, Repromptverse **automatically selects Option G** and uses the Hermes-native execution path documented in `references/runtime/hermes-agent-runtime.md`. No manual override is required for normal Repromptverse runs on Hermes Agent.

The rest of the skill remains unchanged for every other runtime. Non-Hermes users (Claude Code, Codex, OpenClaw, Grok CLI) see zero difference in behaviour or output.

Hermes users can install this skill by copying the directory to `~/.hermes/skills/reprompter/` or by adding the repo path to Hermes' external skill directories.

## Grok CLI Support (Additive Section — Zero Impact on Claude, Codex, OpenClaw, Hermes)

When the current toolset includes `spawn_subagent` together with at least two of `run_command`, `todo_write`, `ask_user_question`, you are executing under Grok CLI (xAI Grok 4.3+). A normal Grok session will usually also expose `read_file`, `search_replace`, and `write`.

**⚠️ Data egress — read before Repromptverse Option F on Grok.** Running Repromptverse on Grok CLI (Option F, below) executes `grok` in your project directory, handing its contents to xAI as model context (and, on an older or unverified binary, potentially bundling the **whole tracked repo + git history** — a confirmed earlier incident, turned off server-side 2026-07-13 and gone from the 2026-07-15 open-sourced code, but reversible and unverifiable; not stopped by `--sandbox`/`--yolo`). Before launching Option F while inside a git repo, warn the user once and get consent, or route the run to another runtime. Details and the required warning are in the "Data egress" section of `references/runtime/grok-cli-runtime.md`; full write-up at https://github.com/dorukardahan/headless-relay/blob/main/SECURITY.md. (The separate `Deliver via headless-relay` post-output step delegates to the headless-relay skill; the Grok isolation it relies on exists **only in headless-relay v2.0.0+** (v3.0.0 additionally runs Grok under a hermetic `env -i` with a clean `HOME`/temp `GROK_HOME` and cross-tool config scan off, so your global `~/.grok` rules do not leak into the delivery turn). This repo's documented relay minimum is v1.3.1+, fine for the other targets — but for the **Grok** delivery target specifically, an older relay would run Grok in your repo unprotected. If you cannot confirm headless-relay v2.0.0+, do not deliver to Grok. See the delivery hard-rules below.)

In this environment:

- Single mode, Smart Interview, Dimension Interview, pattern library usage, prompt generation (Phases 1–2), quality scoring, evaluation loop, flywheel, Reverse Reprompter, and all template logic remain 100% identical to other runtimes. No change in behavior or output format.

- For Repromptverse Phase 3 execution, treat this as **Option F** (Grok-native parallel):
  - Use `spawn_subagent` for in-session parallel workers (F1 — recommended for most interactive runs).
  - Or shell-level (external orchestration): `grok -p "..." --yolo --sandbox workspace &` then `wait` (F2). Example:
    ```bash
    grok -p "..." --yolo --sandbox workspace &
    wait
    ```
  - Recommended parameters for `spawn_subagent`:
    - `subagent_type`: "general-purpose" (full capability) or "explore" / "plan" for specialized workers
    - `persona`: "implementer", "researcher", "reviewer", "security-auditor", or a custom persona defined in `~/.grok/personas/*.toml`
    - `fork_context`: true (strongly recommended — the worker receives the original user task, Smart/Dimension Interview answers, team plan, and interviewContext without repetition)
    - `capability_mode`: "execute" (default for general-purpose) or "read-only" / "read-write"
    - `prompt`: the full per-agent reprompted XML document produced in Phase 2
  - Every worker **must** be explicitly instructed in its prompt to write its final output to the exact path `/tmp/rpt-{taskname}-{role}.md` (identical artifact contract used by all other runtimes).
  - Status Line during Phase 3: combine `todo_write` (for orchestrator tracking) with `run_command` + `ls /tmp/rpt-*.md` (exclude any `.prompt.md` or `.stdout` files) and render the compact line:
    ```
    Agents: ✅ 3/5  ⏳ 1/5  🔄 1/5 (retry 1)
    ```

- Full invocation examples, `~/.grok/config.toml` [subagents] settings, sandbox profile interaction, model-compatible headless flags, concurrency recommendations, retry patterns, and the complete list of "What Grok CLI does NOT provide" (no native TeamCreate/SendMessage/TeamDelete cross-messaging between workers, no /goal surface, no automatically shared TaskList across subagents, only partial hook matcher aliases for Claude tool names, etc.) are documented in:

  `references/runtime/grok-cli-runtime.md`

Read that file the first time you detect Grok-native tools in the current environment.

This section is purely additive. The Phase 3 "Runtime auto-pick" decision tree (see above) contains an explicit Order-1 check for the Grok tool surface (`spawn_subagent` must be present together with at least two of `run_command`, `todo_write`, `ask_user_question`). When this signature is detected, Repromptverse **automatically selects Option F** and uses the Grok-native execution path documented in `references/runtime/grok-cli-runtime.md`. No manual override is required for normal Repromptverse runs on Grok CLI.

The rest of the skill (Single, `/goal` preflight, Reverse, all templates, scoring, flywheel, etc.) is completely unchanged for every other runtime. Non-Grok users (Claude Code, Codex, OpenClaw, Hermes Agent) see zero difference in behaviour or output.

Grok users can install this skill by copying the directory to `~/.grok/skills/reprompter/` (or continue using the existing `~/.claude/skills/reprompter/` location — Grok automatically loads skills from the Claude compatibility path).
