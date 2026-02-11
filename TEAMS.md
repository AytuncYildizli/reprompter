---
name: reprompter-teams
description: "Repromptception" — double-layer prompt improvement for agent teams. Layer 1 improves the team brief. Layer 2 individually improves each agent's sub-task through full RePrompter analysis. Every agent starts with a polished, scored, structured prompt. Then evaluates output and retries if needed.
version: 2.0.0
---

# RePrompter Teams v2 — Repromptception

> Every agent gets a RePrompted prompt. Not just the team — each individual.

## When to Use
- Any task going to tmux agent teams or sub-agents
- Complex coding, audit, research tasks
- When you say "reprompter teams", "run with quality loop", "smart agents"
- Automatically invoked when agent-teams skill detects complex tasks

## When NOT to Use
- Simple one-shot questions (just answer directly)
- Tasks under 20 words with a single clear action

---

## The Loop (4 Phases)

### Phase 1: TEAM PLAN (Top-Level RePrompt)

Take the raw task and run it through RePrompter analysis:

1. **Score the raw prompt** (0-10) across dimensions:
   - Clarity, Specificity, Structure, Context, Constraints, Examples, Edge Cases, Decomposition
2. **Auto-detect execution mode:**
   - Single agent (simple, one system)
   - Team parallel (2+ independent systems)
   - Team sequential (pipeline)
3. **Generate team brief:**
   - Overall mission, coordination rules, shared context
   - Define agent roles and rough sub-tasks
4. **Define team-level success criteria**

### Phase 2: REPROMPTCEPTION (Per-Agent RePrompt)

**This is the v2 differentiator.** Each agent's sub-task gets its own full RePrompter pass:

1. **Take each agent's rough sub-task** from Phase 1
2. **Run it through RePrompter individually:**
   - Score the sub-task (0-10)
   - Add role assignment specific to that agent's domain
   - Add context (codebase, files, dependencies)
   - Add constraints (what NOT to touch, boundaries with other agents)
   - Add success criteria specific to that agent
   - Add output format requirements
   - Add uncertainty handling ("ask if ambiguous")
3. **Score each improved sub-prompt** — target 8+/10
4. **Result:** Each agent starts with a polished, structured, high-quality prompt

**Why this matters:** Without per-agent reprompt, sub-tasks are vague derivatives of the main task. "Security Auditor — scan for vulnerabilities" becomes:

```xml
<role>Senior application security engineer specializing in Python web applications</role>
<context>
- Codebase: ~/clawd/scripts/tweet-engine/ (Python 3, psycopg2, urllib)
- DB: Neon Postgres with tweets, engagement_learnings, tweet_references tables
- API keys hardcoded in source (Muhabbit, Brave, twitterapi.io)
</context>
<task>Audit all Python files for security vulnerabilities</task>
<requirements>
- Check for SQL injection (parameterized queries vs string formatting)
- Check for hardcoded secrets and API keys
- Check for SSRF in URL fetching functions
- Check for input validation on external data (Muhabbit API, Brave API responses)
</requirements>
<constraints>
- Only audit files in the tweet-engine directory
- Don't modify any files — report only
- Don't overlap with Performance Reviewer's scope
</constraints>
<success_criteria>
- Minimum 3 findings with severity ratings (critical/high/medium/low)
- Each finding includes file, line number, and fix suggestion
- No hallucinated file paths — verify with ls/cat before reporting
</success_criteria>
```

**Output of Phase 2:**
```
<repromptception>
  <team_brief>...</team_brief>
  <agents>
    <agent role="Security Auditor">
      <raw_score>3.2</raw_score>
      <improved_score>8.7</improved_score>
      <prompt><!-- Full XML-structured prompt --></prompt>
    </agent>
    <agent role="Performance Reviewer">
      <raw_score>2.8</raw_score>
      <improved_score>8.5</improved_score>
      <prompt><!-- Full XML-structured prompt --></prompt>
    </agent>
    <agent role="Test Coverage">
      <raw_score>3.0</raw_score>
      <improved_score>8.9</improved_score>
      <prompt><!-- Full XML-structured prompt --></prompt>
    </agent>
  </agents>
  <success_criteria>
    <criterion>Each agent produces a report with findings + severity</criterion>
    <criterion>At least 3 actionable findings per agent</criterion>
    <criterion>No hallucinated file paths or function names</criterion>
    <criterion>Final synthesis prioritizes by impact</criterion>
  </success_criteria>
  <quality_score_before>3.2</quality_score_before>
  <quality_score_after>8.7</quality_score_after>
</improved_task>
```

### Phase 3: EXECUTE

Each agent gets their **individually RePrompted** prompt from Phase 2.

**Single Agent:**
```bash
sessions_spawn(task=<reprompted_prompt>, model=<best_model_for_task>)
```

**Team Parallel (tmux — preferred):**
```bash
exec(
  command: "cd <workdir> && CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions",
  pty: true,
  background: true
)
# Send the team brief which includes all per-agent reprompted sub-tasks
process(action: "write", sessionId: "<id>", data: "<team_brief_with_reprompted_subtasks>")
```

**Team Sequential:**
```bash
# Each agent gets their reprompted prompt + previous agent's output
sessions_spawn(task=<agent1_reprompted_prompt>) → result1
sessions_spawn(task=<agent2_reprompted_prompt + result1>) → result2
sessions_spawn(task=<agent3_reprompted_prompt + result2>) → final
```

### Phase 4: EVALUATE + RETRY

When output arrives, evaluate against success criteria from Phase 1:

1. **Score the output** (0-10):
   - Completeness: Did it address all criteria?
   - Accuracy: Are file paths, function names, data points real?
   - Actionability: Can you act on the findings/output?
   - Quality: Is it thorough or surface-level?

2. **Decision logic:**

```
Score ≥ 7  → ACCEPT. Deliver to user.
Score 4-6  → RETRY with targeted fix. Identify what's missing, 
             revise the prompt to address gaps, re-execute.
Score < 4  → RETRY with full rewrite. The approach was wrong,
             not just incomplete.
```

3. **Retry rules:**
   - **Max 2 retries** (3 total attempts)
   - Each retry gets a **delta prompt** — not the full prompt again, but specifically what was missing:
     ```
     "Previous attempt scored 5/10. Missing: security analysis only found 1 issue 
     (expected 3+), no severity ratings. This retry: focus specifically on 
     [security gaps] and add [severity: critical/high/medium/low] to each finding."
     ```
   - If still failing after 2 retries → deliver best attempt with quality warning

4. **Retry prompt enhancement:**
   - Include the previous output as context
   - Specifically call out what was missing or wrong
   - Narrow the scope (don't repeat what was already good)

---

## Quick Reference: Model Selection

| Task Type | Model | Why |
|-----------|-------|-----|
| Coding, refactoring, bug fix | `codex` or tmux claude | Tool use, file access |
| Research, data gathering | `gemini` | Web search, long context |
| Analysis, reasoning, writing | Claude (default) | Best reasoning |
| Multi-system audit | tmux team | Parallel, file access |
| Quick fact check | `gemini` | Fast, free |

---

## Example: Full Repromptception Loop

**Raw input:** "reprompter teams: audit zeroclaw for security issues"

**Phase 1 (TEAM PLAN):**
- Raw score: 2.5/10 (vague, no scope, no criteria)
- Execution mode: team_parallel (multi-system audit)
- 3 agents identified: Auth Auditor, Input Validation, Secrets Scanner
- Team-level success criteria defined
- Team brief score: 8.5/10

**Phase 2 (REPROMPTCEPTION):**
- Auth Auditor sub-task: 3.2 → 8.7 (added: OAuth flow scope, session handling checks, specific files to audit)
- Input Validation sub-task: 2.8 → 8.5 (added: which API endpoints, what input types, XSS vs SQLi focus)
- Secrets Scanner sub-task: 3.0 → 8.9 (added: file patterns to scan, env var checks, git history search)
- Each agent now has full XML prompt with role, context, constraints, success criteria

**Phase 3 (EXECUTE):**
- tmux team launched with 3 agents
- Each gets their individually reprompted sub-prompt
- Results collected after ~60-120s

**Phase 4 (EVALUATE):**
- Attempt 1: Score 5/10 — Auth Auditor found issues but Secrets Scanner hallucinated a file path
- Retry 1: Delta prompt → "Re-scan for secrets, verify each file path exists with `ls` before reporting"
- Attempt 2: Score 8/10 — All findings verified, severity rated ✓
- ACCEPT. Deliver synthesized report.

---

## Integration Notes

- This skill builds on `reprompter` (prompt engineering) and `agent-teams` (tmux orchestration)
- Both parent skills remain available independently
- When this skill is active, it intercepts agent-team launches and adds the quality loop
- The user sees: task in → quality output out. The loop is invisible unless they ask for details.
- Brief files: `/tmp/rpt-brief-*.md`, reports: `/tmp/rpt-report-*.md`
