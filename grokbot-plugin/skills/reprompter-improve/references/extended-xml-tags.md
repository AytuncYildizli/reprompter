# Extended XML tags

> Verbatim from root SKILL.md lines 1972-1998.

## Appendix: Extended XML tags

Templates may add domain-specific tags beyond the 8 required base tags. Always include all base tags first.

| Extended Tag | Used In | Purpose |
|-------------|---------|---------|
| `<symptoms>` | bugfix | What the user sees, error messages |
| `<investigation_steps>` | bugfix | Systematic debugging steps |
| `<endpoints>` | api | Endpoint specifications |
| `<component_spec>` | ui | Component props, states, layout |
| `<agents>` | swarm | Agent role definitions |
| `<task_decomposition>` | swarm | Work split per agent |
| `<coordination>` | swarm | Inter-agent handoff rules |
| `<routing_policy>` | repromptverse | Speaker and router policy |
| `<termination_policy>` | repromptverse | Max turn/time and stop conditions |
| `<artifact_contract>` | repromptverse | Output schema and ownership |
| `<evaluation_loop>` | repromptverse | Score thresholds and retry policy |
| `<research_questions>` | research | Specific questions to answer |
| `<methodology>` | research | Research approach and methods |
| `<reasoning>` | research | Reasoning notes space (non-sensitive, concise) |
| `<current_state>` | refactor | Before state of the code |
| `<target_state>` | refactor | Desired after state |
| `<coverage_requirements>` | testing | What needs test coverage |
| `<threat_model>` | security | Threat landscape and vectors |
| `<structure>` | docs | Document organization |
| `<reference>` | docs | Source material to reference |
| `<assumptions>` | goal/workflow/repromptverse | Documented defaults used instead of blocking autonomous execution on low-value questions |
