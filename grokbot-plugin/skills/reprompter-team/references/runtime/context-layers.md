# Context Layers

Budgeted layered context strategy for subagents.

Context is finite and degrades as it grows. Treat context assembly as curation, not accumulation: include the smallest set of facts that changes decisions, keep the contract visible, and prefer references or file paths over pasted long dumps when the agent can retrieve the source.

## Layer Order

1. `contract` (always preserved): role, scope, requirements, constraints, success criteria
2. `repo_facts`: local code facts relevant to the assigned agent scope
3. `references`: selected templates and short reference excerpts
4. `prior_artifacts`: upstream agent outputs or prior run summaries

## Budget Rules

- Layer 1 cannot be truncated out.
- Remaining layers are budgeted by priority ratios or explicit token caps.
- When over budget, truncate lower-priority layers first.
- Preserve right altitude: summarize broad background, quote only decisive details, and avoid exhaustive edge-case stuffing.
- Prefer references over inline dumps for long material unless the downstream runtime cannot access the referenced source.
- Emit a context manifest with token usage and truncation flags.
