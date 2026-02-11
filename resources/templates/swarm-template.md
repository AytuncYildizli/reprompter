# Multi-Agent/Swarm Template

Use this template for tasks requiring multiple coordinated agents.

## Template

```xml
<role>
{Swarm coordinator specializing in multi-agent orchestration, task decomposition, and parallel execution}
</role>

<context>
- Orchestration: {Claude Flow, custom swarm, etc.}
- Topology: {hierarchical, mesh, ring, star}
- Available agents: {agent types available}
- Memory system: {shared memory, message passing, etc.}
</context>

<objective>
{High-level goal that requires multiple agents}
</objective>

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
- Handoff protocol: {how agents pass work}
- Shared memory keys: {what to store/retrieve}
- Sync points: {when agents must coordinate}
- Conflict resolution: {how to handle disagreements}
</coordination>

<constraints>
- {Resource limits}
- {Agent boundaries - what each agent should NOT do}
- {Coordination overhead limits}
</constraints>

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
Swarm coordinator specializing in full-stack refactoring, GraphQL migration, and multi-agent orchestration with Claude Flow.
</role>

<context>
- Orchestration: Claude Flow V3 with hierarchical-mesh topology
- Current state: REST API with 15 endpoints
- Target state: GraphQL API with equivalent functionality
- Memory system: Claude Flow memory with HNSW indexing
</context>

<objective>
Migrate the existing REST API to GraphQL while maintaining all functionality, updating the frontend to use GraphQL queries, and ensuring comprehensive test coverage.
</objective>

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
- Handoff protocol:
  - architect → backend-coder: Schema stored in memory key "graphql-schema"
  - architect → frontend-coder: Query definitions in "graphql-queries"
  - backend-coder → tester: Resolver completion signals via "backend-ready"
  - frontend-coder → tester: Component completion via "frontend-ready"

- Shared memory keys:
  - "graphql-schema": Type definitions and schema
  - "graphql-queries": Client-side query templates
  - "migration-status": Progress tracking
  - "blocking-issues": Issues requiring coordination

- Sync points:
  - After schema design (all agents review)
  - After backend implementation (frontend can start)
  - Before final merge (all tests must pass)

- Conflict resolution:
  - Schema disagreements: architect has final say
  - Implementation approach: discuss in memory, reviewer decides
</coordination>

<constraints>
- Do not modify unrelated code outside API/GraphQL scope
- Maintain backward compatibility during migration (REST still works)
- Each agent focuses on their domain only
- Maximum 3 sync points to minimize overhead
</constraints>

<success_criteria>
- GraphQL API serves all 15 original REST endpoints
- Frontend uses GraphQL for all data fetching
- 80%+ test coverage on new GraphQL code
- No regression in existing functionality
- All agents complete without blocking conflicts
</success_criteria>
```

## Integration with Claude Flow

When using this template with Claude Flow, spawn agents like:

```javascript
// Initialize swarm
mcp__claude-flow__swarm_init({ topology: "hierarchical-mesh", maxAgents: 5 })

// Spawn agents concurrently
Task("Schema Design", "[architect prompt]", "architecture")
Task("Backend GraphQL", "[backend prompt]", "coder")
Task("Frontend Migration", "[frontend prompt]", "coder")
Task("Test Coverage", "[tester prompt]", "tester")
Task("Code Review", "[reviewer prompt]", "reviewer")

// Store coordination context
mcp__claude-flow__memory_store({ key: "swarm-objective", value: "[objective]" })
```
