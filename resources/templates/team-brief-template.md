# Team Brief Template

Use this template when execution mode is Team (Parallel or Sequential).

---

## Brief Structure

```markdown
# Reprompter Team Brief

**Generated:** [timestamp]
**Execution Mode:** [Parallel | Sequential]
**Overall Task:** [one-line summary]

## Agent Roles
1. [Agent Name] — [responsibility summary]
2. [Agent Name] — [responsibility summary]
3. [Agent Name] — [responsibility summary]

## Per-Agent Subtasks

### [Agent 1 Name]
- [subtask 1]
- [subtask 2]
- [subtask 3]

### [Agent 2 Name]
- [subtask 1]
- [subtask 2]
- [subtask 3]

### [Agent 3 Name]
- [subtask 1]
- [subtask 2]
- [subtask 3]

## Coordination Rules
- [handoff rule 1]
- [handoff rule 2]
- [shared contract / DTO rule]
- [integration checkpoint]

## Success Criteria
- [criterion 1]
- [criterion 2]
- [criterion 3]
```

## Usage Notes

- Save the generated brief to `/tmp/reprompter-brief-<timestamp>.md`
- Each agent also gets a separate XML sub-prompt (use the standard template per agent)
- Coordination rules should specify:
  - Which agent publishes contracts/schemas first
  - How agents share type definitions or DTOs
  - When integration checkpoints happen
  - Merge order if sequential
- For **Parallel** mode: agents work simultaneously, share contracts
- For **Sequential** mode: specify pipeline order and handoff format

## Example

See the crypto dashboard example in SKILL.md for a complete team brief with 3 agents (Frontend, Backend, Tests).
