# Team Brief Template

<!-- Formal exception: team briefs are orchestration artifacts consumed by the lead/orchestrator.
     Canonical format is Markdown for readability and coordination.
     The XML-equivalent 8 core tags are still REQUIRED conceptually and must be explicitly mapped.
     Markdown sections below are the normative representation of those tags. -->

## Format Contract (Markdown Exception)

- This template is the **only formal exception** to strict XML file format.
- It MUST still define all 8 core fields conceptually: `role`, `context`, `task`, `motivation`, `requirements`, `constraints`, `output_format`, `success_criteria`.
- Negative constraints are mandatory in `constraints` (at least 3 explicit "Do NOT ..." rules).

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

## Role
Lead orchestrator coordinating specialized agents to deliver the overall task safely and without overlap.

## Context
- Project/repo: {path or identifier}
- Relevant systems: {frontend/backend/db/etc}
- Known constraints/dependencies: {brief bullets}

## Task
{high-level objective}

## Motivation
{Project urgency, resource justification, expected ROI}

## Requirements
- Define 2-5 agent roles with clear ownership boundaries
- Define per-agent deliverables with measurable expectations
- Define dependency order and integration checkpoint
- Define exact output file path per agent
- Define review criteria for final synthesis

## Constraints
- Do NOT assign overlapping ownership across agents
- Do NOT modify files outside declared scope boundaries
- Do NOT leave output destinations unspecified
- Do NOT merge outputs before dependency prerequisites are complete

## Output Format
- Team brief path: `/tmp/rpt-brief-{taskname}.md`
- Per-agent outputs: `/tmp/rpt-{taskname}-{agent-domain}.md`
- Final synthesis: `/tmp/rpt-{taskname}-final.md`

## Success Criteria
- Every agent has non-overlapping scope and explicit deliverables
- All output paths are defined and unique
- Dependency order is explicit and actionable
- Final synthesis criteria are measurable and reviewable

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
```

## Example

```markdown
# Reprompter Team Brief

- Generated: 2026-02-12T00:30:00Z
- Execution Mode: Team (Parallel)

## Role
Lead orchestrator coordinating three agents for backend, frontend, and testing workstreams.

## Context
- Project/repo: /tmp/reprompter-check
- Relevant systems: React frontend, Express API, PostgreSQL
- Known constraints/dependencies: Frontend depends on stable API contract

## Task
Build a REST API with authentication and a React dashboard.

## Motivation
MVP deadline in 2 weeks. Three distinct skill domains (backend, frontend, testing) benefit from parallel execution. Expected 3x speedup vs sequential single-agent approach.

## Requirements
- Define backend, frontend, and test ownership with no overlap
- Publish API contract for frontend/test consumers
- Ensure each agent writes to unique output file
- Include dependency order and merge checkpoint
- Provide measurable acceptance conditions for each role

## Constraints
- Do NOT let frontend implement backend auth logic
- Do NOT let tests mutate production source files
- Do NOT skip API contract publication before integration

## Output Format
- Team brief: /tmp/rpt-brief-chat-api.md
- Backend output: /tmp/rpt-chat-api-backend.md
- Frontend output: /tmp/rpt-chat-api-frontend.md
- Tests output: /tmp/rpt-chat-api-tests.md
- Final synthesis: /tmp/rpt-chat-api-final.md

## Success Criteria
- Backend, frontend, tests scopes are disjoint and complete
- Output files exist at exact declared paths
- API contract used consistently across agents
- Final synthesis confirms integration pass

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
```

## Notes

- Write brief to `/tmp/rpt-brief-{taskname}.md` during execution
- Return file path and include summary in chat
- Each agent gets their own sub-prompt derived from this brief
