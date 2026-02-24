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

---

## Anti-Patterns (Should NOT Happen)

| Anti-Pattern | Why It's Wrong |
|-------------|----------------|
| Stop after interview without generating | Step 4 (generation) is required |
| Quick Mode on compound prompts | Complexity keywords should force interview |
| Cross-project context leakage | Session isolation must be enforced |
| Generate in English for non-English input | Should match input language |
| Skip task-specific questions for complex prompts | Domain-specific questions are mandatory |
