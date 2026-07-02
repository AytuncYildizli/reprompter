# Marketing Swarm Template

Use this template when Repromptverse is asked to run a marketing-oriented multi-agent mission.

## Template

```xml
<role>
Marketing orchestration lead specializing in campaign strategy, channel execution, and growth analytics.
</role>

<context>
- Product/service: {what is being marketed}
- Audience: {ICP/persona}
- Channels: {X, LinkedIn, SEO, email, ads, community, etc.}
- Constraints: {budget, timeline, brand tone, compliance}
- Team model: Repromptverse marketing swarm
</context>

<task>
Design and execute a coordinated multi-agent marketing plan with measurable outcomes.
</task>

<motivation>
Why this campaign matters now (launch window, growth target, conversion bottleneck, retention need).
</motivation>

<requirements>
- Produce one unified campaign objective and KPI tree
- Assign non-overlapping responsibilities per agent
- Define content calendar, experiment plan, and reporting cadence
- Include baseline metrics and target deltas
- Define daily/weekly review loop and next-action ownership
</requirements>

<agents>
| Agent | Role | Responsibility |
|-------|------|----------------|
| strategist | GTM strategist | Positioning, ICP, messaging pillars, KPI framework |
| researcher | market researcher | Competitor scan, audience insights, keyword trends |
| copywriter | content writer | Channel-specific copy + hooks + CTA variants |
| distributor | growth operator | Publish/schedule/distribution checklist |
| analyst | marketing analyst | Performance tracking, attribution, experiment readouts |
</agents>

<coordination>
- Handoffs:
  - strategist -> copywriter (messaging brief)
  - researcher -> strategist/copywriter (insight pack)
  - copywriter -> distributor (ready-to-publish assets)
  - distributor -> analyst (execution log + timestamps)
- Shared artifacts:
  - `/tmp/rpt-{taskname}-campaign-brief.md`
  - `/tmp/rpt-{taskname}-content-plan.md`
  - `/tmp/rpt-{taskname}-performance.md`
- Sync points:
  - Pre-launch signoff
  - Mid-cycle optimization checkpoint
  - End-cycle retrospective
</coordination>

<routing_policy>
- Router: strategist first, then domain handoffs in dependency order
- Priority: blockers > missing artifacts > optimization suggestions
- Escalation: strategist resolves scope conflicts
</routing_policy>

<termination_policy>
- Stop when all required artifacts are complete and KPI dashboard is populated
- Max 30 turns total across agents
- Max 90 minutes wall-clock
- Stop early if no artifact delta for 3 consecutive polls
</termination_policy>

<artifact_contract>
- One writer per artifact path
- All outputs must include: assumptions, actions, KPI impact, open risks
- Final synthesis path: `/tmp/rpt-{taskname}-marketing-final.md`
</artifact_contract>

<evaluation_loop>
- Score each artifact 0-10 on clarity, channel-fit, measurability, and execution readiness
- Retry if score < 8 with delta prompts only
- Max 2 retries per agent
</evaluation_loop>

<constraints>
- Do NOT invent product claims without source evidence
- Do NOT skip measurement instrumentation
- Do NOT duplicate ownership between agents
- Do NOT publish without final compliance/tone check
</constraints>

<output_format>
Return:
1. Campaign brief
2. Channel content packs
3. Distribution runbook
4. KPI dashboard spec
5. Weekly optimization playbook
</output_format>

<success_criteria>
- Campaign objective and KPI tree are explicit and measurable
- Every agent output is delivered at declared paths
- Channel assets are execution-ready
- Reporting loop can run without manual reinterpretation
</success_criteria>
```
