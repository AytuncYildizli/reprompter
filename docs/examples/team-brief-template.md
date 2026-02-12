# Team Brief Template

<!-- NOTE: This template is intentionally Markdown format (not XML) for orchestration briefs.
     Team briefs coordinate multiple agents and are consumed by the orchestrator, not individual agents.
     The Markdown structure maps to XML concepts: sections ≈ XML elements, bullets ≈ content. -->

## When to Use

- Team (Parallel) execution mode selected
- Team (Sequential) execution mode selected
- Auto-detect resolves to team mode
- Tasks involving 2+ distinct systems or layers

## Template

```markdown
# Reprompter Team Brief

- Generated: {timestamp}
- Execution Mode: {Team (Parallel)|Team (Sequential)}
- Overall Task: {high-level objective}

## Motivation
{Project urgency, resource justification, expected ROI}

## Agent Roles (2-5)
1. **Frontend Agent** - {scope}
2. **Backend Agent** - {scope}
3. **Tests Agent** - {scope}
4. **Research Agent** - {scope}
5. **Integration/Ops Agent (optional)** - {scope}

## Per-Agent Sub-Tasks
### Frontend Agent
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### Backend Agent
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### Tests Agent
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### Research Agent
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### Integration/Ops Agent (optional)
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
- Integration/Ops Agent (optional): {measurable outcomes}
```

## Example

```markdown
# Reprompter Team Brief

- Generated: 2026-02-12T00:30:00Z
- Execution Mode: Team (Parallel)
- Overall Task: Build a REST API with authentication and a React dashboard

## Motivation
MVP deadline in 2 weeks. Three distinct skill domains (backend, frontend, testing) benefit from parallel execution. Expected 3x speedup vs sequential single-agent approach.

## Agent Roles (3)
1. **Backend Agent** - REST API with Express, JWT auth, PostgreSQL
2. **Frontend Agent** - React dashboard with auth flow, data tables
3. **Tests Agent** - E2E tests for API + integration tests for auth

## Per-Agent Sub-Tasks
### Backend Agent
- Task(s): API routes (CRUD + auth), database schema, JWT middleware
- Constraints: Must use Express + Prisma, no raw SQL
- Inputs/Dependencies: None (can start immediately)

### Frontend Agent
- Task(s): Login/register pages, dashboard with data table, API client
- Constraints: Must use React + TanStack Query, match existing design system
- Inputs/Dependencies: Backend API contract (OpenAPI spec)

### Tests Agent
- Task(s): API E2E tests (auth + CRUD), frontend integration tests
- Constraints: Must use Vitest + Playwright, 80% coverage target
- Inputs/Dependencies: Both Backend and Frontend must be complete

## Coordination Rules
- Shared files/modules: `types/api.ts` (shared types), `lib/auth.ts` (auth helpers)
- Ordering dependencies: Backend first → Frontend parallel with Tests setup → Tests run last
- Integration checkpoint: After all agents complete, run full test suite

## Success Criteria
- Backend Agent: All CRUD + auth endpoints return correct status codes
- Frontend Agent: Login flow works, dashboard renders data from API
- Tests Agent: 80%+ coverage, all E2E tests pass
```

## Notes

- Write brief to `/tmp/rpt-brief-{timestamp}.md` during execution
- Return file path and include summary in chat
- Each agent gets their own sub-prompt derived from this brief
