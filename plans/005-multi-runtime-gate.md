# Plan 005: Port the ambient prompt gate to Codex CLI and Hermes Agent (v12.13.0)

> **Executor instructions**: Follow step by step; run every verification. On any
> STOP condition, stop and report. No `git` commands. No `plans/README.md` edits.
>
> **Drift check (run first)**: `scripts/prompt-gate.js` exists; `node scripts/prompt-gate.js --score "test"` prints JSON. Otherwise STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED (new output formats on an existing fail-soft script; wrong format = silent no-op, never breakage)
- **Depends on**: plans/004 (stop-gate) merged first — both touch gate docs/npm chain; keep rounds sequential.
- **Category**: direction
- **Planned at**: 2026-07-03, after runtime-hooks research (verified against codex-cli 0.142.5 live install + official docs, and Hermes v0.17.0 source/docs)

## Why this matters

The ambient gate is Claude Code-only. Research (2026-07-03, primary sources) verified both other major runtimes now expose exact-fit hooks, so the SAME heuristic gate can run everywhere RePrompter runs, multiplying ambient reach and flywheel data. No new scoring logic — only payload parsing and output-format adapters.

## Verified runtime facts (authoritative for this plan)

**Codex CLI (hooks stable; verified on codex-cli 0.142.5 + https://developers.openai.com/codex/hooks):**
- Event `UserPromptSubmit`; config in `~/.codex/hooks.json` (or `[hooks]` in config.toml; project `.codex/hooks.json` also loads):
  ```json
  {"hooks": {"UserPromptSubmit": [{"hooks": [{"type": "command", "command": "node /path/to/skills/reprompter/scripts/prompt-gate.js --format=codex", "timeout": 10}]}]}}
  ```
- stdin JSON includes `session_id`, `cwd`, `hook_event_name`, and `prompt` (the user prompt text) — same field name as Claude Code.
- Context injection: exit 0 with stdout JSON `{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "<advisory>"}}`. (Blocking via `{"decision":"block"}` exists — the gate must NEVER use it.)
- Trust model: user reviews/trusts the hook via `/hooks`; trust keyed to SHA-256 of the definition; editing the command invalidates trust. Set an explicit short `timeout` (default is 600s).
- Kill switch: `[features] hooks = false` disables all hooks; our env flags still apply.

**Hermes Agent (`pre_llm_call`; verified from Hermes v0.17.0 source/docs; shipped since v2026.4.23, predating v0.13):**
- Shell hook in `~/.hermes/config.yaml`:
  ```yaml
  hooks:
    pre_llm_call:
      - command: "node /path/to/skills/reprompter/scripts/prompt-gate.js --format=hermes"
        timeout: 5
  ```
- stdin JSON: `hook_event_name`, `session_id`, `cwd`, and `extra` carrying `user_message` (the prompt text), `is_first_turn`, `model`, `platform`.
- Context injection: stdout JSON `{"context": "<advisory>"}` — appended ephemerally to the turn's user message. `pre_llm_call` CANNOT block (fine — the gate never blocks anyway).
- Consent: first-use interactive approval per (event, command), persisted to `~/.hermes/shell-hooks-allowlist.json`; non-TTY needs `HERMES_ACCEPT_HOOKS=1` or `hooks_auto_accept: true` else the hook silently stays unregistered. Failure semantics are soft (malformed/timeout ignored).
- Hermes installs ship no `scripts/` — the hook needs a git clone or the file copied; docs must say so (same caveat pattern as version-check).

**Stale doc found by the same research**: `references/runtime/codex-runtime.md` (~line 275) claims Codex has "no equivalent of PreToolUse/PostToolUse as of 0.121.0" — false since the hooks system shipped. Fix as part of this plan.

## Current state

- `scripts/prompt-gate.js` — hook CLI currently: reads stdin JSON, takes `.prompt` + `.session_id`, plain-text stdout advisory (Claude Code UserPromptSubmit contract), `--score` debug flag, fail-soft everything. `buildNudge()` produces the advisory string. After plan 004 it may also export `cacheDir`/`hashedSessionId` — do not disturb.
- `scripts/prompt-gate.test.js` — spawned-CLI tests with pinned env (`runGate` helper).
- SKILL.md "Ambient Prompt Gate" section says "Claude Code only" and "Other runtimes (Codex hooks, Hermes) are a documented follow-up" — this plan is that follow-up.
- README Compatibility table has no gate row; Key Features gate paragraph says Claude Code.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Gate suite | `npm run test:prompt-gate` | exit 0 |
| Full gate | `npm run check` | exit 0 (pre-commit artifact-guard failures excepted) |

## Scope

**In scope**: `scripts/prompt-gate.js` (format adapters only), `scripts/prompt-gate.test.js`, `references/runtime/codex-runtime.md` (stale hooks claim), `references/runtime/hermes-agent-runtime.md` (gate install snippet), SKILL.md, README.md, CHANGELOG.md, package.json/lock (version), `plugin/**` + `skills/reprompter/**` via generators.

**Out of scope**: scoring heuristics, thresholds, cooldown logic, stop-gate.js (Claude-only for now — note Codex/Hermes stop-equivalents as follow-up), telemetry schema, any auto-editing of user configs (`~/.codex/*`, `~/.hermes/*` are documented snippets ONLY).

## Git workflow

None. Reviewer handles git.

## Steps

### Step 1: Format adapters in `scripts/prompt-gate.js`

Add `--format=claude|codex|hermes` (default `claude`; also accept env `REPROMPTER_GATE_FORMAT` with the flag taking precedence). Changes confined to the CLI layer:

1. **Input**: prompt text = `payload.prompt` (claude/codex) or `payload.extra?.user_message ?? payload.user_message` (hermes). `session_id` top-level in all three.
2. **Output on nudge** (single line + `\n`, nothing on skip, exit 0 always):
   - `claude`: current plain advisory text (UNCHANGED — byte-for-byte).
   - `codex`: `JSON.stringify({hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: advisory}})`.
   - `hermes`: `JSON.stringify({context: advisory})`.
3. Unknown format value → behave as `claude` (fail-soft, never error).
4. Telemetry: add `runtime` field to the event (`"claude-code" | "codex" | "hermes"`) — the schema already accepts an optional `runtime` string; no schema change.
5. Never emit `decision: "block"` in any format.

**Verify**: `echo '{"session_id":"s1","prompt":"uhh build a crypto dashboard, maybe coingecko data, add caching, test it too"}' | XDG_CACHE_HOME=$(mktemp -d) node scripts/prompt-gate.js --format=codex` → one-line JSON with `hookSpecificOutput.additionalContext`; same with `--format=hermes` and payload `{"session_id":"s1","extra":{"user_message":"..."}}` → `{"context":"..."}`; default format output UNCHANGED vs current (byte-compare against a saved fixture in the test).

### Step 2: Tests

Extend `scripts/prompt-gate.test.js`: codex format nudge + silent-skip (empty stdout, NOT `{}`), hermes format nudge + payload-shape handling (extra.user_message), unknown format falls back to claude, claude output byte-identical to pre-change fixture, telemetry `runtime` field present per format, and malformed stdin silent for every format. Keep env pinned in all spawns.

**Verify**: `npm run test:prompt-gate` → exit 0.

### Step 3: Docs

1. SKILL.md gate section: retitle from "Claude Code only" to multi-runtime; add the verified Codex `hooks.json` snippet (with the trust-model note: review via `/hooks`, re-trust after edits, set explicit `timeout`) and the Hermes `config.yaml` snippet (with the consent-allowlist note, non-TTY `HERMES_ACCEPT_HOOKS=1`, cannot-block note, and the "Hermes installs ship no scripts/ — use a git clone" caveat). State plainly: same script, same heuristics, same kill switches, same local-only privacy on all three runtimes; Stop-hook acceptance recording remains Claude Code-only for now.
2. `references/runtime/codex-runtime.md`: fix the stale "no hooks as of 0.121.0" claim — hooks (incl. UserPromptSubmit/PreToolUse/PostToolUse) are stable in current Codex CLI; keep the historical note as "since ~0.14x".
3. `references/runtime/hermes-agent-runtime.md`: short gate subsection pointing at the SKILL.md snippet.
4. README: gate Key Features sentence → all three runtimes; Compatibility table gains an "Ambient gate" row (Claude Code yes / Codex yes / OpenClaw - / Grok - / Hermes yes¹ with the clone footnote).
5. CHANGELOG v12.13.0; version bump everywhere (package.json, lock ×2, SKILL.md frontmatter/title/blurb, README badge, test table with real counts); regenerate both artifacts.

**Verify**: `npm run validate:templates && npm run validate:tool-refs` → exit 0; `cmp SKILL.md plugin/skills/reprompter/SKILL.md` → identical; `npm run check` suites green.

## Done criteria

- [ ] All three formats produce correct nudge output and silent skips (spawned tests).
- [ ] Claude-format output byte-identical to v12.12.0 behavior (fixture test) — zero regression for existing installs.
- [ ] Telemetry events carry `runtime`; no prompt text persisted (existing privacy test still green).
- [ ] Stale Codex-hooks claim fixed in codex-runtime.md.
- [ ] `npm run check` exit 0; versions consistent at 12.13.0.

## STOP conditions

- The existing claude-path output cannot be kept byte-identical without behavior change.
- Telemetry schema does NOT accept an optional `runtime` field (re-check `sanitizeEvent`) — if so, report rather than changing the schema.
- Any suite you did not touch fails.

## Maintenance notes

- Codex/Hermes stop-hook equivalents (acceptance recording) = follow-up once plan 004's Claude data proves the signal (Codex has more lifecycle events; Hermes has `post_llm_call`-era hooks to research).
- Codex trust friction: any change to the documented hook command line invalidates user trust — keep the snippet stable across releases.
- Hermes payload contract is `**kwargs` forward-compatible; if a future Hermes renames `user_message`, the gate silently no-ops (fail-soft) — acceptable, but watch release notes.
