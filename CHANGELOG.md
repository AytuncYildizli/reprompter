## v12.9.0 (2026-07-02) — Claude Code plugin distribution

### Headline

RePrompter now ships as a Claude Code plugin. Claude Code users can add the repo as a marketplace and install `reprompter@reprompter` to get both the skill and the Ambient Prompt Gate hook registered automatically. This is additive and Claude Code-only: Codex, OpenClaw, Grok CLI, and Hermes Agent install paths are unchanged.

### Added

- Generated Claude Code plugin package at `plugin/` with `.claude-plugin/plugin.json`, `hooks/hooks.json`, and a plugin-local `skills/reprompter/` mirror generated from root sources.
- Repo marketplace manifest at `.claude-plugin/marketplace.json`.
- `scripts/package-plugin.*`, `scripts/check-plugin-package.sh`, and `scripts/plugin-package.test.js` to keep plugin manifests and generated contents deterministic and structurally verified.

### Changed

- `scripts/version-check.js` detects plugin-layout installs and stays silent there, because Claude Code's native plugin update mechanism owns freshness.
- `README.md` and `SKILL.md` make the Claude Code plugin the recommended install path, keep copy-based install as fallback, and document the personal-skill shadowing migration note plus the `REPROMPTER_AMBIENT=0` per-feature off switch.
- `.gitattributes` excludes `plugin/` and `.claude-plugin/` from source archives. Plugin installs are git-clone based through Claude Code marketplace, so archive installs remain runtime-only.
- `package.json`, `package-lock.json`, generated plugin, and generated Hermes package — version `12.9.0`.

## v12.8.0 (2026-07-02) — Ambient Prompt Gate

### Headline

RePrompter now has an opt-in **Ambient Prompt Gate** for Claude Code `UserPromptSubmit` hooks. The gate scores each incoming prompt with cheap local heuristics, stays silent for healthy or non-task prompts, and injects one model-facing advisory only when a task-shaped prompt falls below threshold. It is lane-adjacent infrastructure rather than a new output lane: it nudges users toward RePrompter at the moment a weak prompt would benefit from structure.

### Added

- `scripts/prompt-gate.js` — fail-soft, privacy-safe hook helper. It never exits 2, never blocks a prompt, never calls the network, and persists only cooldown timestamps under the user's cache directory. `REPROMPTER_AMBIENT=0` disables nudges, `REPROMPTER_AMBIENT_THRESHOLD` tunes the score threshold, and `REPROMPTER_AMBIENT_COOLDOWN_MIN` controls per-session cooldown.
- `scripts/prompt-gate.test.js` — calibration, skip-reason, cooldown, CLI contract, and privacy coverage for the hook.
- `gate_prompt` telemetry stage — optional local telemetry records only numeric/enum metadata (`overall`, `weakest`, `nudged`, `reason`) plus a hashed session correlation id, and never records prompt text.

### Changed

- Ambient Prompt Gate now skips concise direct atomic tasks while keeping vague concise prompts nudgeable with bilingual English/Turkish vagueness detection.
- `SKILL.md` and `README.md` — document the Claude Code-only install snippet, fail-soft behavior, privacy guarantee, and env flags. Codex hooks, Hermes support, and TESTING.md scenario docs are deliberately deferred to follow-up work.
- `package.json`, `package-lock.json`, generated Hermes package — version `12.8.0`; `npm run check` now includes `test:prompt-gate`.

## v12.7.1 (2026-06-10) — Runtime-only source archives

### Headline

Copy-based installs (Claude Code, Codex, OpenClaw, Grok CLI) fetched the full repo tarball, which nested the generated Hermes-only `skills/reprompter/` package (1,806-line `SKILL.md` + `references/` tree) plus `benchmarks/`, `assets/`, and `docs/` inside every install — and the version-check upgrade command re-introduced them on every update. This release makes GitHub source archives **runtime-only** at the source: `.gitattributes` `export-ignore` strips dev/dist trees from `archive/*.tar.gz` and "Download ZIP", so every documented install/upgrade command stays a plain `curl | tar` and existing installs self-heal on their next upgrade (old copies' upgrade commands now fetch a clean tarball; leftover dirs are safe to delete).

### Added

- `.gitattributes` — `export-ignore` for `/skills`, `/benchmarks`, `/assets`, `/docs`, `/.github`. Hermes is unaffected: `hermes skills install` fetches through the GitHub Trees/Contents API, which ignores `export-ignore`; the committed `skills/reprompter/` package on `main` is unchanged.

### Changed

- `README.md` — install section notes that archives are runtime-only and that older full installs can safely delete `skills/`, `benchmarks/`, `assets/`, `docs/`; the manual Hermes copy path now starts from a `git clone` (archives no longer contain `skills/`); version badge `12.7.1`.
- `SKILL.md`, `package.json`, `package-lock.json` — version `12.7.1`; Hermes package regenerated.

## v12.7.0 (2026-05-31) — Version self-check

### Headline

RePrompter is distributed copy-based with no package manager tracking the installed version, so a stale copy is invisible to the user. This release adds a **fail-soft version self-check**: on the first invocation in a session, RePrompter compares its local `SKILL.md` version against the latest GitHub release and surfaces an update notice (with a path-aware upgrade command) if the copy is behind. Fully additive and off-switchable; no output lane changes.

### Added

- `scripts/version-check.js` — pull-based check (`checkVersion`, `compareVersions`, `readLocalVersion`, `formatNotice`). Reads local `metadata.version` from `SKILL.md`, resolves the latest release via the GitHub API, and prints an actionable notice only when behind. The upgrade command is **path-aware and runtime-agnostic**: it re-fetches into the directory this skill copy actually lives in (derived from `__dirname`), so it targets the right place for Claude Code (`~/.claude/skills/...`), Codex (`~/.codex/skills/...`), OpenClaw, Grok CLI, or a project-local `skills/reprompter/` alike — with a `hermes skills install` line for the one runtime that ships no `scripts/`. Always says to start a new session (skills are cached per session). **Fail-soft**: offline / rate-limited / unparseable → no output, exit 0. Result cached ~24h under `XDG_CACHE_HOME`; a failed lookup is negatively cached ~1h to throttle retries without suppressing the check for a full day. `REPROMPTER_VERSION_LATEST` is a manual/offline override; `--json` and `--no-cache` CLI flags.
- `scripts/version-check.test.js` — 19 tests (semver compare incl. numeric 12.10 > 12.7, local-version read, behind/equal/ahead, network-failure + thrown-fetch fail-soft, fresh-cache short-circuit + stale-cache refresh + repo-scoped cache, shell-safe install-dir quoting, REPROMPTER_REPO sanitization, REPROMPTER_VERSION_CHECK=0 opt-out, CLI silent-when-current/behind paths). No test touches the network or the real cache (all deps injected).

### Changed

- `SKILL.md` — new "Version self-check" subsection + `REPROMPTER_VERSION_CHECK=0|1` env var (default on); version bumped to `12.7.0`. Because the skill is cached per session, the notice tells the user to update **and start a new session**.
- `scripts/hermes-sanitizer.json` — rewrites `node scripts/version-check.js` for the Hermes artifact (the package ships no `scripts/`).
- `package.json` — `test:version-check` registered and added to the `check` gate; version `12.7.0`.
- `README.md` — "Staying current" install section (manual run, `--json`, opt-in Claude Code `SessionStart` hook), version badge `12.7.0`, test table (Version check = 19; total 267).

### Review hardening (Codex)

- **[security] No shell injection in the printed upgrade command:** `REPROMPTER_REPO` is validated to a strict `owner/repo` shape (junk falls back to the default) and the install dir is POSIX single-quoted, so a copy-pasteable `curl | tar` line can't trigger `$()`/backtick expansion from a crafted path or env value.
- **Opt-out honored on direct invocation:** `main()` early-returns silently when `REPROMPTER_VERSION_CHECK=0`, so the README `SessionStart` hook and manual runs respect the documented off-switch (previously only the skill-preflight path did).
- **Silent when current:** the default (non-`--json`) path prints only when behind; up-to-date and undeterminable both produce no output, matching the documented contract and keeping session hooks quiet. `--json` remains the explicit status mode.
- **Repo-scoped cache:** the cache payload carries `repo`, and entries from a different `REPROMPTER_REPO` are ignored, so a fork override can't reuse another repo's `latest` (pre-repo entries honored only for the default repo).
- **Truly fail-soft:** `await fetchLatest()` is wrapped in try/catch so a synchronous rejection can't bubble past the "never throws" contract.

## v12.6.0 (2026-05-30) — Claude dynamic Workflow lane + Option H, first-class ultracode

### Headline

RePrompter gains a fifth output lane, **Workflow preflight**, and a matching Repromptverse Phase-3 backend, **Option H**, targeting Claude Code's dynamic `Workflow` tool. A reprompted task compiles into a runnable `.workflow.js` (JS-scripted background fan-out — `agent()`/`parallel()`/`pipeline()` with schema-validated returns and `resumeFromRunId`). **Schema returns are the single in-run source of truth**; the `/tmp/rpt-*.md` files become a parent-written compatibility mirror, so Status Line / Phase-4 / flywheel keep working. Ultracode is first-class: the emitted script defaults to adversarial / perspective-diverse verify + completeness critic + budget-scaled fleets, with a `--no-ultracode` off-ramp.

Fully additive — no behavior change for Codex, Grok CLI, Hermes Agent, OpenClaw, or the existing Claude Code Options A/B.

### Added

- **Workflow preflight lane (Lane 5)** in `SKILL.md` — triggers, runtime detection, Process, a 12-row Workflow Command Card, the emitted-script shape, the expanded-prompt XML basis, and the schema-truth / parent-mirror reconciliation.
- **Repromptverse Option H** — new Order-4 row in the Phase-3 auto-pick tree (just below Option B; the Workflow tool has no mid-run cross-agent messaging), plus an Option H subsection with the H1/H2/H3 pattern table.
- `scripts/workflow-command.js` — the compiler (`buildWorkflowCommand`, `buildWorkflowScript`, `parseBudget`) emitting a `reprompter.workflow_command.v1` packet and a determinism-safe script (pure-literal `meta`, `runId`/`taskname` from `args`, `model` omitted, `filter(Boolean)`, bounded delta-retry; ultracode adds adversarial verify + completeness critic). Reuses `goal-command` risk logic; high-risk forbidden surfaces block emission.
- `scripts/workflow-command.test.js` — 20 tests (versioned packet, risk gate, boundary handling, phase-title/no-drift, determinism, ultracode body, budget wiring, CLI artifacts incl. out-dir/script-path consistency + symlink guard; emitted scripts syntax-checked inside the workflow async wrapper).
- `references/runtime/claude-workflow-runtime.md` — runtime contract (when-to-pick vs A/B, invocation/resume, concurrency, retries, gotchas, schema-vs-file reconciliation, ultracode, what-it-does-not-provide).
- `references/workflow-template.md` — dual-block (expanded-prompt XML + compiled `.workflow.js` skeleton).

### Changed

- `scripts/intent-router.js` — new `mode: "workflow"` route (multi-word triggers only; never bare "workflow"/"parallel"), priority just after reverse and before multi-agent; `WORKFLOW_LANE_TRIGGERS` exported. +3 tests (now 25).
- `scripts/goal-command.js` — exports `hasBoundaryMarkerNear` so the workflow compiler reuses the same boundary-aware risk logic (also carries the in-flight negation-aware risk refinement).
- `scripts/hermes-sanitizer.json` — packages the two new reference docs and rewrites `scripts/workflow-command.js` references for the Hermes skill artifact.
- `package.json` — `test:workflow-command` registered and added to the `check` gate; version `12.6.0`.
- `README.md` — Workflow preflight lane, Option H compatibility row + parallel-path note, test table (Workflow command = 20; total 248).

### Ultracode & budget scaling

Ultracode is a **compile-time switch** (`REPROMPTER_ULTRACODE` / `--ultracode`, off via `--no-ultracode`) that selects which body `buildWorkflowScript` emits — it does not run anything itself. As shipped:

- **Lean body (off-ramp):** `parallel()` fan-out → bounded delta-retry (≤2 per role). For trivial reprompts.
- **Ultracode body:** fan-out → **adversarial / perspective-diverse verify** → **completeness critic**. Each surviving finding is judged by three *distinct* lenses (`correctness` / `completeness` / `risk`) returning a `VERDICT_SCHEMA {refuted, reason}`; a finding is kept only on **≥2/3 non-refutation**, and verifiers "default `refuted=true` if uncertain".
- **Agent-count safety (respects the Workflow 1000-agent lifetime cap):** each role's findings are bounded by `maxItems: 20`; the verify panel is capped at `VERIFY_CAP = 24` (≤72 verify agents). A broad audit (~334 findings × 3 = ~1000) would otherwise exhaust the run before the critic — truncation is `log()`'d, never silent.
- **Budget scaling (H3, as shipped):** the completeness critic runs only with token headroom — gated on `!budget.total || budget.remaining() > 30000` — so the extra thoroughness pass dials *off* near the ceiling. (The compiler does **not** scale the fleet size by budget; the roster is fixed to the reprompted roles. The caps + critic-gate are the scaling levers.)
- **Budget flow:** `parseBudget` recognizes only **unambiguous cues** — the `+Nk` form or the literal `budget:` / `token budget` keyword — clamped to `BUDGET_MAX` (100M). A bare `Nk tokens` is intentionally **not** a cue (ambiguous with token exfiltration). The parsed total rides the emitted command as `args.budget`; the script sources `budgetTotal = budget.total || args.budget`, **preferring the live Workflow `budget` global** (real run-level spend tracking) over the args hint, and surfaces it in the returned `reprompter.workflow_outcome.v1` payload.

### Review hardening (21 droid + Codex cycles)

- **Risk gate** (shared `inferRisk`, used by both `/goal` and the Workflow lane): occurrence-aware governance (a boundary marker clears a forbidden surface only when it *directly governs* it); plural surfaces (`cookies`/`tokens`/`secrets`); `block`/`blocked` dropped as markers (imperative, not constraint); clause breaks (`; : . ! ?` and comma) stop the governance walk; long same-clause exclusion lists clear (no hop cap); and an **exfiltration re-check** (`extract`/`read`/`steal`/… co-occurring with `tokens` forces high-risk even after budget stripping).
- **CLI / safety:** the emitted `script_path` always matches where the script is actually written (out-dir, both-flags, and no-out-dir paths); atomic `O_NOFOLLOW` write (mode `0600`) closes the predictable-`/tmp` symlink-clobber/TOCTOU vector; task names carry a deterministic hash suffix so distinct jobs don't overwrite each other or resume the wrong run; the in-script taskname fallback equals the bare `args` value (resume id stability); and the workflow lane preserves the underlying team/profile routing instead of collapsing to a generic pair.

### Notes

- `Workflow`-tool detection is by tool presence; absent it, RePrompter falls back to Repromptverse Option B/A or the `/goal` preflight lane.
- Design rationale lives in `docs/dynamic-workflow-expansion.md`; runtime contract in `references/runtime/claude-workflow-runtime.md`.
- **Fix:** the v12.6.0 trigger additions pushed the SKILL.md frontmatter `description` to 1198 chars; runtimes with a 1024 cap (e.g. Codex) silently skipped the skill. Trimmed to 888 chars, and `validate:tool-refs` now fails if the (root or packaged) description exceeds 1024 so it can't regress.

## v12.5.1 (2026-05-18) — Hermes install package

### Headline

RePrompter now ships a Hermes-specific install package at `skills/reprompter/` so Hermes Agent v0.14 can install the skill through Skills Guard without `--force`.

The root `SKILL.md` remains canonical for Claude Code, Codex, OpenClaw, Grok CLI, and direct repository browsing. The Hermes package is generated from root content, sanitized only for Hermes Guard, and CI-gated to prevent drift.

### Added

- Generated Hermes package at `skills/reprompter/` with `SKILL.md`, runtime references, and a manifest recording source and sanitizer hashes.
- Hermes package scripts for generation, drift checks, and pinned Guard verification.
- CI workflow that verifies the generated package and runs Hermes Skills Guard against it.

### Changed

- README now documents `hermes skills install AytuncYildizli/reprompter/skills/reprompter` as the deterministic Hermes install path.
- README warns against using the two-part Hermes identifier because it can resolve stale marketplace content.

### Notes

- This release keeps the v12.5.0 runtime behavior intact. It only fixes the Hermes install artifact and Guard compatibility path.
- Non-Hermes installs still use the root skill layout.

## v12.5.0 (2026-05-15) — Hermes Agent runtime support

### Headline

RePrompter now supports Nous Research's Hermes Agent as a first-class runtime. Hermes users get `/goal` preflight support, Repromptverse Option G auto-selection via `delegate_task`, and a runtime reference that distinguishes short fork/join delegation from durable Kanban orchestration.

Docs + skill release. No JS runtime adapter, dependency, template validation, or CI behavior changes.

### Added

- **Hermes Agent runtime support (Option G)** — Additive Repromptverse support for Hermes Agent through three paths:
  - **G1 `delegate_task` batch** for normal in-session parallel Repromptverse runs.
  - **G2 shell-level `hermes -z` / `hermes chat -q`** for external orchestration with per-worker logs.
  - **G3 Hermes Kanban** for durable, restart-surviving, multi-profile workflows when explicitly requested.
- **Hermes `/goal` preflight support** — The `/goal` lane now recognizes explicit "Hermes /goal" requests and emits the same compressed `/goal <objective>` command shape used by Codex CLI and Claude Code CLI.
- New `references/runtime/hermes-agent-runtime.md` documenting Hermes-specific `/goal`, `delegate_task`, Kanban, shell-level execution, artifact contracts, status lines, retries, and known gotchas.
- **Phase 3 Runtime auto-pick decision tree** updated with an explicit Hermes tool-surface check (`delegate_task` plus at least two file/terminal/skill/todo tools) so Hermes sessions select **Option G** instead of falling through to sequential mode.

### Changed

- README, SKILL frontmatter, Repromptverse templates, and TESTING scenarios now list Hermes Agent alongside Claude Code, OpenClaw, Codex, and Grok CLI where applicable.
- `/goal` ambiguous-runtime prompts now offer three valid choices: Codex CLI, Claude Code CLI v2.1.139+, and Hermes Agent.
- Version aligned across `package.json`, SKILL.md frontmatter, SKILL.md header, and README badge at `12.5.0`.

### Notes

- Grok CLI still has no `/goal` surface, so Grok users remain on Single mode or Repromptverse Option F.
- Hermes `delegate_task` children start with fresh context and only receive the `goal` / `context` fields provided by the parent; the new runtime reference calls this out explicitly to avoid missing-context failures.
- Hermes Kanban is documented but not auto-selected by default because it is a durable workflow surface, not the normal short Repromptverse path.

## v12.4.0 (2026-05-15) — Grok CLI runtime support

### Headline

RePrompter now supports Grok CLI as a first-class Repromptverse runtime. Grok sessions can auto-select Option F, run parallel workers through `spawn_subagent` or shell-level `grok -p`, and keep the same artifact contract used by the other runtimes.

Docs + skill release. No JS runtime adapter, dependency, template, test, or CI behavior changes.

### Added

- **Grok CLI runtime support (Option F)** — Full additive support for Grok 4.3+ (April 2026) via `spawn_subagent` (F1: in-session parallel with `subagent_type`, `persona`, `fork_context=true`, `capability_mode`) and shell-level `grok -p "..." --yolo --sandbox workspace &` + `wait` (F2).
  - New `references/runtime/grok-cli-runtime.md` (exact structural match to `codex-runtime.md`).
  - Self-contained "Grok CLI Support" section appended at EOF of SKILL.md.
  - **Phase 3 Runtime auto-pick decision tree** updated with explicit Order-1 Grok detection (`spawn_subagent` plus at least two of `run_command`, `todo_write`, `ask_user_question`) so Option F is now **automatically selected** on Grok CLI (addresses Codex P1 review on PR #50). Previously the flow would have fallen through to Option E.
  - All existing behavior, text, templates, and output formats for Claude Code, Codex, and OpenClaw remain 100% unchanged. Non-Grok users experience zero difference.

### Notes
- Purely additive runtime release. The skill remains fully backward-compatible.
- Existing installs in `~/.claude/skills/reprompter/` continue to work (Grok automatically loads skills from the Claude compatibility path). New recommended location for Grok users: `~/.grok/skills/reprompter/`.
- No changes to any JS runtime adapter, dependencies, tests, or CI workflows.
- Version aligned across `package.json`, SKILL.md frontmatter, SKILL.md header, and the README badge at `12.4.0`.

# RePrompter Changelog

## v12.3.0 (2026-05-13) — `/goal` preflight on Claude Code CLI

### Headline

The `/goal` preflight lane is no longer Codex-only. Claude Code CLI shipped a native `/goal` slash command in **v2.1.139 on 2026-05-11** (v2.1.140 followed with a clearer error message when hook-restricting settings disable `/goal` — see below), so the v12.2 compression flow — infer intent → expanded prompt → dense `/goal <summary of expanded prompt>` command — now applies to both Codex and Claude Code without skill behavior changes. The Card stays the same shape; only the `Runtime` field and the Setup check block branch on the detected runtime.

Docs-only release. No script behavior changes; `scripts/goal-command.js --target claude-code` is planned as a follow-up release.

### Added

- **Runtime detection table** in the `/goal` preflight lane mapping user signals to runtime: explicit "Codex /goal" → Codex CLI, "Claude Code /goal" → Claude Code CLI (≥ v2.1.139), bare "/goal" → ASK with two options.
- **Runtime-specific operational notes** in the lane: Claude Code `/goal` is thread-persistent (survives `/resume`, terminal close, context compaction), uses a Haiku evaluator that judges only what's surfaced in the transcript, supports `/goal pause` / `/goal resume`, and depends on the hooks layer (`disableAllHooks` / `allowManagedHooksOnly` disable `/goal` entirely on any version; v2.1.140 only changed the failure mode from a silent hang to a clear error message). Codex notes preserved as before.
- **Setup check** subsection split into Codex (`codex features list | grep '^goals'` + `features.goals = true`) and Claude Code (`claude --version` ≥ 2.1.139, no config flag).
- **Frontmatter `description:` triggers** "/goal preflight" and "Claude Code /goal" added alongside the existing Codex triggers. Total frontmatter stays under the 1024-char Codex skip threshold (v12.1.0 fix preserved).
- **README Claude Code install hint** for the CLI version pin needed for `/goal`.
- **Compatibility table** in README upgraded — `/goal` preflight row now checks Claude Code in addition to Codex, with a footnote on the v2.1.139 version pin and the hooks-layer dependency (managed environments that block hooks fall back to Single mode for goal-shaped work).
- **TESTING.md scenario 14b** parameterized to cover either runtime; new **scenario 14c** added specifically for Claude Code `/goal` (Haiku evaluator visibility, thread persistence, pause/resume mentions).

### Changed

- **Lane title**: "Lane: Codex `/goal` preflight" → "Lane: `/goal` preflight" (runtime-agnostic).
- **"Four output lanes" table** row renamed from "Codex Goal" to "`/goal` preflight" with both runtimes named in the description.
- **Goal Command Card `Runtime` field** values widened from `Codex CLI only` to `Codex CLI` or `Claude Code CLI (≥ v2.1.139)`. Card schema unchanged.
- **Goal Command Card `Mode` field** value normalized from `Codex /goal preflight` to `/goal preflight`.
- **Frontmatter `compatibility:`** rewritten — `/goal` preflight is no longer "Codex CLI only because /goal is a Codex slash command"; it works on Codex CLI and Claude Code CLI v2.1.139+, both consuming the same `/goal <objective>` shape. Disabled on Claude surfaces without `/goal` support and on OpenClaw.
- **SKILL.md Codex CLI Settings table** — the `features.goals` row now cross-links to Claude Code's native `/goal` (no config flag) so readers don't think Codex setup is the only path.
- **Version aligned** across `package.json`, SKILL.md frontmatter, SKILL.md header, and the README badge at `12.3.0`.

### Preserved

- All v12.2 triggers ("before /goal", "for /goal", "Codex /goal", "Codex goal prompt") still route the lane.
- Compression rule unchanged — both runtimes consume the same `/goal <objective>` single-argument shape, so the dense one-line summary is portable across CLIs.
- Goal Command Card field schema unchanged (additive value vocabulary only).
- `scripts/goal-command.js --target codex` behavior unchanged. Same artifact text pastes directly into Claude Code's `/goal`; a `--target claude-code` alias is flagged for a follow-up release.

### Verified

- Local Claude Code CLI v2.1.139 release notes confirm `/goal <objective>` shape and Haiku evaluator behavior; CHANGELOG entry references the published version.
- Local Codex CLI alpha binary still exposes `Usage: /goal <objective>` (unchanged from v12.2 verification).
- SKILL.md frontmatter `description:` re-measured under 1024 chars after trigger additions.
- No script files modified — `scripts/goal-command.js` and its test suite unchanged.
- Re-grep of SKILL.md for stale `Codex CLI only` claims in the lane section confirms zero matches outside the historical CHANGELOG block.

### What's next (deliberately out of scope)

- `scripts/goal-command.js --target claude-code` and matching test coverage — flagged for a follow-up release so this release stays docs-only.
- A Card preview that side-by-sides Codex and Claude Code Cards for the same input — nice-to-have for the README, follow-up.

## v12.2.0 (2026-05-05) — Codex `/goal` preflight

### Headline

RePrompter now has a dedicated Codex `/goal` preflight lane. Instead of handing Codex a rough wish, users can run RePrompter first so it infers the user's intent, builds the expanded prompt, and returns an exact `/goal <summary of expanded prompt>` command aligned with the alpha goal surface.

Docs + skill release. No runtime dependencies added.

### Added

- **Codex Goal Command Card** — a mandatory Codex-only preflight card for `/goal` prompts with the exact `/goal <summary of expanded prompt>` command, inferred objective, explicit Codex CLI runtime, expanded-prompt provenance, mode, paste destination, risk level, missing inputs, verification checks, and before/after quality score.
- **`/goal` trigger routing** in SKILL.md frontmatter for `before /goal`, `for /goal`, `Codex /goal`, and `goal prompt`.
- **Codex setup verification** in README and runtime docs: `npm install -g @openai/codex@latest`, `codex features list | grep '^goals'`, and `features.goals = true` when the installed CLI gates `/goal`.
- **User-facing README example** showing the Goal Command Card plus the native `/goal` command populated with a dense summary of the expanded prompt.
- **Runtime reference contract** documenting that RePrompter is a preflight step, not an automatic slash-command interceptor.

### Changed

- Version aligned across README badge, SKILL metadata/header, and `package.json` at `12.2.0`.
- SKILL.md frontmatter description was tightened to stay below Codex's 1024-character skill-description limit while adding the new `/goal` triggers.

### Verified

- `codex --version` with the local alpha build that exposes `goals`.
- `codex features list | grep '^goals'` reports `experimental true`.
- `codex login status` remains ChatGPT/OAuth.
- Local alpha binary strings show `Usage: /goal <objective>`, `ThreadGoal.objective`, `tokenBudget`, `/goal pause`, `/goal resume`, and `/goal clear`; the release docs now target that shape instead of a multiline paste-after-command flow.
- `codex exec --ephemeral --sandbox read-only ... 'reprompt this for Codex /goal: ...'` produced the required Codex Goal Command Card and exact one-line `/goal` command populated with a dense summary of the expanded prompt.
- Self-test prompt `reprompt this for Codex /goal: make RePrompter better` produced a Codex-only card with `Runtime: Codex CLI only`, `Compressed From: Expanded RePrompter prompt`, a dense summary-style `/goal` command, and a separate XML-style expanded prompt basis for improving RePrompter itself.
- `npm run validate:templates`
- `npm run validate:tool-refs`

## v12.1.0 (2026-04-18) — Codex CLI runtime contract + factual corrections

### Headline

Option D (Codex CLI runtime) is now a first-class Phase 3 path with a full runtime contract — not the five-bullet prose stub it had been. Native subagents via the `[agents]` config block (D1) and shell-level parallelism via `codex exec` backgrounding (D2) are both documented with runnable commands, verified against Codex 0.121.0 source. A SKILL.md frontmatter `description` that silently exceeded Codex's 1024-char load limit (skipping the entire skill in Codex CLI) was trimmed to 960 chars without losing any skill-selection trigger.

Docs-only release. No runtime code changes.

### Added — Codex CLI as a documented runtime (PR #43)

- **`references/runtime/codex-runtime.md`** — new reference file covering D1 vs D2 picker logic, prerequisites, invocation, artifact contract, concurrency caps, status-line patterns, retries, and known gotchas (issues #11435, #14866, #15177 — all cross-linked). Parallels the implicit runtime contracts used by Options A/B.
- **SKILL.md Option D expansion.** Replaced the five-bullet stub with a full D1 + D2 treatment:
  - **D1 Native subagents:** `[features] multi_agent = true` + `[agents] max_threads = 6` + `~/.codex/agents/<name>.toml` role definitions + prompt-driven spawn. Includes a working orchestrator example that fans out one `rpt_audit_explorer` per audit dimension and synthesizes the result.
  - **D2 Shell-level `codex exec`:** runnable bash block with `--ephemeral`, `--sandbox workspace-write`, `--output-last-message`, artifact verification, FS-polling status line, hang recovery, FIFO semaphore with failure propagation.
  - Picker table (D1 vs D2 vs "neither, use Option B for cross-agent messaging").
- **SKILL.md Settings section.** Added a Codex CLI subsection documenting `~/.codex/config.toml` with `[features]`, `[agents]`, and skill-defined `[reprompter]` keys. Clarified that Claude Code is optional when Codex is the target runtime.
- **Frontmatter compatibility claim** rewritten from "parallel sessions if available" (hedged) to naming the actual mechanisms (native subagents or shell-level parallelism via `codex exec`).
- **README.md compatibility table** aligned — removed the asterisk on Codex parallel and added a clarifier pointing to Option D plus the new reference file.

### Fixed — factual corrections to the Codex runtime path (PR #44, 8 commits over 7 bot-review rounds)

Every correction verified against openai/codex `rust-v0.121.0` source, `codex exec --help`, and the current status of each cited GitHub issue as of 2026-04-18.

- **`--full-auto` semantics in `codex exec`.** Source check: `codex-rs/exec/src/cli.rs:50–52` defines `--full-auto` as "Convenience alias for low-friction sandboxed automatic execution (--sandbox workspace-write)". `codex-rs/exec/src/lib.rs:263` selects only the sandbox when `full_auto` is true; `lib.rs:374–376` sets approval policy unconditionally to `AskForApproval::Never` for headless mode. In exec mode, `--sandbox workspace-write` and `--full-auto` are functionally equivalent. The docs now recommend `--sandbox workspace-write` for readability and explain that both options work; no bogus warning about approval-policy side effects.
- **`--sandbox read-only` artifact-write bug.** D2 workers write their `/tmp/rpt-{taskname}-{agent}.md` artifacts themselves, which requires `workspace-write`. `read-only` breaks the artifact contract. D2 examples and explanatory prose updated accordingly; `read-only` is documented only as an option for pure-analysis workers that capture findings via `--output-last-message` instead of writing their own file.
- **`report_agent_job_result` scope.** Tool is registered for `spawn_agents_on_csv` batch workers, not for ordinary prompt-spawned `spawn_agent` subagents. Removed from the D1 custom-agent `developer_instructions` template in SKILL.md and `references/runtime/codex-runtime.md`; added a clarifying note directing CSV-job users to OpenAI's subagents docs.
- **`[agents] max_threads` semantics.** `core/src/agent/registry.rs` `reserve_spawn_slot` returns `AgentLimitReached` when the open-thread count reaches the cap — normal `spawn_agent` calls past the limit fail, they do not queue. The "queues 2 and runs 6 concurrently" line was wrong; replaced with the actual failure mode and a pointer to `spawn_agents_on_csv` for true fan-out.
- **Issue #11435 framing.** Issue is closed (cannot-reproduce after `exec` was reimplemented on the app server). `--ephemeral` is still the right default for isolated parallel runs, but reframed from "required to avoid corruption" to a historical motivation for the flag.
- **Issue #15177 fix claim.** Issue is still open with no linked fix. Removed the "Fixed in 0.122.0-alpha" claim; now documents the current-state workaround (prefer the `default` role when model-override fidelity matters).
- **`codex exec` approval default.** `codex-rs/exec/src/lib.rs:376` hardcodes `Some(AskForApproval::Never)` for headless mode. The `approval_policy` key in `config.toml` applies to the interactive TUI only. Settings table and `config.toml` comment corrected.
- **`features.multi_agent` default.** Default-enabled in 0.121.0+ (`features/src/lib.rs`: `default_enabled: true`). Docs no longer imply users must set this explicitly to use Option D1.
- **Native subagents ship date.** Reframed "shipped 2026-03-16" (imprecise) to "`multi_agent` feature flag stabilized in 0.115.0 on 2026-03-16" (matches `rust-v0.115.0` release notes: `#14622 Stabilize multi-agent feature flag`).
- **Bash portability.** SKILL.md's `(portable, any POSIX shell)` claim on the D2 status loop conflicted with Bash-only `[[ ... ]]` tests. Rewrote the artifact counter as a POSIX-compatible loop using `[ -e "$f" ]` and `case`, and added the same hardening to `references/runtime/codex-runtime.md`. Zero-match safety: the loop does not abort under `set -euo pipefail` when no artifacts exist or only `.prompt.md` inputs are present — both cases previously aborted an `ls | grep | wc` pipeline.
- **FIFO semaphore failure propagation.** The hard-cap example now collects PIDs, `wait`s on each explicitly, aggregates a `status` variable, closes fd 9 after the wait loop, and `exit "$status"` so downstream Phase 4 synthesis does not run on missing artifacts. `trap 'echo >&9' EXIT` inside the worker subshell guarantees the semaphore token is returned even when a worker exits non-zero under strict mode.
- **Picker-table drift.** Added the missing `Cross-agent messaging required mid-run → Neither, use Option B` row to the lower SKILL.md picker table (previously only in the top table and the reference file).
- **macOS CPU-count.** `nproc` alone misled readers on Darwin; the concurrency-cap note now shows both `nproc` (Linux) and `sysctl -n hw.ncpu` (macOS) in SKILL.md and the reference file.

### Fixed — SKILL.md description exceeds Codex load limit (PR #45)

- **Trimmed `description` frontmatter from 1217 to 960 characters** (64-char safety margin under Codex's 1024-character limit, enforced by `validate_len(&description, MAX_DESCRIPTION_LEN, "description")` in Codex 0.121.0). Before this, Codex silently skipped the skill with: `Skipped loading 1 skill(s) due to invalid SKILL.md files. ~/.codex/skills/reprompter/SKILL.md: invalid description: exceeds maximum length of 1024 characters`. Claude Code did not enforce the limit, so the bug was Codex-only and easy to miss.
- Every Single / Repromptverse / Reverse-mode trigger keyword preserved. Removed only verbose phrasing and redundant aliases (`anything going to agent teams`, `multi-agent marketing`, `best practices`, per-mode score breakdown prose). No trigger was dropped.

### Changed

- `compatibility:` frontmatter claim names the actual mechanism used on each runtime instead of hedged "if available" language.
- README.md compatibility table upgrades Codex `Multi-agent parallel` from `yes*` to `yes` with the footnote pointing to Option D.

### Review notes

- PR #44 went through **7 rounds of automated Codex bot review** plus a source-level cross-check at the `rust-v0.121.0` tag. Each round traded a narrower, more accurate claim for a broader, sloppier one — the final wording is grounded in cited source lines rather than memory-from-spec. The takeaway recorded in the commit messages: source-verify contested claims before prose lands in a docs-only PR.

### What's next (deliberately out of scope)

- TESTING.md scenarios for D1 (native subagent fan-out) and D2 (shell-level `codex exec` fan-out) were flagged as desirable but not included here; they fit better as a small follow-up PR so the review surface stays focused.
- Codex-specific install one-liner in README (alongside the existing Claude Code `curl | tar` recipe) — same reason, follow-up.

## v12.0.0 (2026-04-17) — Closed-loop Flywheel

### Headline

Reprompter is no longer an open-loop prompt rewriter. Every generated prompt now emits testable success criteria, every run can be recorded and scored, every outcome feeds a local flywheel, and the skill can consult that flywheel at generation time to bias template / pattern choices toward historical winners — with an A/B report (`npm run flywheel:ab`) that *proves* whether the bias helps. All data local; no telemetry.

This release also recovers Repromptverse under opus 4.7 (which enforces tool schemas strictly where 4.6 was lenient), ships a tool-drift linter as long-term regression insurance, and hardens the Repromptverse runtime selection path.

### Added — closed-loop flywheel (v2+v3 rollout, PRs #33–#35 + #39–#41)

- **v1 outcome-record schema** (`references/outcome-schema.md`). Canonical JSON shape at `.reprompter/outcomes/<ts>-<fp>.json` with `success_criteria`, `verification_results`, `score`, and optional `role` (Repromptverse agent identity) / `applied_recommendation` (flywheel attribution) fields.
- **`scripts/outcome-record.js`** — zero-dep node CLI + library for writing outcome records. Accepts `--prompt`, `--output`, `--criteria`, `--task-type`, `--mode`, `--role`, `--applied-recommendation`, `--notes`. Fingerprint-based filename with collision-safe `-2.json` / `-3.json` retry. Includes `--self-test`.
- **`scripts/evaluate-outcome.js`** — scores records against their criteria. Four methods: `rule`/`regex`, `rule`/`predicate` (tiny DSL: `len(output_text) OP N`, `contains("...")`, `not contains("...")`), `llm_judge` (via user-supplied `--judge-cmd`), `manual` (always skipped). Score = `round(passed / (passed + failed) * 10)`, skipped excluded. Includes `--self-test`.
- **v1 → NDJSON flywheel bridge** (`scripts/outcome-collector.js::ingestDirectory` + `v1RecordToFlywheelOutcome`). Translates records into the existing flywheel shape, preserves `role`→`recipe.domain` routing so per-agent Repromptverse records don't collapse into one bucket, preserves `applied_recommendation` as first-class attribution, dedupes re-runs by `runId|timestamp`, sorts filenames deterministically. Wired as `npm run flywheel:ingest`.
- **Read-path query API** (`scripts/strategy-learner.js::getRecommendation`). Returns `{recipe, confidence, sampleCount}` or `null` on cold start / low confidence. Optional `promptShape` refinement treats missing fields as wildcards (not strict-matches). Wired as `npm run flywheel:query`.
- **Bias injection behind a flag.** New env var `REPROMPTER_FLYWHEEL_BIAS=0|1` (default **off**). When on, Mode 1 step 5 and Mode 2 Phase 2 consult `getRecommendation()` and bias `templateId`/`patterns`/`capabilityTier` toward historical winners when confidence is medium/high with `sampleCount >= 3`. The skill announces the decision in one line so the bias is never silent.
- **Attribution via `applied_recommendation`** field on outcome records. When bias is applied the record carries `{recipe_hash, confidence, sample_count, applied_at}`; when bias is not applied the field is **absent** — absence is the control-group signal for A/B analysis.
- **A/B report** (`scripts/strategy-learner.js::buildAbReport`). Splits outcomes by attribution presence, reports `{count, mean, median}` per group plus `delta_mean_effectiveness`. Flags groups below 5 samples so readers don't over-read noise. Wired as `npm run flywheel:ab`.
- **`<success_criteria>` emission across all three modes.** Mode 1 step 5 now requires a `<success_criteria schema_version="1">` block with 3–6 `<criterion>` entries (`id`, `verification_method` ∈ `rule` / `llm_judge` / `manual`, `description`, and `<rule>` or `<judge_prompt>` per method). Mode 2 Phase 2 requires per-agent criteria scoped to each teammate's artifact. Mode 3 extracts criteria from the exemplar across three layers (structural / content / style) and embeds them in the generated reverse prompt.

### Added — infrastructure + opus-4.7 compatibility

- **Tool-drift linter** (`scripts/validate-tool-refs.js`, PRs #28–#29 + #32). Node script that scans SKILL.md and references for every obsolete tool shape we've shipped a fix for: pre-2.1 `Task(subagent_type=...)` spawn, pre-2.1 `SendMessage(type=/recipient=)`, broadcast-with-structured-message, Claude Flow references, hardcoded `claude-*-<major>-<minor>` model pins. Multi-line regex support. Wired as `npm run validate:tool-refs` and chained into `npm run check`.
- **Auto-pick runtime** (Repromptverse Phase 3, PR #30). Decision tree detects which of Options A–E is available in the current environment (`TeamCreate` + `Agent` + `SendMessage` + `TeamDelete` toolset → Option B; `sessions_spawn` → C; `tmux` + `claude` ≥ 2.1 → A; Codex → D; else E) and picks automatically. Explicit user intent short-circuits.
- **Tool-schema guard** (Repromptverse Phase 3, PR #31). Pre-invocation self-check paragraph, known-pitfall list (captured from 4.6→4.7 drift), and canonical signatures for every tool Option B depends on — so the skill is self-authoritative.

### Changed

- Mode 1 Process list grew from 6 to 7 steps — "Flywheel bias check" inserted between the interview and the generate step.
- Mode 2 Phase 2 per-agent adaptation checklist requires structured criteria (same shape as Mode 1) for every teammate's prompt. Bullet-list scaffolding in `references/*-template.md` is acceptable starting point but the generated per-agent prompt must upgrade to the structured form.
- Mode 3 Process grew from 7 to 8 steps — "Extract criteria" runs between Analyze and Generate; MUST-GENERATE-AFTER-ANALYSIS checklist updated to match (PR #37).
- `references/swarm-template.md` realigned from Claude Flow (third-party MCP) to reprompter's own Options A–E orchestration (PR #26). Example rewritten to coordinate via artifact files + `TaskList` status instead of Claude Flow memory keys.
- `scripts/validate-templates.sh` accepts a list of non-template exceptions (`EXCEPTION_TEMPLATES`). Now skips both `outcome-schema.md` and `team-brief-template.md`.

### Fixed — opus 4.7 strictness recovery

- `Task(subagent_type=...)` spawn → `Agent(...)` (PR #23). Claude Code 2.1 split the legacy `Task` spawn primitive into `Agent` + `TaskCreate`/`TaskUpdate`/`TaskList`; 4.6 inferred the rename, 4.7 rejects.
- `SendMessage(type=, recipient=)` → `SendMessage(to=, message=)` (PR #25). Pre-2.1 kwargs don't exist on the current tool.
- Broadcast shutdown `SendMessage(to="*", message={structured})` → per-agent `SendMessage(to="<name>", message={...})` (PR #27). Broadcast form accepts plain strings only.

### Fixed — codex review rounds

- **On v2 rollout (PR #38, roundup):** filename collision handling (outcome-record.js), shell quoting for `--judge-cmd` (evaluate-outcome.js), regex body validation (evaluate-outcome.js), idempotent re-ingest (outcome-collector.js), deterministic sort order (outcome-collector.js), agent-identity via `role` → `fingerprint.domain` (outcome-collector.js + outcome-record.js + SKILL.md), Mode 3 MUST-GENERATE checklist updated.
- **On v3 read-path (in-branch to #39):** filter-before-limit on queries so task-type recommendations don't vanish as the store grows, partial `promptShape` fields treated as wildcards instead of strict-match defaults.

### Infra / wiring

- New npm scripts: `validate:tool-refs`, `flywheel:query`, `flywheel:ingest`, `flywheel:ab`.
- New env flag: `REPROMPTER_FLYWHEEL_BIAS=0|1` (consultation; default off). Complements existing `REPROMPTER_FLYWHEEL=0|1` (writing; default on).

### Tests

- **205 tests total** (was 169).
- outcome-collector: 30 → 43. strategy-learner: 24 → 36.
- Two new self-tests: `node scripts/outcome-record.js --self-test`, `node scripts/evaluate-outcome.js --self-test`.

### What's next (deliberately out of scope)

- Default-on flip of `REPROMPTER_FLYWHEEL_BIAS`. Wait for `flywheel:ab` to show a consistent positive `delta_mean_effectiveness` across multiple task types with ≥5 samples per group.
- Per-role bias queries for Repromptverse teams once role-stamped records accumulate.
- Visualizations / dashboards on top of `flywheel:ab` output.
- Community / telemetry pooling — the loop stays local-first.

---

## v11.0.0 (2026-03-30) — Reverse Reprompter

### Added
- **Mode 3: Reverse Reprompter** — extract optimal prompts from exemplar outputs. Show reprompter a great output (code review, architecture doc, PR description, etc.) and it reverse-engineers the prompt that would reproduce that quality.
  - 4-phase pipeline: EXTRACT (structural analysis) → ANALYZE (task type, domain, tone classification) → SYNTHESIZE (XML prompt generation) → INJECT (flywheel seeding)
  - 11 task type classifiers: code-review, security-audit, architecture-doc, api-spec, test-plan, bug-report, pr-description, documentation, content, research, ops-report
  - Structural analysis: heading hierarchy, bullet density, code block count, table detection, file:line reference counting, average sentence length
  - Tone detection: formal/neutral/casual with directive language markers
  - Domain detection: 8 domains (frontend, backend, security, database, infrastructure, ops, mobile, ml)
  - Quality analysis: specificity, coverage, clarity scoring
  - Output format inference from exemplar structure
  - Constraint extraction from exemplar patterns
  - Prompt scoring on 6 dimensions
  - **Extraction Card**: transparency table showing detected task type, domain, tone, structure, quality
- **Flywheel exemplar injection** — `injectExemplar()` in outcome-collector.js seeds the flywheel with pre-graded outcomes from reverse-engineered exemplars. Solves the cold-start problem.
  - `buildExemplarOutcome()` in reverse-engineer.js creates flywheel-compatible outcome records
  - Exemplar outcomes get +0.5 effectiveness bonus (user-curated = high quality)
  - Source field marked as `reverse-exemplar` for provenance tracking
- **Reverse mode intent routing** — 10 trigger phrases detected in intent-router.js: "reverse reprompt", "reprompt from example", "learn from this", "extract prompt from", "prompt dna", "prompt genome", etc.
- `references/reverse-template.md` — new template for reverse mode prompts with EXTRACT/ANALYZE/SYNTHESIZE documentation
- 43 new tests in `scripts/reverse-engineer.test.js` covering structure analysis, tone detection, domain detection, task classification, quality analysis, format inference, full pipeline, scoring, flywheel injection, and edge cases

### Changed
- SKILL.md updated from 2 modes to 3 modes (Single, Repromptverse, Reverse)
- Task types table expanded with Reverse entry
- Description and trigger words updated to include reverse mode

### Inspired by
- [Extraktor](https://github.com/AytuncYildizli/extraktor) genome extraction pattern: dual-signal analysis (structural + content), phase-based pipeline with progressive enrichment

## v10.0.0 (2026-03-19) — Repromptmania

### Added
- **Dimension Interview** — score-driven interview for Repromptverse Phase 1. Askable dimensions (Clarity, Specificity, Constraints, Decomposition) scoring < 5 trigger targeted AskUserQuestion calls (0-4 questions). Structure excluded (auto-fixed by templates). Interview responses feed into agent planning via interviewContext.
- **Agent Cards** — three transparency templates for Repromptverse:
  - **Plan Cards** (Phase 1): team roster table with roles, scopes, excludes, output paths
  - **Status Line** (Phase 3): compact emoji-based polling status per agent
  - **Result Cards** (Phase 4): per-agent score, finding count, and key insight summary
- **User confirmation gate** — Plan Cards shown before execution; user must approve team plan before agents launch
- 8 new test scenarios (34-41) covering Dimension Interview triggers, Agent Cards rendering, interview-to-constraint flow, and edge cases

### Changed
- Phase 1 expanded from 4 steps to 7 (score → interview → pick mode → define team → Plan Cards → confirm → write brief)
- Phase 1 time estimate updated from ~30s to ~45s
- Phase 4 adds Result Cards as mandatory step before synthesis (step 4 of 5)
- Phase 3 polling now shows Status Line format across all platform options
- 4 new anti-patterns added to TESTING.md

### Migration
- Breaking: Repromptverse Phase 1 now includes optional interview and mandatory confirmation gate. Existing workflows may see new AskUserQuestion calls.

## v9.2.1 (2026-03-15)

### Fixed
- **7 critical flywheel gaps** resolved by 3-agent parallel team (RuntimeEngineer, OutcomeEngineer, DocsEngineer)
- `flywheelPreferredTier` now consumed by capability-policy.js (+2 score boost)
- `postCorrectionEdits` collected via git log heuristic
- `.reprompter/` added to .gitignore
- Pattern merge complete (full objects via `getPatternById`)
- Ledger rotation with `trimOutcomes(500)` and atomic write
- E2E integration test (5 tests covering full flywheel cycle)
- SKILL.md flywheel user guidance added
- Version alignment: all files now report 9.2.1
- CHANGELOG cleanup: removed semantic-release auto-generated duplicates

## v9.1.0 (2026-03-15)

### Added
- **Closed-loop flywheel** — historical outcomes now automatically change future execution behavior
- **Pre-decision domain lookup** — `bestRecipeForDomain()` queries historical best recipe before pattern/model decisions are made (no fingerprint needed)
- **Confidence-gated bias application** — `applyFlywheelBias()` merges winning patterns at medium+ confidence, overrides capability tier at high confidence
- **Restructured execution flow** — flywheel lookup moved before pattern selection and model resolution so bias can influence decisions

### Changed
- `buildExecutionPlan` flow: routeIntent → flywheelLookup → biased selectPatterns → biased resolveModel → buildContext → fingerprint (of actual decisions)
- Plan result now includes `flywheelBias` (with `applied`, `changes`, `confidence` fields) instead of unused `flywheelRecommendation`
- Pattern selection reasons include flywheel bias trace when applied

## v9.0.0 (2026-03-15)

### Added
- **Prompt Flywheel engine** — closed-loop outcome learning system that gets smarter with every use
- **Recipe fingerprinting** — `scripts/recipe-fingerprint.js` produces deterministic SHA-256 hashes of prompt strategy vectors (template + patterns + tier + domain + layers + quality bucket). Order-invariant, case-insensitive.
- **Outcome collection** — `scripts/outcome-collector.js` passively captures execution signals (artifact score/pass, retry count, execution time) and links them to recipe fingerprints. Storage: `.reprompter/flywheel/outcomes.ndjson`
- **Strategy learning** — `scripts/strategy-learner.js` queries the outcome ledger for similar past tasks, computes time-decay weighted effectiveness scores (7-day half-life), and recommends best-performing recipes with confidence levels
- **Runtime integration** — flywheel hooks at `plan_ready` (fingerprint + strategy lookup) and `finalize_run` (outcome collection) in `scripts/repromptverse-runtime.js`
- **Feature flag** — `REPROMPTER_FLYWHEEL=0|1` for controlled rollout (enabled by default)
- **Telemetry stages** — 3 new event types: `fingerprint_recipe`, `collect_outcome`, `learn_strategy`
- **Flywheel benchmark harness** — `scripts/run-flywheel-benchmark.js` with 13 fixtures covering fingerprint determinism (4), effectiveness scoring (6), and strategy learning (3) with Wilson 95% CI
- **Unit test suites** — `recipe-fingerprint.test.js` (14 tests), `outcome-collector.test.js` (19 tests), `strategy-learner.test.js` (15 tests)
- **npm scripts** — `test:recipe-fingerprint`, `test:outcome-collector`, `test:strategy-learner`, `benchmark:flywheel`, `flywheel:report`

### Privacy
- All flywheel data is stored locally in `.reprompter/flywheel/`. No data is transmitted anywhere.

## v8.3.1 (2026-02-28)

### Added
- **Real-world benchmark harness** — `scripts/run-realworld-benchmark.js` with routing + artifact fixture evaluation and Wilson 95% confidence intervals
- **Expanded real-world fixtures** — `benchmarks/fixtures/realworld-routing-fixtures.json` (64 cases) and `benchmarks/fixtures/realworld-artifact-fixtures.json` (84 cases)
- **Real-world benchmark artifacts** — `benchmarks/v8.3-realworld-benchmark.md` and `benchmarks/v8.3-realworld-benchmark.json`
- **Router regression coverage** for low-signal multi-agent fallbacks and single-mode false-positive protection (`scripts/intent-router.test.js`)

### Fixed
- **Implicit multi-agent over-triggering** in `scripts/intent-router.js` by requiring coordination-scope signals for multi-domain auto-detection
- **Weak single-keyword profile matches** now fall back to generic `repromptverse` via a minimum routing score gate
- **Ops/research routing misses** improved with additional domain phrases (`incident containment`, `recovery`, `decision matrix`, `evidence scoring`)
- **Benchmark evaluator pass accounting** in `scripts/run-provider-benchmark.js` and `scripts/run-realworld-benchmark.js` so score bounds are only enforced for expected-pass fixtures by default (with `enforceScoreBounds` opt-in)

## v8.3.0 (2026-02-28)

### Added
- **Implicit multi-agent intent detection** in `scripts/intent-router.js` for complexity signals (`audit`, `parallel`) and multi-domain prompts (2+ detected systems)
- **Router regression tests** for implicit-intent activation and `forceSingle` override behavior
- **Benchmark fixture expansion** from 6 to 9 routing cases, including implicit-intent scenarios
- **Capability policy engine** — `scripts/capability-policy.js` for provider/model tier routing with fallback chains
- **Layered context builder** — `scripts/context-builder.js` with token-budget manifest output
- **Strict artifact evaluator** — `scripts/artifact-evaluator.js` for gated acceptance and retry targeting
- **Pattern selector** — `scripts/pattern-selector.js` for pluggable prompt/context advancement patterns
- **Runtime adapters** — `scripts/runtime-adapter.js` + `scripts/runtime-adapter-openclaw.js` for OpenClaw-first execution with sequential fallback
- **Runtime orchestrator** — `scripts/repromptverse-runtime.js` composes routing, patterns, policy, context, adapter execution, and optional artifact evaluation
- **Telemetry schema + store** — `scripts/telemetry-schema.js` and `scripts/telemetry-store.js` for stage-level run instrumentation
- **Observability report generator** — `scripts/run-observability-report.js` with markdown/json outputs under `benchmarks/observability/`
- **Provider/evaluator benchmark harness** — `scripts/run-provider-benchmark.js` + new fixtures and reports (`benchmarks/v8.3-provider-benchmark.*`)
- **Expanded test suite** — dedicated unit tests for capability policy, context builder, evaluator, pattern selector, runtime adapter, orchestrator integration, and telemetry/reporting
- **Runtime feature flags** for controlled rollout: `REPROMPTER_POLICY_ENGINE`, `REPROMPTER_LAYERED_CONTEXT`, `REPROMPTER_STRICT_EVAL`, `REPROMPTER_PATTERN_LIBRARY`

### Fixed
- **`forceSingle` precedence** now overrides explicit profile triggers, guaranteeing deterministic single-mode routing when requested
- **Skill packaging filter** now excludes all `scripts/*.test.js` instead of a single test file

## v8.2.0 (2026-02-24)

### Added
- **Deterministic intent router** — `scripts/intent-router.js` with explicit profile triggers + weighted keyword routing
- **Router unit tests** — `scripts/intent-router.test.js` (8 passing tests)
- **Benchmark harness** — `scripts/run-swarm-benchmark.js` + fixture set under `benchmarks/fixtures/`
- **Benchmark reports** — generated markdown/json artifacts for pre-release checks

### Changed
- **Codex/Claude operational parity hardened** with runnable `npm run check` pipeline (templates + router tests + benchmark)
- **Packaging scope tightened** — benchmark artifacts and router test file excluded from skill zip
- Version alignment across docs and skill metadata to `v8.2.0`

## v8.1.0 (2026-02-24)

### Added
- **Engineering swarm template** — `references/engineering-swarm-template.md` for architecture/feature/refactor/migration/test coverage multi-agent runs
- **Ops swarm template** — `references/ops-swarm-template.md` for incident/reliability/infra workflows
- **Research swarm template** — `references/research-swarm-template.md` for benchmark/analysis/tradeoff workflows
- **Expanded test coverage** — scenarios for engineering, ops, and research swarm auto-load plus single-mode pattern-pack verification
- **Deterministic intent router** — `scripts/intent-router.js` + `scripts/intent-router.test.js`
- **Swarm benchmark harness** — `scripts/run-swarm-benchmark.js` with fixture-driven reports in `benchmarks/`

### Changed
- **Repromptverse routing broadening:** lazy-load domain profiles now cover marketing + engineering + ops + research intents
- **Docs parity:** README and SKILL updated to reflect Codex/Claude compatibility with all swarm profiles
- **Template priority:** domain swarms are preferred before generic `repromptverse-template` in multi-agent mode

## v8.0.0 (2026-02-24)

### Added
- **Repromptverse template** — `references/repromptverse-template.md` adds explicit `routing_policy`, `termination_policy`, `artifact_contract`, and `evaluation_loop`
- **Marketing swarm template** — `references/marketing-swarm-template.md` for campaign/growth/SEO/content multi-agent runs
- **Codex installation path** documented in README (`~/.codex/skills/reprompter`)
- **Codex compatibility** in SKILL frontmatter and execution options
- **Microsoft-inspired orchestration notes** in README for selector-style routing + evaluator loops

### Breaking
- **Repromptverse is now the only multi-agent mode name** — Repromptception naming removed from docs/triggers

### Changed
- **Marketing-first routing:** Repromptverse auto-loads marketing swarm profile for campaign/growth/SEO/content intents
- Multi-agent mode docs now describe runtime-specific execution options: tmux, TeamCreate, sessions_spawn, Codex parallel sessions, and sequential fallback
- Template priority updated to prefer `marketing-swarm-template`/`repromptverse-template` for multi-agent tasks

## v7.1.0 (2026-02-22)

### Added
- **Platform-aware Phase 3 execution** — TeamCreate (Claude Code native), Sequential (any LLM) promoted to first-class options alongside tmux (#12)
- **GitHub Releases automation** — `release.yml` workflow creates releases from tags + CHANGELOG (#3)
- **Input guard + content template + vague prompt fallback** (#4)
- **Template reference system** — templates read on demand from `references/`, not bundled in SKILL.md

### Fixed
- **Interview mode restored** — 4 bugs in Quick Mode gate: complexity keyword table, simple verb whitelist, broad-scope noun detection, force-interview signal ordering (#13)
- **Release workflow** — awk double-v prefix bug (#8)
- **Anthropic Skills Guide compliance** — directory structure + sentence case headings (#6, #10)
- **Audit findings** — 20+ fixes across 3 audit sprints (CRITICAL/HIGH/MED), template structural alignment, extended XML tags, negative constraints in all Example sections
- Bold formatting and `count_distinct_systems()` restored after merge conflicts

### Changed
- `docs/examples/` renamed to `docs/references/` (#7)
- Template files consolidated into single adaptive XML template
- README examples upgraded to v7 Repromptverse quality
- Extended tags, Advanced Features, teammateMode documented
- Compatibility frontmatter updated for multi-platform support

## v7.0.0 (2026-02-12)

### Breaking
- **Merged `reprompter` + `reprompter-teams` into single skill** — one SKILL.md, two modes
- **Removed `TEAMS.md` as separate file** — all team execution docs now in SKILL.md
- **Removed `research-reprompter`** — was broken, unused

### Added
- **Two-mode architecture:** Single prompt mode + Repromptverse mode in one skill
- **Repromptverse vs Raw comparison data** — 4-agent audit: +100% CRITICALs, +160% findings, +30% cost savings
- **Auto-detection:** suggests Repromptverse when task mentions 2+ systems or "audit"
- **content-template:** added for blog posts, articles, and marketing copy (12 templates total)
- content-template is now included in references and template tables across SKILL.md/README

### Changed
- SKILL.md trimmed from 1130 lines to ~470 lines (at v7.0.0 release) (59% reduction)
- All team execution patterns consolidated (tmux send-keys -l, separate Enter, Opus default)
- Quality scoring section streamlined
- Templates section condensed to reference table
- README updated for v7.0 with dual-mode docs

### Removed
- Redundant Quick Mode pseudocode (~450 tokens saved)
- Verbose interview JSON examples (kept one compact reference)
- Duplicate context detection test scenarios
- Separate TEAMS.md file (content merged into SKILL.md)

## v6.1.3 (2026-02-12)

### Added
- Repromptverse E2E test results in README (2.15→9.15, +326%)
- Routing-logic skill descriptions (OpenAI best practices)
- `teammateMode: "tmux"` documentation for split-pane agent monitoring

### Changed
- TEAMS.md rewritten with proven `send-keys -l` pattern
- SKILL.md execution strategy updated for Agent Teams primary

## v6.1.2 (2026-02-12)

### Fixed
- Version mismatch — SKILL.md now matches CHANGELOG
- Overly broad complexity keywords — "create"/"build" only trigger interview with broad-scope nouns
- MCP tool name in swarm-template — `memory_store` → `memory_usage`
- Added `count_distinct_systems()` definition to Quick Mode pseudocode

### Added
- Template priority rules — explicit tiebreaking
- `<avoid>` sections in feature, bugfix, and api templates
- Per-Agent Sub-Task sections for Tests and Research agents in team-brief-template

## v6.1.1 (2026-02-11)

### Fixed
- Removed duplicated interview questions
- Removed stray `</output>` tags from templates
- Fixed version header mismatch

### Added
- CONTRIBUTING.md, TESTING.md
- GitHub issue templates (bug report, feature request)
- README overhaul with logo, demo GIF, badges

## v6.0.0 (2026-02-10)

### Added
- Closed-loop quality: Execute → Evaluate → Retry
- Team execution via Claude Code Agent Teams
- Delta prompt pattern for targeted retries
- Success criteria generation
- 11 templates (added team-brief, swarm, research)

## v5.1.0 (2026-02-09)

### Added
- Think tool awareness (Claude 4.x)
- Context engineering guidance
- Extended thinking support
- Response prefilling suggestions
- Uncertainty handling section
- Motivation capture

## v5.0.0 (2026-02-08)

### Added
- Smart interview with AskUserQuestion
- Quick Mode auto-detection
- Project-scoped context detection
- Quality scoring (6 dimensions)
- Task-specific follow-up questions
- 8 XML templates
