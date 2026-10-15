# Advanced features (shared)

> Verbatim from root SKILL.md lines 1608-1754. Shared by every RePrompter mode skill and **required reading** for each of them; the always-on rules (context engineering, uncertainty handling, reasoning-friendly WHAT-not-HOW, token budget) are summarized in `../SKILL.md` → "Core shared rules". The `scripts/` helpers named here are bundled in `../scripts/` (`<skill-dir>` below is this plugin's `skills/reprompter`); `npm run` commands need the full RePrompter repo checkout.

## Advanced features

### Reasoning-friendly prompting (Claude 4.x)
Prompts should be less prescriptive about HOW. Focus on WHAT — clear task, requirements, constraints, success criteria. Let the model's own reasoning handle execution strategy.

**Example:** Instead of "Step 1: read the file, Step 2: extract the function" → "Extract the authentication logic from auth.ts into a reusable middleware. Requirements: ..."

### Response prefilling (API only)
Prefill assistant response start to enforce format:
- `{` → forces JSON output
- `## Analysis` → skips preamble, starts with content
- `| Column |` → forces table format

### Context engineering
Generated prompts should COMPLEMENT runtime context (CLAUDE.md, skills, MCP tools), not duplicate it. Before generating:
1. Check what context is already loaded (project files, skills, MCP servers)
2. Reference existing context: "Using the project structure from CLAUDE.md..."
3. Add ONLY what's missing — avoid restating what the model already knows

### Capability policy routing (OpenClaw + multi-LLM)
When multiple providers/models are available, route each agent by capability tier:
- `reasoning_high`: audits, synthesis, high-risk tasks
- `long_context`: very large context windows or broad codebase scans
- `cost_optimized` / `latency_optimized`: low-risk triage and bulk tasks
- Always emit fallback chain with provider diversity (avoid single-provider hard dependency)

### Budgeted layered context
Build per-agent context in layers with explicit budgets:
1. Task contract (always preserved)
2. Local code facts
3. Selected references
4. Prior artifacts/handoffs

Emit a context manifest (used tokens, truncation flags, dropped entries) so retries are reproducible and debuggable.

### Strict artifact gate
Before synthesis, evaluate each artifact for:
- Required section coverage
- Verifiability (file:line refs when required)
- Boundary compliance (forbidden-pattern checks)
- Overall weighted score threshold

If gate fails, retry only with delta prompts (max 2 retries).

Implementation note: combine routing + patterns + model policy + context + adapter + evaluator through a single orchestration contract (`scripts/repromptverse-runtime.js`) to keep behavior deterministic across runtimes.

### Runtime feature flags
Repromptverse runtime supports deterministic toggles for rollout and troubleshooting:
- `REPROMPTER_POLICY_ENGINE=0|1` — disable/enable capability-based model routing
- `REPROMPTER_LAYERED_CONTEXT=0|1` — disable/enable layered context assembly
- `REPROMPTER_STRICT_EVAL=0|1` — disable/enable strict artifact evaluator defaults
- `REPROMPTER_PATTERN_LIBRARY=0|1` — disable/enable pattern selector activation
- `REPROMPTER_TELEMETRY=0|1` — disable/enable runtime telemetry emission for observability reports
- `REPROMPTER_FLYWHEEL=0|1` — disable/enable Prompt Flywheel outcome learning (v9.0+). Controls whether outcome records are **written** to `.reprompter/flywheel/outcomes.ndjson` after a run.
- `REPROMPTER_FLYWHEEL_BIAS=0|1` — disable/enable Prompt Flywheel bias injection at generation time (v3 read-path). Default **off**. When on, Mode 1 and Mode 2 consult `npm run flywheel:query` for a recommendation before picking a template and apply the bias only when confidence is medium/high with `sampleCount >= 3`. See "Flywheel bias injection" under Mode 1 for the full decision rule.
- `REPROMPTER_VERSION_CHECK=0|1` — disable/enable the version self-check (default **on**). See "Version self-check" below.

### Version self-check
RePrompter is distributed copy-based (no package manager tracks the installed version), so it can't auto-update — but it can tell the user when their copy is stale. Unless `REPROMPTER_VERSION_CHECK=0`, on the **first** reprompter invocation in a session run the check **once, from this skill's own install directory** — not the user's CWD, which is usually the project root and does not contain `scripts/`. Invoke it as `node "<skill-dir>/scripts/version-check.js"` where `<skill-dir>` is the directory this `SKILL.md` was loaded from (e.g. `~/.claude/skills/reprompter`, `~/.codex/skills/reprompter`, `~/.grok/skills/reprompter`, or a project-local `skills/reprompter`). If it prints an update notice, surface that notice to the user before continuing. Never block on it.
- The check prints **only when behind** — an up-to-date (or undeterminable) install produces no output, so a session hook stays quiet. Use `--json` for the explicit `{local, latest, behind, notice}` status.
- It is **fail-soft**: offline, rate-limited, or unparseable responses produce no output and exit 0. It compares the local `SKILL.md` `metadata.version` against the latest GitHub release and caches the result ~24h under `XDG_CACHE_HOME` (keyed by repo), so repeat runs add no latency; the first uncached check waits up to ~3s for GitHub before giving up, and a *failed* lookup is cached ~1h so offline sessions don't repeat the timeout.
- Because the skill is **cached per session**, the notice tells the user to update *and start a new session* — an in-place file update does not apply to a running session.
- Hermes / non-Claude runtimes that don't ship the `scripts/` helpers can skip this; it is an operator convenience, not part of any output lane.

### Plugin migration nudge (Claude Code copy installs only)
This applies ONLY when the runtime is Claude Code and this skill is running from a copy-based install (personal `~/.claude/skills` or project `skills/`), NOT from a plugin install. A plugin install has `.claude-plugin/plugin.json` two directory levels above the skill root. On the FIRST reprompter invocation of a session in that situation, append ONE sentence to the end of the response: RePrompter is now installable as a Claude Code plugin with auto-updates and automatic ambient-gate setup (`/plugin marketplace add AytuncYildizli/reprompter`, then `/plugin install reprompter@reprompter`); remove the copy after migrating so it does not shadow the plugin skill. Never repeat it later in the session, and never mention it in plugin installs or on non-Claude-Code runtimes (Codex, OpenClaw, Grok, Hermes).

### Telemetry and observability
Every Repromptverse run should emit stage-level telemetry events with `runId`, `taskId`, stage name, status, latency, and provider/model where applicable. All telemetry is local files only, never transmitted.
- Event stages: `route_intent`, `select_patterns`, `resolve_model`, `build_context`, `plan_ready`, `spawn_agent`, `poll_artifacts`, `evaluate_artifact`, `retry_artifact`, `finalize_run`, `fingerprint_recipe`, `collect_outcome`, `gate_prompt`, `learn_strategy`
- Storage: `.reprompter/telemetry/events.ndjson`; `gate_prompt` events are written under `$XDG_CACHE_HOME/reprompter/telemetry` instead.
- Report command: `npm run telemetry:report`

### Prompt Flywheel (v9.0+)
Closed-loop outcome learning system. Every prompt reprompter generates carries a **recipe fingerprint** — a deterministic hash of the strategy decisions (template, patterns, capability tier, domain, context layers, quality bucket). After execution, **outcome signals** are passively collected and linked back to the fingerprint.

#### Flywheel user guidance
When the flywheel has enough historical data to influence a recommendation, the AI agent should communicate this to the user concisely:

**When to show flywheel info:**
- Show a brief one-liner when flywheel bias is applied to a plan (e.g., "Flywheel: using constraint-first pattern based on 8 past runs (score 8.7, high confidence)")
- Show when the recommended strategy differs from what would have been selected without historical data
- If the flywheel recommends a different template (via `flywheelBias.template`), prefer that template for prompt generation in Phase 2 unless the user explicitly overrides

**Template bias:** When `flywheelBias.template` is set, use that template ID for prompt generation instead of the default intent-routed template. This is the most impactful flywheel signal — template choice shapes the entire prompt structure. Log the override: "Flywheel: using {template} (historically {score}/10 over {N} runs)"

**When NOT to show flywheel info:**
- No outcome data exists yet (cold start) — do not mention the flywheel at all
- Confidence is `insufficient` (<2 samples) or `low` (<5 samples) — silently skip, no user-facing note
- Bias lookup found data but no changes were applied — nothing to report

**Format:** Always a single inline note, never a table or multi-line block. Example:
> Flywheel: preferring `security-template` + `self-critique-checkpoint` pattern (9 runs, score 8.3/10, high confidence)

**Privacy:** All flywheel data is local (`.reprompter/flywheel/`). Never reference specific past prompts, tasks, or user content in flywheel messages — only aggregate statistics (run count, score, confidence level).

**All data is stored locally.** Nothing is transmitted anywhere. Storage: `.reprompter/flywheel/outcomes.ndjson`.

#### Bias-on vs bias-off A/B contract (v3 part 3)

The attribution mechanism (records carrying `applied_recommendation`) and the flag (`REPROMPTER_FLYWHEEL_BIAS=0|1`) exist so that bias can be measured, not just described. The contract:

- **Bias-on record** = an outcome whose run consulted the flywheel AND applied a recommendation. The record MUST carry `applied_recommendation = { recipe_hash, confidence, sample_count, applied_at }`.
- **Bias-off record** = every other outcome: `REPROMPTER_FLYWHEEL_BIAS=0` runs, flag-on runs where the query returned `null`, and flag-on runs where the query returned low-confidence (below the medium/high threshold). These records MUST NOT carry `applied_recommendation` at all. **Absence is the control-group signal.** Never stamp a null/placeholder block "to be tidy" — that collapses the A/B partition.

Read the A/B report with `npm run flywheel:ab` (optionally `-- --task-type <slug>` to scope). It returns `{ with_bias: {count, mean, median}, without_bias: {count, mean, median}, delta_mean_effectiveness, notes }`. Notes flag low-sample groups (<5 per side) so you don't over-read noise. A positive `delta_mean_effectiveness` means bias-on outcomes averaged higher than bias-off outcomes for this task type; negative means the opposite. Only consider flipping `REPROMPTER_FLYWHEEL_BIAS` to default-on after both groups pass the 5-sample bar and the delta is consistent across multiple task types.

**How it works:**
1. **Fingerprint** — At `plan_ready`, the recipe vector (template + patterns + tier + domain + layers + quality bucket) is hashed into a 16-char fingerprint
2. **Outcome collection** — At `finalize_run`, passive signals are captured: artifact evaluator score/pass, retry count, execution time. Linked to the recipe fingerprint.
3. **Strategy learning** — On future runs, the learner queries the outcome ledger for similar past tasks, scores each recipe group (time-decay weighted), and recommends the historically best-performing strategy

**Effectiveness scoring:**
- Base: artifact evaluator score
- Penalties: retries (-0.5 each), post-corrections (-0.3 each, capped at -2.0)
- Bonus: first-attempt pass (+0.5)
- Overrides: explicit user reject (caps at 3.0), explicit user accept (floors at 7.0)

**Time decay:** 7-day half-life. Recent outcomes weigh more. Month-old outcomes have <10% influence.

**Confidence levels:** high (10+ samples), medium (5-9), low (2-4), insufficient (<2, no recommendation made).

Report command: `npm run flywheel:report`
Benchmark command: `npm run benchmark:flywheel`

### Pattern library (pluggable)
Treat prompt/context engineering advancements as toggleable patterns (not fixed doctrine):
- Constraint placement (runtime-aware; `constraint-first-framing` remains the compatibility key)
- Uncertainty labeling
- Self-critique checkpoint
- Delta retry scaffold
- Evidence-strength labeling
- Context-manifest transparency
- Tool-description quality

Activate by task/domain/outcome profile and validate via benchmark fixtures.

### Token budget
Keep generated prompts under ~2K tokens for single mode, ~1K per agent for Repromptverse. Longer prompts can rot the context window instead of improving quality. If a prompt exceeds budget, split into phases, cite source paths, or move long supporting material into references instead of inlining dumps.

### Uncertainty handling
Always include explicit permission for the model to express uncertainty rather than fabricate:
- Add to constraints: "If unsure about any requirement, ask for clarification rather than assuming"
- For research tasks: "Clearly label confidence levels (high/medium/low) for each finding"
- For code tasks: "Flag any assumptions about the codebase with TODO comments"

---
