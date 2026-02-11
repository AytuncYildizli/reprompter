# Team Brief Template

Use this template when execution mode is Team (Parallel) or Team (Sequential).

## Template

```markdown
# Reprompter Team Brief

- Generated: {timestamp}
- Execution Mode: {Team (Parallel)|Team (Sequential)}
- Overall Task: {high-level objective}

## Agent Roles (2-4)
1. **Frontend Agent** - {scope}
2. **Backend Agent** - {scope}
3. **Tests Agent** - {scope}
4. **Research Agent** - {scope}

## Per-Agent Sub-Tasks
### Frontend Agent
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### Backend Agent
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

## Coordination Rules
- Shared files/modules: {list}
- Ordering dependencies: {A before B, parallel-safe items}
- Integration checkpoint: {when/how outputs are merged}

## Success Criteria
- Frontend Agent: {measurable outcomes}
- Backend Agent: {measurable outcomes}
- Tests Agent: {measurable outcomes}
- Research Agent: {measurable outcomes}
```

## When to Use

- Team (Parallel) execution mode selected
- Team (Sequential) execution mode selected
- Auto-detect resolves to team mode
- Tasks involving 2+ distinct systems or layers

## Notes

- Write brief to `/tmp/reprompter-brief-{timestamp}.md` during execution
- Return file path and include summary in chat
- Each agent gets their own sub-prompt derived from this brief
