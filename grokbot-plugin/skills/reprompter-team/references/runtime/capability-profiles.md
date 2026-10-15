# Capability Profiles

Capability policy for provider/model selection in Repromptverse runtime.

## Tiers

- `reasoning_high`: complex audits, synthesis, high-risk decision tasks
- `reasoning_medium`: standard implementation planning and analysis
- `latency_optimized`: fast triage and lightweight diagnostics
- `cost_optimized`: large-batch low-risk tasks where speed/cost dominate
- `long_context`: tasks requiring very large context windows
- `tool_reliability`: execution-heavy workflows requiring stable tool behavior

## Policy Inputs

- Agent domain and role
- Output type (analysis, evaluation, synthesis, execution)
- Complexity score
- Context token requirement
- Desired outcome (`quality_reliability`, `cost_speed`, `balanced`)

## Policy Outputs

- Selected `provider` + `model`
- `capabilityTier`
- Fallback chain with provider diversification
- Deterministic decision reason trace
