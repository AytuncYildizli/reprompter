# Context Layers

Budgeted layered context strategy for subagents.

## Layer Order

1. `contract` (always preserved): role, scope, requirements, constraints, success criteria
2. `repo_facts`: local code facts relevant to the assigned agent scope
3. `references`: selected templates and short reference excerpts
4. `prior_artifacts`: upstream agent outputs or prior run summaries

## Budget Rules

- Layer 1 cannot be truncated out.
- Remaining layers are budgeted by priority ratios or explicit token caps.
- When over budget, truncate lower-priority layers first.
- Emit a context manifest with token usage and truncation flags.
