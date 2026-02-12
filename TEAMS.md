# RePrompter Team Execution

How to run RePrompter's multi-agent execution using Claude Code Agent Teams.

**TL;DR:**
- **Primary:** Claude Code Agent Teams via PTY (tmux) — tested and proven
- **Fallback:** `sessions_spawn` solo agents when tmux/Claude Code unavailable
- **Single-agent:** `claude --print --model opus` for quick tasks

> ⚠️ **CRITICAL:** Always include "CRITICAL: Use model opus for ALL tasks" in the team prompt. Default teammate model is **Haiku** — without explicit instruction, teammates degrade to Haiku quality.

---

## Primary: Agent Teams via tmux (PROVEN PATTERN)

### The Pattern (Copy-Paste Ready)

```bash
# Step 1: Start Claude Code with Agent Teams enabled
tmux new-session -d -s rpt-exec "cd <WORKDIR> && CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --model opus --dangerously-skip-permissions"

# Step 2: Wait for startup
sleep 8

# Step 3: Send prompt — MUST use -l (literal) flag, then SEPARATE Enter
tmux send-keys -t rpt-exec -l '<TEAM_PROMPT>'
sleep 0.5
tmux send-keys -t rpt-exec Enter

# Step 4: Monitor progress (poll every 15-30s)
tmux capture-pane -t rpt-exec -p -S -100

# Step 5: Verify output files exist
ls -la /tmp/rpt-*.md

# Step 6: Cleanup
tmux kill-session -t rpt-exec
```

### ⚠️ CRITICAL: send-keys Pattern

**This is the #1 cause of failures.** The text and Enter MUST be separate commands:

```bash
# ✅ CORRECT — literal flag + separate Enter
tmux send-keys -t SESSION -l 'your prompt text here'
sleep 0.5
tmux send-keys -t SESSION Enter

# ❌ WRONG — Enter in same command breaks multiline
tmux send-keys -t SESSION "your prompt text" Enter

# ❌ WRONG — without -l flag, special chars break
tmux send-keys -t SESSION 'your prompt text'
```

### Team Prompt Template

When generating the team prompt from RePrompter's brief, format it as a SINGLE LINE (no newlines) for tmux reliability:

```
Create an agent team with N teammates. CRITICAL: Use model opus for ALL tasks. Teammate 1 (ROLE): TASK. Write output to /tmp/rpt-ROLE.md. Teammate 2 (ROLE): TASK. Write output to /tmp/rpt-ROLE.md. After all teammates complete, read all output files and write a combined synthesis to /tmp/rpt-synthesis.md
```

Key rules:
1. **Single line** — no newlines in the prompt
2. **Explicit output paths** — each teammate MUST write to a specific file
3. **"CRITICAL: Use model opus for ALL tasks"** — always include this
4. **Synthesis step** — lead reads all outputs and combines
5. **Max 3-4 teammates** — more causes diminishing returns and context bloat

### Monitoring & Verification

```bash
# Check progress (look for cost increase = working)
tmux capture-pane -t rpt-exec -p | grep -E '💰|📊|⏱|TeamCreate|Task|Teammate'

# Check if output files were written
for f in /tmp/rpt-*.md; do echo "=== $f ===" && head -5 "$f"; done

# Timeout: if no progress after 3 minutes, kill and retry
```

### Proven Test Results (2026-02-12)
- 2 teammates (Analyzer + Scorer) ran in parallel
- Fan-out/fan-in: tasks #1, #2 parallel → #3 blocked by both
- All 3 output files written successfully
- Lead did real synthesis (not just concatenation)
- Teammates shut down gracefully
- **Cost:** $0.70 | **Time:** 1:28 | **Context used:** 28% of 200K

---

## Fallback: sessions_spawn (Solo Agents)

Use when Claude Code / tmux is unavailable (e.g., sandbox, remote).

```
1. Write team brief to /tmp/reprompter-brief-{timestamp}.md
2. For each agent role:
   sessions_spawn(
     task: "<per-agent sub-prompt from brief>",
     model: "opus",  # or "codex" for coding tasks
     label: "rpt-{role}"
   )
3. Wait for all to complete
4. Read outputs and synthesize
```

### When to use sessions_spawn over Agent Teams
- No tmux available
- No Claude Code CLI available  
- Need deterministic, observable file-per-agent artifacts
- Simple independent tasks that don't need teammate coordination

---

## Quick Single-Agent (No Team Needed)

For tasks that don't need parallel execution:

```bash
echo "PROMPT" | claude --print --model opus --dangerously-skip-permissions
```

Or via sessions_spawn:
```
sessions_spawn(task: "...", model: "opus")
```

---

## Integration with RePrompter Execution Flow

### Full Repromptception Pipeline

```
1. IMPROVE: Raw prompt → interview → structured prompt + team brief
2. EXECUTE: 
   a. Write brief to /tmp/reprompter-brief-{timestamp}.md
   b. Generate single-line team prompt from brief
   c. Start tmux Agent Teams session
   d. Send team prompt (literal + separate Enter)
   e. Monitor progress (poll every 15-30s)
   f. Verify output files
3. EVALUATE:
   a. Read all output files
   b. Score against success criteria (0-10)
   c. Score ≥ 7 → ACCEPT
   d. Score 4-6 → RETRY with delta prompt
   e. Score < 4 → RETRY with full rewrite
   f. Max 2 retries
4. DELIVER: Combined synthesis + individual outputs
```

### Generating the Team Prompt from Brief

Transform the team brief into a tmux-safe single-line prompt:

```
Input (brief):
  Agent 1: Security Auditor - scan for vulnerabilities
  Agent 2: Performance Reviewer - find slow paths
  Agent 3: Test Coverage - identify untested functions

Output (tmux prompt):
  "Create an agent team with 3 teammates. CRITICAL: Use model opus for ALL tasks. Teammate 1 (Security Auditor): Scan for vulnerabilities and injection risks. Write findings to /tmp/rpt-security.md. Teammate 2 (Performance Reviewer): Find N+1 queries, memory leaks, and slow paths. Write findings to /tmp/rpt-performance.md. Teammate 3 (Test Coverage): Identify untested functions and edge cases. Write findings to /tmp/rpt-tests.md. After all teammates complete, read all output files and write a prioritized action list to /tmp/rpt-synthesis.md"
```

---

## Known Constraints

1. **Each teammate has 200K token context window** — not a time limit, token budget
2. **Teammate default model is Haiku** — always specify opus explicitly
3. **`--print` mode cannot do Agent Teams** — interactive PTY required
4. **File-writing can be inconsistent** — always verify output files exist
5. **Long runs risk auth/billing token expiration** — keep tasks focused
6. **Max practical team size: 3-4** — beyond that, coordination overhead dominates
