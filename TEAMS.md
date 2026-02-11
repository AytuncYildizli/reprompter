---
name: reprompter-teams
description: Closed-loop quality system for Claude Code Agent Teams. RePrompter improves prompts before execution, then evaluates output and retries if needed. Designed for Claude Code's native agent teams feature (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1).
version: 2.0.0
---

# RePrompter Teams v2.0 — Closed-Loop Claude Code Agent Teams

> Your prompt sucks → RePrompter fixes it → Claude Code Agent Teams execute it → Output gets scored → Retry if it sucks.

## What This Is

A quality wrapper around **Claude Code's native Agent Teams**. Three phases:

1. **IMPROVE** — RePrompter engineers the prompt before agents see it
2. **EXECUTE** — Claude Code Agent Teams run it (native `claude` with teams enabled)
3. **EVALUATE + RETRY** — Score the output, retry with delta prompt if quality is low

## Prerequisites

- Claude Code CLI installed (`claude` command available)
- Agent Teams enabled: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings or env
- Or pass as env: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions`

---

## Phase 1: IMPROVE (RePrompter)

Take the raw task. Run RePrompter analysis:

### 1.1 Score the raw prompt (0-10)
Dimensions: Clarity, Specificity, Structure, Context, Constraints, Examples, Edge Cases, Decomposition

### 1.2 Detect team composition
Based on task complexity, determine:
- **How many agents?** (2-5, based on independent work streams)
- **What roles?** (e.g., Security Auditor, Performance Reviewer, Test Coverage)
- **Parallel or sequential?** (independent = parallel, pipeline = sequential)

### 1.3 Generate the team brief
This is what gets sent to Claude Code. It must follow the native agent teams format:

```
Create an agent team with N teammates:
1. <Role> - <detailed task description from RePrompter>
2. <Role> - <detailed task description from RePrompter>
3. <Role> - <detailed task description from RePrompter>

Coordination rules:
- Each agent: read the relevant files, produce findings with severity ratings
- No hallucinated file paths — verify with `ls` or `cat` before referencing
- Each agent must produce at least 3 actionable findings
- Final synthesis: prioritize by impact, deduplicate across agents

Give me a final synthesized report when all agents are done.
```

### 1.4 Define success criteria
Machine-checkable criteria extracted from the task:

```xml
<success_criteria>
  <criterion>Each agent produces a report with findings + severity</criterion>
  <criterion>At least 3 actionable findings per agent</criterion>
  <criterion>No hallucinated file paths or function names</criterion>
  <criterion>Final synthesis prioritizes by impact</criterion>
  <criterion>Total report covers all requested areas</criterion>
</success_criteria>
```

### 1.5 Show improvement score
```
Raw prompt:  3.2/10 — "audit zeroclaw for security issues"
Improved:    8.7/10 — Structured team brief with 3 specialized agents, 
                       explicit file paths, severity framework, success criteria
```

---

## Phase 2: EXECUTE (Claude Code Agent Teams)

### Interactive Mode (recommended)
Launch Claude Code with agent teams enabled:

```bash
cd <project_directory>
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions
```

Then paste the team brief from Phase 1. Claude Code will:
- Spawn N agents as sub-processes
- Each agent works independently on their assigned task
- Agents can read/write files, run commands, use tools
- Claude Code synthesizes results when all agents complete

### Headless Mode (for automation)
For non-interactive execution via PTY:

```bash
exec(
  command: "cd <workdir> && CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions",
  pty: true,
  background: true
)
```

Wait for startup (~5s), then send the team brief:
```bash
process(action: "write", sessionId: "<id>", data: "<team_brief>\n")
```

Monitor progress:
```bash
process(action: "poll", sessionId: "<id>", timeout: 120000)
```

Look for "agents spawned" messages and the final synthesis.

### Using `claude --print` (for simpler tasks)
For tasks that don't need interactive agent teams but benefit from RePrompter's prompt improvement:

```bash
claude --print -p "<improved_prompt_from_phase1>" 2>/dev/null
```

This runs a single Claude Code instance with the improved prompt, captures output for Phase 3 evaluation.

---

## Phase 3: EVALUATE + RETRY

### 3.1 Score the output (0-10)

| Dimension | What to check |
|-----------|---------------|
| Completeness | Did it address all success criteria? |
| Accuracy | Are file paths, function names, data points real? |
| Actionability | Can you act on the findings? Are fixes concrete? |
| Depth | Thorough analysis or surface-level? |

### 3.2 Decision logic

```
Score ≥ 7  →  ACCEPT. Deliver to user.
Score 4-6  →  RETRY with delta prompt (fix specific gaps).
Score < 4  →  RETRY with rewritten approach.
Max 2 retries (3 total attempts).
```

### 3.3 Delta prompt for retry

Don't re-run the full prompt. Send a targeted fix:

```
Previous attempt scored 5/10.

✅ Good: Agents 1 and 2 produced solid findings with severity ratings.
❌ Missing: Agent 3 (Secrets Scanner) hallucinated file paths that don't exist.
❌ Missing: Final synthesis missing — no prioritized action list.

This retry: 
- Agent 3: Re-scan, verify every file path with `ls` before including
- Synthesizer: Combine all findings into a prioritized top-10 list

Previous output for context:
<previous_output>
[paste relevant sections]
</previous_output>
```

### 3.4 Retry execution

Same as Phase 2 — launch Claude Code Agent Teams with the delta prompt. The delta prompt includes previous context so agents don't repeat good work.

After 2 failed retries: deliver the best attempt with a quality warning explaining what's still missing.

---

## Example: Full Loop

### Raw input
```
"audit the tweet engine for bugs"
```

### Phase 1 (IMPROVE)
```
Raw score: 2.5/10 (vague — what kind of bugs? which files? what output format?)

Improved team brief:
  Create an agent team with 3 teammates:
  1. Code Quality Auditor — Read ~/scripts/tweet-engine/generate-tweets.py. 
     Check: error handling on every API call, rate limiting, data validation 
     before DB writes. Severity: critical/high/medium/low per finding.
  2. Logic Auditor — Same file. Check: source prioritization correctness, 
     duplicate detection accuracy, account separation. Include line numbers.
  3. Security Auditor — All .py files in the directory. Check: hardcoded 
     credentials, SQL injection, input sanitization. Verify file paths exist.
  
  Synthesize into a prioritized top-10 action list when done.

Improved score: 8.5/10

Success criteria:
- 3+ findings per agent with severity
- All file paths verified (no hallucination)  
- Line number references
- Prioritized synthesis
```

### Phase 2 (EXECUTE)
```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions
> [paste team brief]
> [agents spawn, work, report back in ~60-120s]
```

### Phase 3 (EVALUATE)
```
Attempt 1: Score 5/10
- ✅ Code Quality: 4 findings, all with severity
- ✅ Logic: 3 findings with line numbers
- ❌ Security: Only 1 finding, missed hardcoded DB credentials
- ❌ Synthesis: Missing

Retry 1 (delta prompt):
"Security agent missed hardcoded credentials at line 18 of generate-tweets.py 
and line 10 of fetch-engagement.py. Re-scan all .py files for hardcoded 
passwords, API keys, connection strings. Also produce the final synthesis."

Attempt 2: Score 8/10
- All criteria met ✓
ACCEPT → deliver to user.
```

---

## File Conventions

- Team briefs saved to: `/tmp/rpt-brief-<timestamp>.md`
- Final reports saved to: `/tmp/rpt-report-<timestamp>.md`
- These persist across sessions for reference

---

## Tips

- **More context in raw prompt = better team brief.** Mention specific files, tech stack, what you care about.
- **3 agents is the sweet spot** for most tasks. 2 is too few for cross-cutting concerns, 5+ adds coordination overhead.
- **Agent Teams work best when agents are independent.** Don't assign agents to the same files — they'll conflict on writes.
- **`--dangerously-skip-permissions` is required** for unattended agent work (file reads/writes, command execution).
- **The quality loop is invisible to the user.** They give a task, they get quality output. The retry machinery runs silently unless they ask for details.
