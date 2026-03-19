# RePrompter Test Scenarios

Verification scenarios for the RePrompter skill. Run these manually to validate behavior after changes.

---

## Scenario 1: Quick Mode - Simple Input

**Input:** "add a loading spinner"
**Expected:** Quick Mode activates, generates prompt immediately without interview.
**Verify:** No AskUserQuestion call, output includes `<role>`, `<task>`, `<requirements>`.

## Scenario 2: Quick Mode - Complex Rejection

**Input:** "update dashboard tracking and configure alerts"
**Expected:** Quick Mode is REJECTED (compound task + integration/state signals: "and", "tracking", "configure", "alerts").
**Verify:** Full interview runs. AskUserQuestion is called with at least task type + execution mode.

## Scenario 3: Full Interview Flow

**Input:** "we need some kind of authentication thing, maybe oauth"
**Expected:** Full interview with AskUserQuestion. All required high-priority questions asked (lower-priority questions may be dropped when replaced by task-specific mandatory questions).
**Verify:**
- Task Type question appears
- Execution Mode question appears
- Motivation question appears
- Generated prompt includes all XML sections
- Quality score is shown (before/after)

## Scenario 4: Team Mode

**Input:** "build a real-time chat system with websockets, database, and React frontend"
**Expected:** Team mode detected or offered. Team brief generated with 2-5 agent roles.
**Verify:**
- Execution Mode question offers team options
- If team selected: team brief is generated at `/tmp/rpt-brief-*.md`
- Per-agent sub-prompts are generated (one per agent)
- Each sub-prompt is scoped to that agent's responsibility

## Scenario 5: Context Detection

**Setup:** Run from a directory with `package.json` (Next.js), `tsconfig.json`, `prisma/schema.prisma`.
**Input:** "add user profile page"
**Expected:** Auto-detects tech stack and includes in context.
**Verify:**
- Context mentions Next.js, TypeScript, Prisma
- Source transparency: "Auto-detected from: [pwd]"
- No parent directory scanning

## Scenario 6: No Project Fallback

**Setup:** Run from home directory (`~`) or empty directory.
**Input:** "create a REST API"
**Expected:** No auto-detection. Generic context used or user asked for tech stack.
**Verify:**
- Message: "No project context detected"
- No framework assumptions in generated prompt

## Scenario 7: Opt-Out

**Setup:** Run from a project directory with config files.
**Input:** "reprompt no context - add a button"
**Expected:** Auto-detection skipped despite project files existing.
**Verify:**
- No tech stack in context
- Generic prompt generated
- Opt-out keyword detected ("no context")

## Scenario 8: Closed-Loop Quality (v6.0+)

**Input:** "reprompter run with quality - audit the auth module"
**Expected:** Full loop: improve prompt -> execute -> evaluate -> retry if needed.
**Verify:**
- Prompt is generated and scored
- Execution happens (single agent or team)
- Output is evaluated against success criteria
- If Repromptverse score < 8, retry with delta prompt (Single mode threshold remains < 7 for prompt quality)
- Max 2 retries observed

## Scenario 9: Edge Cases

### 9a: Empty Input
**Input:** "" (empty)
**Expected:** Ask user to provide a prompt. Do not generate.

### 9b: Non-English Input
**Input:** "ajouter un bouton de connexion" (French)
**Expected:** Detect language, generate prompt in French.

### 9c: Code Block Input
**Input:** "fix this: ```js\nconst x = undefined.foo\n```"
**Expected:** Treat code as context, extract intent ("fix undefined access"), generate debugging prompt.

### 9d: Very Long Input (500+ words)
**Input:** [paste a 600-word requirements document]
**Expected:** Summarize key points, confirm with user, flag as complex, run full interview.

### 9e: Conflicting Choices
**Scenario:** User selects "Fix Bug" as task type but "Team (Parallel)" as execution mode.
**Expected:** Ask clarifying follow-up: "You chose Bug Fix but also Team Parallel - is this a multi-service bug?"

---

## Scenario 10: Repromptverse E2E

**Input:** "reprompter teams - audit the auth module for security issues and test coverage gaps"
**Expected:** Full multi-agent pipeline (Phase 1-4).
**Verify:**
- Phase 1: Team brief written to `/tmp/rpt-brief-*.md` with 2-3 agents
- Phase 2: Per-agent XML prompts written to `/tmp/rpt-agent-prompts-*.md`, each scored 8+/10
- Phase 3: tmux session created, agents execute in parallel
- Phase 4: Results evaluated, each agent output has required sections
- Final synthesis delivered to user

## Scenario 11: Delta Retry

**Setup:** Manually create a partial output file that would score 5/10 (missing sections).
**Input:** Trigger Phase 4 evaluation on the partial output.
**Expected:** Retry triggered with delta prompt specifying exact gaps.
**Verify:**
- Delta prompt lists ✅ good sections and ❌ missing sections
- Retry uses the same agent role and constraints
- Max 2 retries enforced (3 total attempts)

## Scenario 12: Template Loading

**Input:** "reprompt - fix the login timeout bug" (should load bugfix-template)
**Expected:** bugfix-template.md read from `references/`, not base XML.
**Verify:**
- Template file actually read (not just base structure used)
- Bug-specific sections present (symptoms, investigation steps)
- If template file deleted, falls back to Base XML Structure gracefully

## Scenario 13: Concurrent Sessions

**Setup:** Start two Repromptverse runs simultaneously with different tasknames.
**Expected:** No file collisions between runs.
**Verify:**
- Each run uses unique taskname in file paths
- Output files don't overwrite each other
- Both sessions complete independently

## Scenario 14: Codex Skill Install + Trigger

**Setup:** Install repo under `~/.codex/skills/reprompter`.
**Input:** "reprompt this: harden auth middleware and add tests"
**Expected:** Skill triggers in Codex and runs Single mode interview/generation flow.
**Verify:**
- Trigger phrase activates RePrompter behavior
- Generated prompt includes required XML sections
- Before/after quality score table is shown

## Scenario 15: Repromptverse Contract Coverage

**Input:** "repromptverse - run 4 agents for security/cost/config/memory audit"
**Expected:** Generated multi-agent prompt pack includes explicit routing, termination, artifact, and evaluation policies.
**Verify:**
- Prompt pack references `repromptverse-template` sections
- Includes max-turn/max-time/no-progress stop rules
- Includes one-writer-per-artifact ownership
- Includes retry threshold + max retry count

## Scenario 16: Marketing Swarm Auto-Load

**Input:** "repromptverse - launch plan for AI agent community growth with SEO + X posts + weekly analytics"
**Expected:** Marketing swarm profile is selected by default.
**Verify:**
- `marketing-swarm-template` sections appear in generated prompt pack
- Role pack includes strategist/researcher/copywriter/distributor/analyst
- KPI tree + calendar + reporting cadence are explicitly defined

## Scenario 17: Engineering Swarm Auto-Load

**Input:** "repromptverse - refactor auth module, migrate API contract, and raise test coverage"
**Expected:** Engineering swarm profile is selected by default.
**Verify:**
- `engineering-swarm-template` sections appear in generated prompt pack
- Role pack includes architect/implementer/tester/reviewer/integrator
- Integration checkpoints and test/review gates are explicit

## Scenario 18: Ops Swarm Auto-Load

**Input:** "repromptverse - gateway timeout incident, uptime drops, cron failures, need RCA + fix plan"
**Expected:** Ops swarm profile is selected by default.
**Verify:**
- `ops-swarm-template` sections appear in generated prompt pack
- Role pack includes triage/diagnostics/remediation/observability/verifier
- RCA confidence + rollback + post-fix verification are explicit

## Scenario 19: Research Swarm Auto-Load

**Input:** "repromptverse - benchmark memory architectures and compare cost/latency tradeoffs"
**Expected:** Research swarm profile is selected by default.
**Verify:**
- `research-swarm-template` sections appear in generated prompt pack
- Role pack includes scout/analyst/skeptic/synthesizer
- Confidence labels and tradeoff matrix are explicit

## Scenario 20: Single Mode Pattern Pack Coverage

**Input:** "reprompt this: make onboarding better"
**Expected:** Single mode runs intent routing + constraint normalization + evaluator loop.
**Verify:**
- Template selection rationale is explicit (intent router)
- Vague goal is converted into measurable requirements/constraints
- Quality rubric is shown across six dimensions
- If score < 7, one delta rewrite is produced before final output

## Scenario 21: Capability Policy Tier Routing

**Input:** Provider benchmark fixture set (`benchmarks/fixtures/provider-routing-fixtures.json`)
**Expected:** Capability policy assigns the expected tier per fixture.
**Verify:**
- `npm run benchmark:provider` reports routing accuracy 100%
- Cases cover `reasoning_high`, `long_context`, `cost_optimized`, `reasoning_medium`, and `tool_reliability`
- Output includes selected provider/model and reason trace

## Scenario 22: Layered Context Budgeting

**Input:** Context builder unit fixtures (`scripts/context-builder.test.js`)
**Expected:** Contract layer preserved; lower-priority layers truncate under budget pressure.
**Verify:**
- `npm run test:context-builder` passes
- Manifest includes layer budgets, used tokens, and truncation flags
- Tight budget still includes Layer 1 task contract

## Scenario 23: Strict Artifact Gate

**Input:** Evaluator fixtures (`benchmarks/fixtures/evaluator-quality-fixtures.json`)
**Expected:** Artifacts fail on missing sections, missing line refs, or forbidden boundary patterns.
**Verify:**
- `npm run test:artifact-evaluator` passes
- `npm run benchmark:provider` reports evaluator accuracy 100%
- Failed artifacts include explicit gap messages for delta retry prompts

## Scenario 24: OpenClaw Adapter + Sequential Fallback

**Input:** Runtime adapter unit suite (`scripts/runtime-adapter.test.js`)
**Expected:** OpenClaw adapter reports parallel support; sequential adapter disables it with same polling contract.
**Verify:**
- `npm run test:runtime-adapter` passes
- `pollArtifacts` returns `completed` when outputs exist
- `pollArtifacts` returns `stalled` on no-progress state

## Scenario 25: End-to-End Runtime Composition

**Input:** Runtime orchestrator suite (`scripts/repromptverse-runtime.test.js`)
**Expected:** Plan composition includes routing + patterns + model policy + context build, and execution path can spawn/poll/evaluate with adapters.
**Verify:**
- `npm run test:repromptverse-runtime` passes
- Build path returns intent profile, selected model, and context manifest
- Execute path supports OpenClaw and sequential adapters

## Scenario 26: Telemetry Coverage + Observability Report

**Input:** Runtime execution with telemetry enabled and report generation (`npm run telemetry:report`)
**Expected:** Every run emits stage events and report aggregates run-level metrics.
**Verify:**
- `.reprompter/telemetry/events.ndjson` contains stage events with `runId` and `taskId`
- Includes core stages: route, pattern, model, context, spawn, poll, evaluate, finalize
- `benchmarks/observability/v8.3-observability-report.md` and `.json` are generated
- Report includes run count, stall/timeout rates, stage latency summary, provider distribution

## Scenario 27: Real-World Benchmark Coverage

**Input:** Real-world routing + artifact fixtures (`benchmarks/fixtures/realworld-routing-fixtures.json`, `benchmarks/fixtures/realworld-artifact-fixtures.json`)
**Expected:** Real-world benchmark validates routing precision and evaluator correctness at larger sample size.
**Verify:**
- `npm run benchmark:realworld` reports routing accuracy 100% (64/64)
- `npm run benchmark:realworld` reports artifact accuracy 100% (84/84)
- Output includes Wilson 95% confidence intervals in markdown/json reports
- Artifacts are generated at `benchmarks/v8.3-realworld-benchmark.md` and `.json`

## Scenario 28: Recipe Fingerprint Determinism

**Input:** Fingerprint benchmark fixture set (`benchmarks/fixtures/flywheel-benchmark-fixtures.json`, `fingerprint_determinism`)
**Expected:** Identical recipe inputs produce identical hashes; different inputs produce different hashes; pattern order and case do not affect output.
**Verify:**
- `npm run test:recipe-fingerprint` passes (14 tests)
- `npm run benchmark:flywheel` reports fingerprint accuracy 100% (4/4)

## Scenario 29: Outcome Collection and Effectiveness Scoring

**Input:** Outcome collector unit suite (`scripts/outcome-collector.test.js`) + effectiveness benchmark fixtures
**Expected:** Outcomes are validated, stored to NDJSON, filtered by domain, and effectiveness scores correctly computed from signals.
**Verify:**
- `npm run test:outcome-collector` passes (19 tests)
- `npm run benchmark:flywheel` reports effectiveness accuracy 100% (6/6)
- Signals are sanitized: negatives clamped, invalid types stripped, unknown verdicts rejected
- User reject verdict caps score at 3.0; user accept floors at 7.0

## Scenario 30: Strategy Learning and Recommendation

**Input:** Strategy learner unit suite (`scripts/strategy-learner.test.js`) + strategy benchmark fixtures
**Expected:** Learner queries outcome ledger, groups by recipe hash, computes time-decay weighted scores, and recommends best recipe.
**Verify:**
- `npm run test:strategy-learner` passes (15 tests)
- `npm run benchmark:flywheel` reports strategy accuracy 100% (3/3)
- Empty store returns `hasData: false` with helpful message
- Insufficient samples (<2) returns no recommendation
- 3+ similar outcomes return recommendation with confidence level

## Scenario 31: Flywheel Runtime Integration

**Input:** Run `buildExecutionPlan` and `executePlan` with `flywheel: true` feature flag
**Expected:** Recipe fingerprint is computed at plan_ready; outcome is collected at finalize_run; telemetry includes `fingerprint_recipe`, `collect_outcome`, and `learn_strategy` events.
**Verify:**
- `npm run test:repromptverse-runtime` passes
- Plan result includes `recipeFingerprint` and `flywheelRecommendation` fields
- Execution result includes `outcomeRecord` field
- `.reprompter/flywheel/outcomes.ndjson` contains outcome entry after execution

## Scenario 32: Flywheel Privacy (Local-Only Storage)

**Setup:** Run a full Repromptverse cycle with flywheel enabled.
**Expected:** All flywheel data stored in `.reprompter/flywheel/` locally. No network calls.
**Verify:**
- Outcome file exists at `.reprompter/flywheel/outcomes.ndjson`
- No HTTP/fetch imports in any flywheel module
- Module source contains only `fs`, `path`, `crypto`, `child_process` (execFileSync for git) imports

## Scenario 33: Flywheel End-to-End Integration

**Input:** Full cycle: seed outcomes, plan with flywheel, execute with flywheel, re-plan to verify learning, cold-start case.
**Expected:** Flywheel collects outcomes, influences future plans, and handles cold start gracefully.
**Verify:**
- `npm run test:flywheel-e2e` passes (5 sub-tests)
- Cold start: `buildExecutionPlan` with flywheel enabled produces no bias when outcome store is empty
- Seeded outcomes: after writing 3+ outcomes for a domain, `buildExecutionPlan` applies flywheel bias
- Execution: `executePlan` with flywheel writes an `outcomeRecord` to `.reprompter/flywheel/outcomes.ndjson`
- Re-plan: a second `buildExecutionPlan` after execution reflects the newly collected outcome data
- Telemetry includes `fingerprint_recipe`, `collect_outcome`, and `learn_strategy` stage events

## Scenario 34: Dimension Interview - Low Specificity Triggers Question

**Input:** "repromptverse - audit the system"
**Expected:** Specificity scores < 5. Interview asks scope clarification with dynamic options derived from codebase top-level directories.
**Verify:** AskUserQuestion called, options reference actual project modules, interviewContext.scope is populated.

## Scenario 35: Dimension Interview - High Score Skips Interview

**Input:** "repromptverse - audit auth module and payment gateway for SQL injection, CSRF, and token expiry. Min 10 findings per agent. Frontend out of scope."
**Expected:** All askable dimensions (Clarity, Specificity, Constraints, Decomposition) score >= 5. Interview skipped entirely.
**Verify:** No AskUserQuestion call, Plan Cards shown immediately after raw score.

## Scenario 36: Plan Cards + User Confirmation Before Execution

**Input:** Any Repromptverse task.
**Expected:** Plan Cards table shown after team plan, user confirmation requested before execution.
**Verify:** Table includes all agents with role, scope, excludes, output path. Execution does not start until user confirms.

## Scenario 37: Result Cards Rendered After Execution

**Input:** Any completed Repromptverse run.
**Expected:** Result Cards table shown after all agents complete (or retry), before synthesis.
**Verify:** Table includes score, finding count, key insight per agent. Total row shows aggregate stats.

## Scenario 38: Interview Context Flows Into Agent Constraints

**Input:** "repromptverse - audit katman" then answer interview with "frontend out of scope" and "min 10 findings"
**Expected:** Every agent's `<constraints>` includes "Frontend out of scope". Every agent's `<success_criteria>` includes "minimum 10 findings".
**Verify:**
- Read agent prompts from `/tmp/rpt-agent-prompts-*.md`, confirm interview context is embedded
- Plan Cards table distinguishes interview-sourced vs auto-detected constraints

## Scenario 39: Dimension Interview - Maximum Questions (All Dimensions Low)

**Input:** "repromptverse - do stuff to the thing"
**Expected:** All 4 askable dimensions (Clarity, Specificity, Constraints, Decomposition) score < 5. Exactly 4 questions asked in priority order (lowest score first). Structure is NOT asked about.
**Verify:** 4 AskUserQuestion calls, no Structure question, priority ordering matches score ranking.

## Scenario 40: Status Line Rendered During Polling

**Input:** Any Repromptverse task during Phase 3 execution.
**Expected:** Each poll cycle shows compact status line with emoji indicators.
**Verify:** Status line format matches `Agents: ✅ N/T ⏳ N/T 🔄 N/T` pattern. Retry agents show retry count.

## Scenario 41: Interview Dismissed - Graceful Fallback

**Input:** "repromptverse - audit the system" then skip/dismiss all interview questions.
**Expected:** Proceed with empty interviewContext. Plan Cards show "Interview: skipped by user".
**Verify:** No interviewContext applied to agent prompts. Team plan uses auto-detected context only.

## Scenario 42: Plan Cards Re-render After User Adjustment

**Input:** Any Repromptverse task. After Plan Cards shown, user says "remove the config reviewer agent" or "add a testing agent".
**Expected:** Team plan adjusted per user request. Plan Cards re-rendered with updated agent roster.
**Verify:** Updated Plan Cards table reflects the change. User confirmation gate asked again with new plan.

---

## Anti-Patterns (Should NOT Happen)

| Anti-Pattern | Why It's Wrong |
|-------------|----------------|
| Stop after interview without generating | Step 4 (generation) is required |
| Quick Mode on compound prompts | Complexity keywords should force interview |
| Cross-project context leakage | Session isolation must be enforced |
| Generate in English for non-English input | Should match input language |
| Skip task-specific questions for complex prompts | Domain-specific questions are mandatory |
| Launch agents without showing Plan Cards | User must see agent plan before $2-4 execution |
| Write synthesis without Result Cards | Result summary is mandatory before synthesis |
| Ask Structure questions in Dimension Interview | Structure is auto-fixed, never asked |
| Show Dimension Interview for high-score prompts | All askable dimensions >= 5 means skip |
