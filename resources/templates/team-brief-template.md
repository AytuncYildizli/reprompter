# Team Brief Template

Use this template when execution mode is Team (Parallel) or Team (Sequential). Generates a shared mission brief and per-agent sub-prompts.

## Template

```markdown
# Reprompter Team Brief

- Generated: {timestamp}
- Execution Mode: {Team (Parallel)|Team (Sequential)}
- Overall Task: {high-level objective}

## Agent Roles (2-4)
1. **{Agent 1 Name}** - {scope and responsibilities}
2. **{Agent 2 Name}** - {scope and responsibilities}
3. **{Agent 3 Name}** - {scope and responsibilities}
4. **{Agent 4 Name}** - {scope and responsibilities}

## Per-Agent Sub-Tasks
### {Agent 1 Name}
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### {Agent 2 Name}
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### {Agent 3 Name}
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### {Agent 4 Name}
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

## Coordination Rules
- Shared files/modules: {list files multiple agents may touch}
- Ordering dependencies: {A before B, parallel-safe items}
- Integration checkpoint: {when/how outputs are merged}

## Success Criteria
- {Agent 1 Name}: {measurable outcomes}
- {Agent 2 Name}: {measurable outcomes}
- {Agent 3 Name}: {measurable outcomes}
- {Agent 4 Name}: {measurable outcomes}
```

## When to Use

- Tasks requiring 2-4 parallel or sequential agents
- Large features spanning frontend + backend + tests
- Refactoring efforts that benefit from task decomposition
- Any task where SKILL.md auto-detects or user selects Team mode

## Per-Agent Sub-Prompts

When team mode is selected, generate **N sub-prompts** (one per agent) in addition to the brief. Each sub-prompt uses the standard XML format:

```xml
<role>
{Agent-specific role with domain expertise}
</role>

<context>
- Team brief: {reference to generated brief}
- Scope: {this agent's specific area}
- Dependencies: {what this agent needs from others}
- Coordination: {handoff expectations, shared files}
</context>

<task>
{Single clear sentence — this agent's specific deliverable}
</task>

<requirements>
1. {Primary deliverable}
2. {Secondary deliverable}
3. {Integration requirements with other agents}
</requirements>

<constraints>
- Only modify files within your scope: {list}
- Do not touch: {other agents' files}
- {Agent-specific boundaries}
</constraints>

<output_format>
{What this agent should produce — code, docs, tests, etc.}
</output_format>

<success_criteria>
- {Measurable outcome 1}
- {Measurable outcome 2}
- {Integration test passes}
</success_criteria>
```

## Example

**Raw input:** "build a user dashboard with auth, api endpoints, and test coverage"

**Generated brief:**
```markdown
# Reprompter Team Brief

- Generated: 2026-02-11T11:30:00Z
- Execution Mode: Team (Parallel)
- Overall Task: Build a user dashboard with authentication, API endpoints, and comprehensive test coverage

## Agent Roles (3)
1. **Backend Agent** - API endpoints, auth middleware, database models
2. **Frontend Agent** - Dashboard UI, auth flow, state management
3. **Tests Agent** - Unit tests, integration tests, e2e auth flow tests

## Per-Agent Sub-Tasks
### Backend Agent
- Task(s): Create REST endpoints for user profile, settings, activity; implement JWT auth middleware
- Constraints: Must use existing database schema; do not modify shared config files
- Inputs/Dependencies: None (can start immediately)

### Frontend Agent
- Task(s): Build dashboard layout, profile page, settings page; implement auth context and protected routes
- Constraints: Must use existing design system components; do not create new API routes
- Inputs/Dependencies: Backend Agent's API response shapes (coordinate via shared types)

### Tests Agent
- Task(s): Write unit tests for API endpoints, integration tests for auth flow, e2e test for login → dashboard
- Constraints: Must not modify source code; tests only
- Inputs/Dependencies: Backend and Frontend agents must complete core implementation first

## Coordination Rules
- Shared files/modules: src/types/user.ts (shared type definitions)
- Ordering dependencies: Backend + Frontend parallel; Tests after both complete
- Integration checkpoint: After Backend and Frontend finish, Tests Agent validates integration

## Success Criteria
- Backend Agent: All endpoints return correct data, auth middleware blocks unauthorized requests
- Frontend Agent: Dashboard renders, auth flow works, protected routes redirect
- Tests Agent: 80%+ coverage, all tests pass, e2e auth flow succeeds
```

## Output

Write the generated brief to: `/tmp/reprompter-brief-{timestamp}.md`
Return the file path and include a short summary in chat.
