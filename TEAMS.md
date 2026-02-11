---
name: reprompter-teams
description: Autonomous prompt→execute→evaluate→retry loop. Combines RePrompter prompt engineering with tmux agent teams. Use when running any multi-agent task, audit, or complex coding work. Automatically improves prompts before execution and validates output quality after, retrying if needed.
version: 1.0.0
---

# RePrompter Teams — Closed-Loop Agent Orchestration

> Prompt → Improve → Execute → Evaluate → Retry if needed

## When to Use
- Any task going to tmux agent teams or sub-agents
- Complex coding, audit, research tasks
- When you say "reprompter teams", "run with quality loop", "smart agents"
- Automatically invoked when agent-teams skill detects complex tasks

## When NOT to Use
- Simple one-shot questions (just answer directly)
- Tasks under 20 words with a single clear action

---

## The Loop (3 Phases)

### Phase 1: IMPROVE (RePrompter)

Take the raw task and run it through RePrompter analysis:

1. **Score the raw prompt** (0-10) across dimensions:
   - Clarity, Specificity, Structure, Context, Constraints, Examples, Edge Cases, Decomposition
2. **Auto-detect execution mode:**
   - Single agent (simple, one system)
   - Team parallel (2+ independent systems)
   - Team sequential (pipeline)
3. **Generate improved prompt(s):**
   - If single → one optimized prompt with XML structure
   - If team → team brief + per-agent sub-prompts
4. **Define success criteria** — What does "good output" look like? Extract from the task or infer:
   - Completeness checklist (did it cover all requested items?)
   - Quality bar (code compiles? tests pass? no hallucination?)
   - Format requirements (report structure, file outputs, etc.)

**Output of Phase 1:**
```
<improved_task>
  <execution_mode>team_parallel</execution_mode>
  <agent_count>3</agent_count>
  <team_brief>...</team_brief>
  <agents>
    <agent role="Security Auditor">
      <prompt>...</prompt>
    </agent>
    <agent role="Performance Reviewer">
      <prompt>...</prompt>
    </agent>
    <agent role="Test Coverage">
      <prompt>...</prompt>
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

### Phase 2: EXECUTE

Based on execution mode from Phase 1:

**Single Agent:**
```bash
sessions_spawn(task=<improved_prompt>, model=<best_model_for_task>)
```
- Coding → `model="codex"` or tmux claude
- Research → `model="gemini"`
- Analysis → default (Claude)

**Team Parallel (tmux):**
```bash
exec(
  command: "cd <workdir> && CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions",
  pty: true,
  background: true
)
# Then send the improved team brief
process(action: "write", sessionId: "<id>", data: "<team_brief_from_phase1>")
```

**Team Sequential:**
```bash
# Agent 1 → output → feed to Agent 2 → output → feed to Agent 3
sessions_spawn(task=<agent1_prompt>) → result1
sessions_spawn(task=<agent2_prompt + result1>) → result2
sessions_spawn(task=<agent3_prompt + result2>) → final
```

### Phase 3: EVALUATE + RETRY

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

## Example: Full Loop

**Raw input:** "reprompter teams: audit zeroclaw for security issues"

**Phase 1 (IMPROVE):**
- Raw score: 2.5/10 (vague, no scope, no criteria)
- Execution mode: team_parallel (multi-system audit)
- 3 agents: Auth Auditor, Input Validation, Secrets Scanner
- Success criteria: 3+ findings each, severity rated, no false positives
- Improved score: 8.5/10

**Phase 2 (EXECUTE):**
- tmux team launched with 3 agents
- Each gets their improved sub-prompt
- Results collected after ~60-120s

**Phase 3 (EVALUATE):**
- Attempt 1: Score 5/10 — Auth Auditor found issues but Secrets Scanner hallucinated a file path
- Retry 1: "Re-scan for secrets, verify each file path exists with `ls` before reporting"
- Attempt 2: Score 8/10 — All findings verified, severity rated ✓
- ACCEPT. Deliver synthesized report.

---

## Integration Notes

- This skill builds on `reprompter` (prompt engineering) and `agent-teams` (tmux orchestration)
- Both parent skills remain available independently
- When this skill is active, it intercepts agent-team launches and adds the quality loop
- The user sees: task in → quality output out. The loop is invisible unless they ask for details.
- Brief files: `/tmp/rpt-brief-*.md`, reports: `/tmp/rpt-report-*.md`
