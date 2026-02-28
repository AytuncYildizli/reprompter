# Artifact Evaluation Rubric

Strict quality gate for Repromptverse artifacts.

## Dimensions

- Clarity
- Coverage
- Verifiability
- Boundary Respect

## Default Weights

- Clarity: 25%
- Coverage: 30%
- Verifiability: 25%
- Boundary Respect: 20%

## Gating Rules

- Score threshold default: `>= 8.0`
- All required sections must be present
- File/line references required unless explicitly disabled
- Forbidden-pattern boundary violations fail in strict mode

## Retry Policy

- Max 2 retries
- Delta prompt only (target missing sections and failed checks)
