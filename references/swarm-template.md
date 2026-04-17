# Multi-Agent/Swarm Template

Use this template for tasks requiring multiple coordinated agents. It defines the **prompt structure** for swarm work. The **runtime** (how agents are actually spawned and coordinated) comes from SKILL.md Mode 2 (Repromptverse) Options A–E.

## Template

```xml
<role>
{Swarm coordinator specializing in multi-agent orchestration, task decomposition, and parallel execution}
</role>

<context>
- Orchestration: {reprompter Option A (tmux) | B (TeamCreate+Agent) | C (sessions_spawn) | D (Codex) | E (sequential) — see SKILL.md}
- Topology: {hierarchical, mesh, ring, star}
- Available agents: {agent types available}
- Coordination surface: {shared TaskList, per-agent artifact files at /tmp/rpt-{taskname}-{role}.md, inter-agent SendMessage}
</context>

<task>
{High-level goal that requires multiple agents}
</task>

<motivation>
{Why multi-agent coordination is needed, complexity justification}
</motivation>

<requirements>
1. **Per-agent deliverables**: {Each agent has clearly defined output}
2. **Handoff protocol**: {How work passes between agents — typically artifact files + TaskList status transitions}
3. **Conflict resolution**: {How disagreements or conflicts are resolved}
</requirements>

<agents>
| Agent | Role | Responsibility |
|-------|------|----------------|
| {Agent 1} | {type} | {what they do} |
| {Agent 2} | {type} | {what they do} |
| {Agent 3} | {type} | {what they do} |
</agents>

<task_decomposition>
1. {Subtask 1}: Assigned to {Agent}
2. {Subtask 2}: Assigned to {Agent}
3. {Subtask 3}: Assigned to {Agent}
</task_decomposition>

<coordination>
- Handoff protocol: {artifact file each upstream agent writes, which downstream agents read}
- Shared artifacts: {file paths — usually /tmp/rpt-{taskname}-{role}.md per agent, plus /tmp/rpt-{taskname}-final.md for synthesis}
- Sync points: {TaskList status transitions or explicit SendMessage}
- Conflict resolution: {how to handle disagreements}
</coordination>

<constraints>
- {Resource limits}
- {Agent boundaries — what each agent should NOT do}
- {Coordination overhead limits}
- Do not let agents modify files outside their assigned scope
- Do not allow agents to duplicate each other's work
- Do not skip the synthesis step — individual outputs must be merged
</constraints>

<output_format>
{Per-agent artifact paths (e.g. /tmp/rpt-{taskname}-{role}.md), synthesis path (/tmp/rpt-{taskname}-final.md), coordination log}
</output_format>

<success_criteria>
- All subtasks completed successfully
- Agents coordinated without conflicts
- {Specific outcome achieved}
- {Quality metrics met}
</success_criteria>
```

## When to Use

- Complex tasks requiring parallel execution
- Tasks spanning multiple domains (frontend + backend + tests)
- Research tasks requiring multiple perspectives
- Large refactoring efforts
- Performance optimization across systems

## Example

**Raw input:** "refactor our api to use graphql, need to update backend, frontend, and tests"

**Generated:**
```xml
<role>
Swarm coordinator specializing in full-stack refactoring, GraphQL migration, and multi-agent orchestration via reprompter Option B (native TeamCreate + Agent).
</role>

<context>
- Orchestration: reprompter Option B — TeamCreate + per-agent Agent(team_name=...) spawn; shared TaskList at ~/.claude/tasks/rpt-graphql-migration/
- Current state: REST API with 15 endpoints
- Target state: GraphQL API with equivalent functionality
- Coordination surface: per-agent artifact files at /tmp/rpt-graphql-migration-{role}.md + SendMessage for cross-agent signalling
</context>

<task>
Migrate the existing REST API to GraphQL while maintaining all functionality, updating the frontend to use GraphQL queries, and ensuring comprehensive test coverage.
</task>

<motivation>
Full-stack migration spanning 3 domains (backend, frontend, tests) — too complex for a single agent. Parallel execution cuts estimated time from 3 days to 1 day. Interdependencies require formal coordination.
</motivation>

<requirements>
1. **Per-agent deliverables**: Each agent produces reviewed, tested code in their domain, plus a summary artifact at /tmp/rpt-graphql-migration-{role}.md
2. **Handoff protocol**: Schema artifact must be written before backend/frontend implementation starts
3. **Conflict resolution**: Architect has final say on schema; reviewer decides implementation disputes
</requirements>

<agents>
| Agent | Role | Responsibility |
|-------|------|----------------|
| architect | system-architect | Design GraphQL schema, define types and resolvers |
| backend-coder | coder | Implement GraphQL server, resolvers, and data layer |
| frontend-coder | coder | Update frontend to use GraphQL queries/mutations |
| tester | tester | Write tests for GraphQL resolvers and frontend integration |
| reviewer | reviewer | Review all changes for consistency and best practices |
</agents>

<task_decomposition>
1. Schema Design: architect analyzes REST endpoints, designs GraphQL schema
2. Backend Implementation: backend-coder implements resolvers after schema approval
3. Frontend Migration: frontend-coder updates components (parallel with backend)
4. Test Coverage: tester writes tests as each piece completes
5. Code Review: reviewer validates each component
</task_decomposition>

<coordination>
- Handoff protocol (file artifacts + TaskList, not shared memory):
  - architect → backend-coder + frontend-coder: /tmp/rpt-graphql-migration-schema.md (types + resolver stubs + client queries)
  - backend-coder → tester: /tmp/rpt-graphql-migration-backend.md + TaskUpdate status=completed on "Backend Implementation"
  - frontend-coder → tester: /tmp/rpt-graphql-migration-frontend.md + TaskUpdate status=completed on "Frontend Migration"

- Shared artifacts:
  - /tmp/rpt-graphql-migration-schema.md: Type definitions + resolver stubs + client query templates
  - /tmp/rpt-graphql-migration-backend.md: Resolver implementations + notes
  - /tmp/rpt-graphql-migration-frontend.md: Client migration summary
  - /tmp/rpt-graphql-migration-tests.md: Test coverage report
  - /tmp/rpt-graphql-migration-review.md: Reviewer notes per component
  - /tmp/rpt-graphql-migration-final.md: Synthesis (written by team lead after all agents complete)

- Sync points:
  - After schema design: backend-coder + frontend-coder unblocked via TaskList
  - After backend implementation: tester unblocked for resolver tests
  - Before final merge: reviewer task must be completed

- Conflict resolution:
  - Schema disagreements: SendMessage to architect, await reply
  - Implementation approach: reviewer decides (SendMessage with review notes)
</coordination>

<constraints>
- Do not modify unrelated code outside API/GraphQL scope
- Maintain backward compatibility during migration (REST still works)
- Each agent focuses on their domain only
- Maximum 3 sync points to minimize overhead
- Do not let the frontend agent modify backend schema files
- Do not skip the review agent's approval before merging
</constraints>

<output_format>
1. Per-agent artifact files at /tmp/rpt-graphql-migration-{role}.md (one per agent)
2. Synthesis at /tmp/rpt-graphql-migration-final.md — all changes merged + per-role summaries
3. TaskList history as the coordination log
</output_format>

<success_criteria>
- GraphQL API serves all 15 original REST endpoints
- Frontend uses GraphQL for all data fetching
- 80%+ test coverage on new GraphQL code
- No regression in existing functionality
- All agents complete without blocking conflicts
</success_criteria>
```

## Integration with reprompter

The template above defines the **prompt structure**. Execution happens via SKILL.md Mode 2 (Repromptverse). Pick the option that matches your runtime:

| Option | Surface | When to use |
|--------|---------|-------------|
| A | `tmux` + `claude --model opus` | Agents fully independent, visible terminal panes wanted |
| B | `TeamCreate` + `Agent(team_name=...)` + `SendMessage` | Native Claude Code teams; agents need to message each other |
| C | `sessions_spawn` | OpenClaw runtime |
| D | Codex parallel sessions | Codex runtime |
| E | Sequential (any LLM) | No parallel infrastructure available |

Option B runtime sketch (full version in SKILL.md `#### Option B: TeamCreate`):

```text
TeamCreate(team_name="rpt-graphql-migration", description="REST→GraphQL swarm")

TaskCreate(subject="Schema Design", description="...")
TaskCreate(subject="Backend GraphQL", description="...")
TaskCreate(subject="Frontend Migration", description="...")
TaskCreate(subject="Test Coverage", description="...")
TaskCreate(subject="Code Review", description="...")

Agent(description="Schema architect", subagent_type="general-purpose",
      team_name="rpt-graphql-migration", name="architect", model="opus",
      prompt="<architect prompt from this template>",
      run_in_background=true)
# ... one Agent per role (backend-coder, frontend-coder, tester, reviewer)

# poll TaskList until every task completes, then shut down each teammate
# by name (broadcast to="*" rejects structured messages) and wait for
# each shutdown_response before calling TeamDelete().
SendMessage(to="architect", message={"type": "shutdown_request"})
SendMessage(to="backend-coder", message={"type": "shutdown_request"})
SendMessage(to="frontend-coder", message={"type": "shutdown_request"})
SendMessage(to="tester", message={"type": "shutdown_request"})
SendMessage(to="reviewer", message={"type": "shutdown_request"})
TeamDelete()
```
