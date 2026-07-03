# reprompter Observability System Overview

Blueprint source: company-wide `observability-blueprint.md`. Vendor stack can vary; principle IDs do not.

Repo: `/Users/aytuncyildizli/reprompter`
Surface: prompt transformation/service surface

## Minimum contract

- Correlation: `request_id`, `trace_id`, `span_id`, `correlation_id`, privacy-safe `actor_id`.
- Signals: structured logs, metrics, traces/manual business spans, product/client events where applicable.
- Privacy: no raw secrets, prompts, files, emails, phone numbers, webhook URLs, cookies, or raw customer ids in telemetry.
- Operations: health and readiness are separate; dashboards/alerts/runbooks live in source control.

## Implementation status

GREEN: implementation has `scripts/telemetry-schema.js`, `scripts/telemetry-store.js`, `scripts/observability-contract.js`, `scripts/run-observability-report.js`, their test suites, and the wired `gate_prompt` stage.
