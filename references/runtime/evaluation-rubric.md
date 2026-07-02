# Artifact Evaluation Rubric

Strict quality gate for Repromptverse artifacts.

## Dimensions

- Clarity
- Coverage
- Verifiability
- Boundary Respect
- Constraint Quality

## Default Weights

- Clarity: 25%
- Coverage: 30%
- Verifiability: 25%
- Boundary Respect: 15%
- Constraint Quality: 5%

## Gating Rules

- Score threshold default: `>= 8.0`
- All required sections must be present
- File/line references required unless explicitly disabled
- Forbidden-pattern boundary violations fail in strict mode
- Constraints score well when they are load-bearing boundaries at the right altitude: specific enough to guide behavior, flexible enough to leave local heuristics intact. Do not reward exhaustive constraint lists by count alone.

## Retry Policy

- Max 2 retries
- Delta prompt only (target missing sections and failed checks)
