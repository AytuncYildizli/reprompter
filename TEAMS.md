# Reprompter Teams Integration

How Reprompter coordinates multi-agent execution for Team (Parallel) and Team (Sequential) modes.

---

## Overview

When the user selects a team execution mode during the Reprompter interview, the skill:

1. Generates a **team brief** (shared mission, agent roles, coordination rules)
2. Generates **per-agent sub-prompts** (one XML prompt per agent)
3. Hands off to the `agent-teams` skill or Claude Code's Task tool for execution

---

## Security

### Permission Warning

> **Do NOT use `--dangerously-skip-permissions` when spawning team agents.**
>
> This flag disables all permission checks and allows agents to execute arbitrary commands, write to any file, and make network requests without user approval.
>
> **Safer alternative:** Use `--allowedTools` to explicitly whitelist the tools each agent needs:
> ```bash
> # Instead of:
> claude --dangerously-skip-permissions  # DANGEROUS
>
> # Use:
> claude --allowedTools "Read,Write,Edit,Bash,Glob,Grep"  # Scoped
> ```
>
> For team agents that only need read access (e.g., researchers, reviewers), restrict further:
> ```bash
> claude --allowedTools "Read,Glob,Grep,WebFetch"  # Read-only
> ```

### XML Injection in Generated Prompts

When Reprompter generates prompts that will be piped into other tools or agents:

- **Risk:** User input embedded in `<task>` or `<context>` tags could contain malicious XML that alters prompt structure.
- **Mitigation:** Reprompter escapes `<`, `>`, and `&` in user-provided content before embedding in XML tags.
- **For pipeline usage:** Always validate generated prompts before passing them to automated execution systems. Review the generated prompt before confirming execution.

---

## Cost and Token Budget

### Estimated Token Usage by Mode

| Mode | Interview | Generation | Execution | Total Estimate |
|------|-----------|------------|-----------|----------------|
| Quick Mode | 0 | ~500 tokens | ~2K tokens | ~2.5K tokens |
| Full Interview | ~300 tokens | ~1K tokens | ~5K tokens | ~6.3K tokens |
| Team (2 agents) | ~300 tokens | ~2K tokens | ~10K tokens | ~12.3K tokens |
| Team (4 agents) | ~300 tokens | ~4K tokens | ~20K tokens | ~24.3K tokens |
| Team + Closed-Loop | ~300 tokens | ~4K tokens | ~40K tokens | ~44.3K tokens |

### Budget Recommendations

- **Quick tasks:** No special budget needed
- **Team mode:** Expect 3-5x the cost of single-agent mode
- **Closed-loop with retries:** Budget for up to 3x execution cost (original + 2 retries)
- **Large teams (4 agents):** Each agent runs independently; cost scales linearly with agent count

### Monitoring

Track token usage via Claude Code's built-in token counter. If a team run exceeds expectations:
1. Check if retries are being triggered unnecessarily (lower quality threshold from 7 to 6)
2. Reduce agent count if tasks can be consolidated
3. Use Quick Mode for simple sub-tasks within a team

---

## Team Brief Files

### Location

Team briefs are written to: `/tmp/reprompter-brief-{timestamp}.md`

### Cleanup

Briefs in `/tmp/` are automatically cleaned up by the OS on reboot. For manual cleanup:

```bash
# Remove all reprompter brief files
rm -f /tmp/reprompter-brief-*.md
```

> **Note:** Do not rely on `/tmp/` for persistent storage. If you need to keep a brief, copy it to your project directory before the next reboot.

### Brief Lifecycle

1. **Created** during Reprompter team mode generation
2. **Read** by each spawned agent at execution start
3. **Referenced** during coordination checkpoints
4. **Cleaned up** manually or on OS reboot

---

## Execution Modes

### Team (Parallel)

- All agents start simultaneously
- Each agent works on an independent sub-task
- Integration checkpoint after all agents complete
- Best for: frontend + backend, research + implementation

### Team (Sequential)

- Agents run in pipeline order
- Each agent's output feeds the next agent's input
- Best for: data fetch → transform → deploy, research → design → implement

### Auto-Detection

When user selects "Let Reprompter decide", complexity rules determine the mode:

| Signal | Mode |
|--------|------|
| 2+ distinct systems | Team (Parallel) |
| Pipeline/workflow | Team (Sequential) |
| Single component | Single Agent |
| Research + implement | Team (Parallel) |

---

## Integration with agent-teams Skill

If the `agent-teams` skill is installed (`skills/agent-teams/SKILL.md`), Reprompter can hand off execution directly. The handoff includes:

1. The team brief file path
2. Per-agent sub-prompts
3. Coordination rules
4. Success criteria for evaluation

If `agent-teams` is not installed, Reprompter uses Claude Code's built-in Task tool to spawn agents directly.
