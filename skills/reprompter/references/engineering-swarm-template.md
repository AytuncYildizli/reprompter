# Engineering Swarm Template

Use this template when Repromptverse runs multi-agent software engineering work (feature delivery, refactor, migration, quality hardening).

## Template

```xml
<role>
Engineering orchestration lead specializing in architecture, implementation, testing, and integration management.
</role>

<context>
- Product/system: {project and target capability}
- Stack: {frontend/backend/db/runtime}
- Repo scope: {paths and boundaries}
- Deadline/risk profile: {speed vs safety}
- Team model: Repromptverse engineering swarm
</context>

<task>
Deliver the engineering objective using coordinated specialized agents with explicit handoffs and verifiable outputs.
</task>

<motivation>
Why coordinated engineering execution is required (cross-domain complexity, timeline pressure, risk containment).
</motivation>

<requirements>
- Define non-overlapping ownership for architecture, implementation, tests, and integration
- Require one artifact per agent with explicit acceptance checks
- Define integration checkpoints and dependency order
- Include rollback/risk notes for high-impact changes
- Require final synthesis with unresolved blockers list
</requirements>

<agents>
| Agent | Role | Responsibility |
|-------|------|----------------|
| architect | system architect | Design boundaries, interface contracts, dependency map |
| implementer | full-stack engineer | Implement scoped changes in assigned modules |
| tester | test engineer | Unit/integration/e2e coverage and deterministic checks |
| reviewer | code reviewer | Validate correctness, scope discipline, maintainability |
| integrator | release integrator | Merge plan, rollout checklist, regression guardrails |
</agents>

<coordination>
- Handoffs:
  - architect -> implementer/tester (contracts + scope map)
  - implementer -> tester/reviewer (change artifact + notes)
  - tester/reviewer -> integrator (pass/fail + risk list)
- Shared artifacts:
  - `/tmp/rpt-{taskname}-architecture.md`
  - `/tmp/rpt-{taskname}-implementation.md`
  - `/tmp/rpt-{taskname}-tests.md`
  - `/tmp/rpt-{taskname}-review.md`
  - `/tmp/rpt-{taskname}-engineering-final.md`
- Sync points:
  - Contract freeze
  - Test completion gate
  - Pre-merge signoff
</coordination>

<routing_policy>
- Router: architect starts, then dependency-driven assignment
- Priority: blockers > failing tests > correctness gaps > polish
- Escalation: reviewer resolves scope conflicts; integrator resolves release sequencing
</routing_policy>

<termination_policy>
- Stop when all required artifacts are complete and acceptance checks pass
- Max 40 turns total across agents
- Max 120 minutes wall-clock
- Stop early if no artifact delta for 3 consecutive polls
</termination_policy>

<artifact_contract>
- One writer per artifact path
- Each artifact must include: assumptions, changes, evidence, open risks
- Use precise file references for all claims
- Final synthesis path: `/tmp/rpt-{taskname}-engineering-final.md`
</artifact_contract>

<evaluation_loop>
- Score each artifact on correctness, coverage, boundary-discipline, and verifiability
- Retry if score < 8 with delta prompts only
- Max 2 retries per agent
</evaluation_loop>

<constraints>
- Do NOT let agents edit files outside assigned scope
- Do NOT merge outputs before test and review checkpoints pass
- Do NOT report unverifiable claims without file/path evidence
- Do NOT skip rollback/risk notes for high-impact changes
</constraints>

<output_format>
Return:
1. Architecture contract
2. Implementation summary
3. Test evidence pack
4. Review findings
5. Integration and rollout summary
</output_format>

<success_criteria>
- Ownership is non-overlapping and enforced
- All artifacts are produced at declared paths
- Test and review gates are explicitly satisfied
- Final synthesis is actionable and traceable
</success_criteria>
```
