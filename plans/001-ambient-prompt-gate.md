# Plan 001: Ship the Ambient Prompt Gate — an opt-in UserPromptSubmit hook that scores every prompt and nudges weak ones (v12.8.0)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT run any `git` commands (no branch, add,
> commit, push) — the reviewer handles all git operations. Do NOT update
> `plans/README.md` — the reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 5634317..HEAD -- scripts/ SKILL.md README.md CHANGELOG.md package.json package-lock.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (purely additive; the hook is opt-in and fail-soft)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `5634317`, 2026-07-02

## Why this matters

RePrompter today is pull-only: every lane requires the user to remember to invoke it, and the v12 flywheel starves because both ends of its loop are manual. This plan adds an **Ambient Prompt Gate**: an opt-in Claude Code `UserPromptSubmit` hook that heuristically scores each incoming prompt in pure JS (<100ms, no LLM call, no network), stays silent when the prompt is fine, and injects a one-line advisory into context when a task-shaped prompt scores below threshold — so the model offers to run RePrompter exactly when it would help. It converts RePrompter from a command into infrastructure, which multiplies invocations and therefore flywheel data. It must never block a prompt, never leak prompt text into telemetry, and never nag (cooldown + skip conditions).

## Current state

Relevant files (all under repo root `reprompter/`):

- `scripts/prompt-gate.js` — DOES NOT EXIST. You create it.
- `scripts/prompt-gate.test.js` — DOES NOT EXIST. You create it.
- `scripts/artifact-evaluator.js` — the repo's existing heuristic-scoring exemplar. Match its style: `"use strict"`, small pure functions, `clamp()`, regex-based feature counters, a `module.exports` block, and a `require.main === module` CLI tail. Excerpt (`scripts/artifact-evaluator.js:45-57`):

  ```js
  function scoreClarity(text) {
    const length = String(text || "").trim().length;
    const headings = extractHeadings(text).length;
    const bulletCount = (String(text || "").match(/^\s*[-*]\s+/gm) || []).length;

    let score = 2;
    if (length > 120) score += 2;
    if (length > 400) score += 1;
    if (headings >= 2) score += 3;
    if (bulletCount >= 3) score += 2;

    return clamp(score, 0, 10);
  }
  ```

- `scripts/version-check.js` — the repo's fail-soft + cache-dir exemplar. It caches under `XDG_CACHE_HOME` and documents "FAIL-SOFT: any failure resolves to 'no notice' and exit 0. A version check must never block work" (`scripts/version-check.js:10-16`). The gate follows the same rule.
- `scripts/telemetry-schema.js` — validates telemetry events. `STAGES` is a `Set` at lines 4–18 containing `"route_intent"`, `"select_patterns"`, …, `"learn_strategy"`. You will add one stage: `"gate_prompt"`. `validateEvent` requires `runId`, `taskId`, valid `stage`, valid `status`; optional `metadata` plain object passes through.
- `scripts/telemetry-store.js` — `createTelemetryStore({ rootDir | dirPath | filePath })` appends validated events as NDJSON. Default dir is `<rootDir>/.reprompter/telemetry` (`scripts/telemetry-store.js:8-15`). The gate must NOT use the default (that would write into the user's project cwd); pass an explicit `dirPath` under the gate's cache dir.
- `scripts/telemetry-store.test.js` — the test-style exemplar: `node:test`, `assert/strict`, `fs.mkdtempSync(path.join(os.tmpdir(), "rpt-…"))` for isolation. Model the new test file on it.
- `SKILL.md` — behavior spec. Frontmatter `metadata.version: 12.7.1` (line ~22) and title `# RePrompter v12.7.1` (line ~25). Section `## Settings (for Repromptverse mode)` is at line ~1570. Quality-scoring rubric at `SKILL.md:1386` defines the six dimensions and weights the gate must reuse:

  | Dimension | Weight |
  |---|---|
  | Clarity | 20% |
  | Specificity | 20% |
  | Structure | 15% |
  | Constraints | 15% |
  | Verifiability | 15% |
  | Decomposition | 15% |

- `README.md` — version badge at line 11 (`version-12.7.1-0969da`), Key Features list at ~line 306, Configuration section at ~line 380, Testing table ~line 329 (row counts + `267` total appear at lines 13, 325, 349).
- `CHANGELOG.md` — newest release entry at top. Match the existing entry format exactly (read the v12.7.1 entry before writing).
- `package.json` — `version: "12.7.1"`; `scripts.check` is a single `&&` chain of every `test:*` suite plus benchmarks.
- `package-lock.json` — version appears TWICE (top-level `version` and `packages[""].version`); both must be bumped (missing the lockfile sync was a real regression fixed in PR #56).
- `skills/reprompter/` — the generated Hermes-only install package. NEVER edit it by hand; regenerate via `npm run package:hermes` after SKILL.md changes.
- `docs/observability/system-overview.md:12` — privacy contract you must honor: "Privacy: no raw secrets, prompts, files, emails, phone numbers, webhook URLs, cookies, or raw customer ids in telemetry."

### Claude Code UserPromptSubmit hook contract (inline reference)

- The hook command receives a single JSON object on **stdin**:
  `{"session_id":"…","transcript_path":"…","cwd":"…","hook_event_name":"UserPromptSubmit","prompt":"<the user's prompt text>"}`
- Exit code 0 with non-empty **stdout** → the stdout text is injected as additional context the model sees for this prompt.
- Exit code 0 with empty stdout → no effect (silent pass).
- Exit code 2 → blocks the prompt. **The gate must NEVER exit 2.** Always exit 0.
- Users enable it by adding to `~/.claude/settings.json`:

  ```json
  {
    "hooks": {
      "UserPromptSubmit": [
        { "hooks": [ { "type": "command", "command": "node /absolute/path/to/skills/reprompter/scripts/prompt-gate.js" } ] }
      ]
    }
  }
  ```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Full gate | `npm run check` | exit 0, all suites + benchmarks pass |
| New suite only | `npm run test:prompt-gate` | exit 0 (after Step 3) |
| Template validation | `npm run validate:templates && npm run validate:tool-refs` | exit 0 |
| Hermes regen | `npm run package:hermes` | exit 0, regenerates `skills/reprompter/` |
| Hermes package check | `npm run check:hermes-package && npm run test:hermes-package` | exit 0 |

No install step is required — the repo has no runtime dependencies (`node:` builtins only). Node 20+ with `node --test` is assumed (same as every existing suite).

## Scope

**In scope** (the only files you may modify or create):

- `scripts/prompt-gate.js` (create)
- `scripts/prompt-gate.test.js` (create)
- `scripts/telemetry-schema.js` (one-line addition: `"gate_prompt"` stage)
- `package.json` (new test script + check chain + version bump)
- `package-lock.json` (version bump only, both spots)
- `SKILL.md` (new section + version bump)
- `README.md` (feature blurb, config snippet, badge, test table)
- `CHANGELOG.md` (v12.8.0 entry)
- `skills/reprompter/**` (generated only — via `npm run package:hermes`, never by hand)

**Out of scope** (do NOT touch, even though they look related):

- `TESTING.md` — scenario docs are deliberately deferred to a follow-up PR (repo precedent: CHANGELOG.md:299).
- `scripts/intent-router.js`, `scripts/outcome-*.js`, `scripts/strategy-learner.js`, `scripts/evaluate-outcome.js` — the gate does not route modes or record outcomes in v1.
- `docs/observability/*` — the contract seed stays as-is.
- `references/**`, `benchmarks/**`, `.gitattributes`, any runtime doc for Codex/Grok/Hermes/OpenClaw — the gate is Claude Code-only in v1.
- Hook auto-installation — the gate is documented as opt-in; never write to `~/.claude/settings.json`.

## Git workflow

None. Do not run git commands. The reviewer commits, pushes, and opens the PR.

## Steps

### Step 1: Create `scripts/prompt-gate.js`

Header comment must state the design rules (mirror `version-check.js`'s style): FAIL-SOFT (any internal error → empty stdout, exit 0; the gate must never block or delay a prompt), OPT-IN (only runs if the user installs the hook; `REPROMPTER_AMBIENT=0` is the kill switch), PRIVACY (raw prompt text never leaves the process — not in telemetry, not in state files), NEVER-BLOCK (exit code is always 0).

Export these functions (CommonJS, `"use strict"`, `node:` builtins only):

1. **`scorePrompt(text)`** → `{ dimensions: {clarity, specificity, structure, constraints, verifiability, decomposition}, overall, weakest }`.
   - Each dimension 0–10 via cheap heuristics in the `artifact-evaluator.js` style (feature counts + `clamp`). Suggested signals — tune freely as long as the two calibration tests in Step 3 pass:
     - *clarity*: length bands; presence of an imperative task verb; penalty for vagueness tokens (`maybe`, `somehow`, `stuff`, `etc`, `or something`, `idk`, `whatever`, `uhh`).
     - *specificity*: counts of concrete tokens — file paths (`/` or `.` inside a word), numbers, quoted strings, UPPER/CamelCase identifiers.
     - *structure*: newlines, bullet lines (`^\s*[-*]`), headings, XML-ish tags.
     - *constraints*: tokens like `must`, `only`, `never`, `don't`, `do not`, `without breaking`, `no more than`, `limit`, `preserve`.
     - *verifiability*: tokens like `test`, `verify`, `passes`, `criteria`, `expect`, `assert`, `coverage`, `should return`.
     - *decomposition*: prompts under ~25 words score 8 (correctly atomic per the SKILL.md rubric); longer prompts score on ordered markers (`then`, `after that`, `first/second`, numbered lists).
   - `overall` = weighted sum with EXACTLY the SKILL.md:1386 weights (clarity .20, specificity .20, structure .15, constraints .15, verifiability .15, decomposition .15), rounded to 1 decimal.
   - `weakest` = array of the 2 lowest-scoring dimension names.

2. **`shouldNudge(prompt, options)`** → `{ nudge: boolean, reason: string, score?: <scorePrompt result> }`. `options` = `{ env = process.env, sessionId, now = () => Date.now(), statePath }` (all injectable for tests). Skip (nudge:false) in this order, with these reason strings:
   - `"disabled"` — `env.REPROMPTER_AMBIENT === "0"`.
   - `"slash-command"` — trimmed prompt starts with `/` or `!`.
   - `"too-short"` — trimmed length < 40 chars.
   - `"acknowledgement"` — matches `^(yes|no|ok(ay)?|sure|continue|go ahead|thanks?|ty|lgtm|approved?|evet|tamam|devam|olur)\b` (case-insensitive).
   - `"mentions-reprompt"` — contains `reprompt` (case-insensitive) — the user is already invoking the skill.
   - `"not-a-task"` — contains none of the imperative task verbs: `build, create, add, fix, implement, refactor, migrate, write, make, update, improve, optimize, deploy, integrate, convert, design, set up, setup, debug, investigate, audit, review` (word-boundary, case-insensitive).
   - `"above-threshold"` — `scorePrompt(prompt).overall >= threshold`, where threshold = `Number(env.REPROMPTER_AMBIENT_THRESHOLD)` if finite else `5`.
   - `"cooldown"` — a nudge was already issued for this `sessionId` within the last N minutes, N = `Number(env.REPROMPTER_AMBIENT_COOLDOWN_MIN)` if finite else `15`.
   - Otherwise `{ nudge: true, reason: "below-threshold", score }`.

3. **Cooldown state** — small JSON map `{ "<sessionId>": "<ISO timestamp of last nudge>" }` at `statePath`, defaulting to `$XDG_CACHE_HOME/reprompter/ambient-gate.json` with fallback `~/.cache/reprompter/ambient-gate.json` (same cache-root convention as `version-check.js`). On write, prune entries older than 24h. All reads/writes wrapped in try/catch (fail-soft: unreadable state = no cooldown, unwritable state = still nudge).

4. **`buildNudge(scoreResult)`** → the single-line advisory string, addressed to the model (it lands in Claude's context, not the user's screen):

   ```
   <reprompter-ambient-gate>Heuristic prompt quality: {overall}/10 (weakest: {dim1}, {dim2}). If this request is a nontrivial task, briefly offer ONCE to structure it first via the reprompter skill (user can say "reprompt this"); if the user declines or the task is trivial, proceed normally and never mention this gate again this session.</reprompter-ambient-gate>
   ```

5. **CLI entry (`require.main === module`)** — two modes:
   - `--score "<text>"`: print `JSON.stringify(scorePrompt(text), null, 2)` and exit 0 (debug aid).
   - Default (hook mode): read all of stdin, `JSON.parse` it, take `.prompt` and `.session_id`, run `shouldNudge`; if nudge, write the advisory to stdout and record the cooldown timestamp; **optionally emit telemetry (see Step 2) regardless of nudge decision**; exit 0. ANY thrown error anywhere → print nothing, exit 0. Malformed/empty stdin → print nothing, exit 0.

**Verify**: `echo '{"session_id":"s1","prompt":"uhh build a crypto dashboard, maybe coingecko data, add caching, test it too"}' | node scripts/prompt-gate.js` → prints one `<reprompter-ambient-gate>…</reprompter-ambient-gate>` line, exit 0. Then `echo 'not json' | node scripts/prompt-gate.js` → prints nothing, exit 0. Then `echo '{"session_id":"s1","prompt":"yes"}' | node scripts/prompt-gate.js` → prints nothing, exit 0.

### Step 2: Telemetry emission (privacy-safe, optional)

1. In `scripts/telemetry-schema.js`, add `"gate_prompt"` to the `STAGES` set (one line, keep alphabetical-ish placement near the end of the list).
2. In `prompt-gate.js` hook mode, when `env.REPROMPTER_TELEMETRY !== "0"`, wrap in try/catch: `createTelemetryStore({ dirPath: <gate cache dir>/telemetry }).writeEvent({ runId: "gate-" + sessionId, taskId: "ambient-gate", stage: "gate_prompt", status: "ok", metadata: { overall, weakest, nudged, reason } })`. The metadata must contain ONLY those numeric/enum fields — **never the prompt text or any substring of it** (privacy contract, `docs/observability/system-overview.md:12`). Telemetry failure must not affect the hook result.

**Verify**: `npm run test:telemetry-schema` → exit 0 (additive stage change breaks nothing).

### Step 3: Create `scripts/prompt-gate.test.js`

Model structure on `scripts/telemetry-store.test.js` (`node:test`, `assert/strict`, `mkdtempSync` temp dirs). Cover at minimum:

1. **Calibration low**: the README's rough exemplar `"uhh build a crypto dashboard, maybe coingecko data, add caching, test it too"` → `scorePrompt().overall < 5`.
2. **Calibration high**: a structured prompt containing role/task/constraints/success-criteria sections, file paths, and test commands (write ~15 lines inline) → `overall >= 7` and strictly greater than the rough exemplar's.
3. **Every skip reason**: one assertion per reason string in Step 1 (`disabled`, `slash-command`, `too-short`, `acknowledgement`, `mentions-reprompt`, `not-a-task`, `above-threshold`, `cooldown`) using injected `env`/`statePath`/`now`.
4. **Cooldown behavior**: first `shouldNudge` → nudge true; second within 15 min (injected `now`) → `reason: "cooldown"`; third after 16 min → nudge true again.
5. **Hook CLI contract** via `child_process.execFileSync(process.execPath, ["scripts/prompt-gate.js"], { input, env })`: low-quality JSON → stdout contains `<reprompter-ambient-gate>`; high-quality → empty stdout; malformed stdin → empty stdout, exit 0; `REPROMPTER_AMBIENT=0` → empty stdout. Point `XDG_CACHE_HOME` at a temp dir in every spawn so tests never touch the real cache.
6. **Privacy**: after a spawned run with telemetry enabled and `XDG_CACHE_HOME` in a temp dir, read the events NDJSON and assert it does NOT contain the distinctive prompt substring (e.g. `"crypto dashboard"`) but DOES contain `"gate_prompt"`.

Add to `package.json`: `"test:prompt-gate": "node --test scripts/prompt-gate.test.js"` and insert `npm run test:prompt-gate &&` into the `check` chain immediately after `npm run test:version-check`.

**Verify**: `npm run test:prompt-gate` → exit 0, all tests pass.

### Step 4: Documentation

1. **SKILL.md**: bump frontmatter `version: 12.8.0` and title to `# RePrompter v12.8.0`; extend the header blurb's version sentence with one clause about v12.8.0 (match the existing sentence style). Insert a new section `## Ambient Prompt Gate (opt-in UserPromptSubmit hook — Claude Code only)` immediately BEFORE `## Settings (for Repromptverse mode)`. Content: what it does (scores every prompt heuristically, injects a one-line advisory only for task-shaped prompts below threshold), that it NEVER blocks a prompt and is fail-soft, the settings.json install snippet from "Current state" above, the env flags table (`REPROMPTER_AMBIENT`, `REPROMPTER_AMBIENT_THRESHOLD`, `REPROMPTER_AMBIENT_COOLDOWN_MIN`, `REPROMPTER_TELEMETRY`), the privacy guarantee (no prompt text in telemetry or state), and a note that other runtimes (Codex hooks, Hermes) are a documented follow-up.
2. **README.md**: badge → `version-12.8.0-0969da`; add a `**Ambient Prompt Gate (v12.8)**` paragraph to Key Features (match the bold-lead style of the flywheel entries); add the hook install snippet under Configuration; add a `| Prompt gate | N |` row to the Testing table and update the total count (line 13 badge and line 349) to the REAL number from `npm run check` output.
3. **CHANGELOG.md**: add a v12.8.0 entry at the top matching the existing entry format (read the v12.7.1 entry first). Mention: new lane-adjacent ambient gate, new `gate_prompt` telemetry stage, opt-in + fail-soft + privacy-safe, Claude Code only, TESTING.md scenarios deferred to follow-up.
4. **package.json / package-lock.json**: version → `12.8.0` (lockfile in BOTH spots).

**Verify**: `grep -c "12.8.0" package.json package-lock.json SKILL.md README.md` → package.json:1, package-lock.json:2, SKILL.md:≥2, README.md:≥1. Then `npm run validate:templates && npm run validate:tool-refs` → exit 0.

### Step 5: Regenerate the Hermes package and run the full gate

1. `npm run package:hermes` → exit 0 (regenerates `skills/reprompter/` from the edited SKILL.md).
2. `npm run check:hermes-package` → exit 0.
3. `npm run check` → exit 0, every suite and benchmark passing. Note the new total test count for README accuracy (fix the README number now if it differs from what you wrote in Step 4).

**Verify**: `npm run check` → exit 0.

## Test plan

Covered by Step 3 (new `scripts/prompt-gate.test.js`, ≥14 tests: 2 calibration, 8 skip reasons, cooldown sequence, 4+ CLI contract, 1 privacy). Pattern file: `scripts/telemetry-store.test.js`. Verification: `npm run test:prompt-gate` then `npm run check`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0.
- [ ] `echo '{"session_id":"s1","prompt":"uhh build a crypto dashboard, maybe coingecko data, add caching, test it too"}' | XDG_CACHE_HOME=$(mktemp -d) node scripts/prompt-gate.js` prints a `<reprompter-ambient-gate>` line and exits 0.
- [ ] Same command with `REPROMPTER_AMBIENT=0` prints nothing and exits 0.
- [ ] `echo 'garbage' | node scripts/prompt-gate.js` prints nothing and exits 0.
- [ ] After the previous low-quality run, `grep -r "crypto dashboard" "$XDG_CACHE_HOME"` returns no matches (prompt text never persisted).
- [ ] `grep -n "gate_prompt" scripts/telemetry-schema.js` → exactly one match inside `STAGES`.
- [ ] Versions consistent at 12.8.0: `package.json`, `package-lock.json` (both spots), `SKILL.md` frontmatter + title, README badge.
- [ ] `git status --porcelain` shows only in-scope files (plus regenerated `skills/reprompter/**`).

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows in-scope files changed since commit `5634317`.
- `npm run check` fails on a suite you did NOT touch (pre-existing breakage — report it, don't fix it).
- `npm run package:hermes` or `npm run check:hermes-package` fails after your SKILL.md edit (the sanitizer may need a rule change — that is reviewer territory).
- Adding `"gate_prompt"` to `STAGES` breaks any existing telemetry/observability test.
- You find an existing prompt-gate/ambient implementation anywhere in `scripts/` (means this plan is stale).
- The calibration tests (Step 3, items 1–2) cannot both pass after two tuning attempts on the heuristics.

## Maintenance notes

- **Follow-ups deliberately out of scope**: TESTING.md scenarios; Codex/Hermes hook equivalents; auto-recording outcomes on `Stop` hooks (feeds the flywheel end-to-end); wiring gate scores into `strategy-learner.js`.
- **Reviewer scrutiny points**: the nudge advisory wording (it instructs the model — tone matters); threshold default of 5 (too high = nag, too low = dead feature); that no code path can `process.exit(2)`; that telemetry metadata provably excludes prompt text.
- **Interaction risk**: if Claude Code changes the UserPromptSubmit stdin schema, the gate silently no-ops (fail-soft) — the version-check hook has the same exposure and precedent.
