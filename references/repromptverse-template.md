# Repromptverse Template

Use this template for multi-agent tasks that need explicit routing, stop rules, and evaluator-driven retries.

## Template

```xml
<role>
{Lead orchestrator specializing in multi-agent planning, routing, and quality control}
</role>

<context>
- Runtime: {Claude Code | OpenClaw | Codex | Other}
- Topology: {star | hierarchical | mesh | pipeline}
- Agent roster: {agent ids and domain ownership}
- Shared state: {memory keys, output paths, message channels}
</context>

<task>
{High-level objective that requires multiple agents}
</task>

<motivation>
{Why multi-agent execution is justified vs single-agent}
</motivation>

<requirements>
- Define 2-6 agents with non-overlapping ownership
- Define explicit handoff points and dependency order
- Define measurable output for each agent
- Define synthesis output and acceptance criteria
- Define evaluator retry thresholds
</requirements>

<routing_policy>
- Router type: {lead-decides | selector | round-robin}
- Speaker selection rules: {who talks next and why}
- Escalation path: {who resolves conflicts}
</routing_policy>

<termination_policy>
- Max turns per agent: {number}
- Max wall time: {duration}
- Stop conditions:
  - All required artifacts exist and pass checks
  - No state change across N consecutive polls
  - Retry budget exhausted
</termination_policy>

<artifact_contract>
- Agent output path: `/tmp/rpt-{taskname}-{agent}.md`
- Mandatory sections: {findings | decisions | risks | next actions}
- File ownership: one writer per artifact
- Handoff format: checklist + unresolved blockers
</artifact_contract>

<evaluation_loop>
- Score each artifact on: clarity, coverage, verifiability, boundary-respect
- Accept if score >= {threshold}
- Retry policy: max 2 retries with delta prompt only
- Final synthesis path: `/tmp/rpt-{taskname}-final.md`
</evaluation_loop>

<constraints>
- Do NOT assign overlapping file ownership across agents
- Do NOT allow unbounded polling or infinite wait loops
- Do NOT merge outputs before dependency checkpoints pass
- Do NOT modify files outside declared scope boundaries
</constraints>

<output_format>
Return:
1. Team brief
2. Per-agent prompt pack
3. Runtime launch plan
4. Evaluation + retry matrix
5. Final synthesis report
</output_format>

<success_criteria>
- Every agent has explicit scope and measurable output
- Routing and termination policies are present and enforceable
- All artifacts are generated at declared paths
- Final synthesis is traceable to per-agent outputs
</success_criteria>
```

## When to Use

- Audit tasks spanning 3+ domains
- Multi-agent execution where agents must talk to each other
- Long-running orchestration where silent stalls are risky
- Workflows that need explicit retry governance

## Notes

- This template extends the base 8-tag contract with orchestration tags:
  - `<routing_policy>`
  - `<termination_policy>`
  - `<artifact_contract>`
  - `<evaluation_loop>`
- If runtime lacks parallel execution, keep the same contract and run sequentially.
