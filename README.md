<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/logo.svg">
  <img alt="RePrompter" src="assets/logo.svg" width="440">
</picture>

<br/>

**Your prompt sucks. Let's fix that.**

[![Version](https://img.shields.io/badge/version-10.0.0_Repromptmania-0969da)](https://github.com/aytuncyildizli/reprompter/releases)
[![License](https://img.shields.io/github/license/aytuncyildizli/reprompter?color=2da44e)](LICENSE)
[![Stars](https://img.shields.io/github/stars/aytuncyildizli/reprompter?style=flat&color=f0883e)](https://github.com/aytuncyildizli/reprompter/stargazers)
[![Issues](https://img.shields.io/github/issues/aytuncyildizli/reprompter?color=da3633)](https://github.com/aytuncyildizli/reprompter/issues)
![Claude Code](https://img.shields.io/badge/Claude%20Code-primary-111111)
![OpenClaw](https://img.shields.io/badge/OpenClaw-supported-7c3aed)
![Codex](https://img.shields.io/badge/Codex-supported-10a37f)
![LLM](https://img.shields.io/badge/Prompt%20Mode-Any%20Structured%20LLM-0ea5e9)

---

RePrompter interviews you, figures out what you actually want, and writes the prompt you were too lazy to write yourself. **v10.0 "Repromptmania" adds Dimension Interview + Agent Cards to multi-agent mode — agents now ask before they spend, and show what they found.**

Compatibility:
- **Single prompt-improvement mode:** Claude Code, OpenClaw, Codex, or any structured-prompt LLM
- **Repromptverse team orchestration mode:** Claude Code / OpenClaw / Codex (parallel when available, sequential fallback)

Compatibility matrix:

| Capability | Claude Code | Codex | OpenClaw |
|---|---|---|---|
| Single-mode interview + scoring | ✅ | ✅ | ✅ |
| Single-mode self-eval + delta rewrite | ✅ | ✅ | ✅ |
| Multi-agent orchestration | ✅ | ✅* | ✅ |
| Parallel team execution | ✅ | ✅* | ✅ |

\* depends on runtime session/subagent availability; otherwise sequential fallback is used.

<br/>

## v9.0 Highlights — Prompt Flywheel

**The prompt engineer that gets smarter every time you use it.**

- **Recipe fingerprinting** — every generated prompt carries a deterministic hash of its strategy (template + patterns + capability tier + domain + context layers + quality bucket)
- **Passive outcome collection** — after execution, signals are captured automatically (artifact scores, retry count, execution time) and linked to the recipe fingerprint
- **Adaptive strategy learning** — on future runs, the flywheel queries historical outcomes and recommends the best-performing recipe for similar tasks
- **Time-decay weighted scoring** — recent outcomes matter more (7-day half-life)
- **Fully local** — all flywheel data stored in `.reprompter/flywheel/outcomes.ndjson`. Nothing is transmitted anywhere.
- Feature flag: `REPROMPTER_FLYWHEEL=0|1` (enabled by default)

Quick links:
- Release: https://github.com/AytuncYildizli/reprompter/releases
- Flywheel benchmark: `benchmarks/v9.0-flywheel-benchmark.md`
- Swarm benchmark: `benchmarks/v8.3-swarm-benchmark.md`
- Provider benchmark: `benchmarks/v8.3-provider-benchmark.md`
- Real-world benchmark: `benchmarks/v8.3-realworld-benchmark.md`

## v9.0 Prompt Flywheel Engine

- **Recipe fingerprinting** (`scripts/recipe-fingerprint.js`) — deterministic SHA-256 hash of prompt strategy vector (template, patterns, capability tier, domain, context layers, quality bucket). Order-invariant, case-insensitive.
- **Outcome collection** (`scripts/outcome-collector.js`) — passive signal capture at finalize_run: artifact evaluator score/pass, retry count, execution time. NDJSON store at `.reprompter/flywheel/outcomes.ndjson`.
- **Strategy learning** (`scripts/strategy-learner.js`) — queries outcome ledger for similar recipes (Jaccard similarity on pattern sets + exact match on template/domain/tier), computes time-decay weighted effectiveness scores (7-day half-life), recommends best historical recipe with confidence level.
- **Runtime integration** — flywheel hooks at `plan_ready` (fingerprint + strategy lookup) and `finalize_run` (outcome collection) in `scripts/repromptverse-runtime.js`.
- **Feature flag**: `REPROMPTER_FLYWHEEL=0|1` (default: enabled).
- **Flywheel benchmark**: 13 fixtures covering fingerprint determinism, effectiveness scoring, and strategy learning accuracy.

## v8.3 Runtime Optimization Track

- Capability policy engine for provider/model selection with fallback chains.
- OpenClaw-first runtime adapter with sequential fallback parity.
- Runtime orchestrator that composes routing, policy, context, and evaluator in one execution contract.
- Telemetry schema/store/report pipeline for run-level observability.
- Budgeted layered context builder with token-manifest output.
- Strict artifact evaluator gates with delta-retry targeting.
- Pluggable prompt/context pattern library for benchmark-driven upgrades.
- Provider + evaluator benchmark harness (`benchmarks/v8.3-provider-benchmark.*`).
- Feature flags: `REPROMPTER_POLICY_ENGINE`, `REPROMPTER_LAYERED_CONTEXT`, `REPROMPTER_STRICT_EVAL`, `REPROMPTER_PATTERN_LIBRARY`.
- Telemetry toggle: `REPROMPTER_TELEMETRY=0|1`.

## The Problem

You type this:

```
uhh build a crypto dashboard, maybe coingecko data, add caching, test it too, don't break existing api
```

That's a **1.6/10** prompt. The LLM will guess scope, skip constraints, hallucinate requirements, and produce something you'll rewrite anyway.

## What RePrompter Does

It turns that into a **9.0/10** prompt in ~15 seconds. No prompt engineering skills required:

<br/>
<p align="center">
  <img src="assets/demo.gif" alt="RePrompter demo — rough prompt to structured output in 15 seconds" width="720">
</p>
<br/>

---

## How It Works

```
You type rough prompt
        ↓
  Quick Mode gate
        │
  Simple task? ──→ Generate immediately
        │
  Complex task? ──→ Interactive interview (clickable options)
        │                    │
        │            Complexity detection
        │            Execution mode selection
        │            Template matching
        │                    │
        ↓                    ↓
  Structured prompt ← Quality scored (before vs after)
        │
  Single agent? ──→ One polished prompt
        │
  Multi-agent? ──→ Team brief + per-agent sub-prompts
```

### Quick Mode
Simple, single-action prompts skip the interview entirely. No latency tax for `"fix the typo in header.tsx"`.

### Interactive Interview
For anything non-trivial, RePrompter asks **structured, clickable questions** — not generic fluff. If you mention "tracking", it asks tracking questions. If you mention "signals", it asks signal delivery questions.

<details>
<summary><strong>Example interview (actual shape)</strong></summary>

```json
{
  "questions": [
    {
      "header": "Task Type",
      "question": "What type of task is this?",
      "options": [
        {"label": "Build Feature", "description": "Create new functionality"},
        {"label": "Fix Bug", "description": "Debug and resolve an issue"},
        {"label": "Refactor", "description": "Improve existing code structure"},
        {"label": "Multi-Agent/Swarm", "description": "Coordinate multiple agents"}
      ]
    },
    {
      "header": "Execution Mode",
      "question": "How should this be executed?",
      "options": [
        {"label": "Single Agent", "description": "One agent handles everything"},
        {"label": "Team (Parallel)", "description": "Split into specialized agents"},
        {"label": "Team (Sequential)", "description": "Pipeline handoffs"},
        {"label": "Let Reprompter decide", "description": "Auto-detect from complexity"}
      ]
    }
  ]
}
```

</details>

### Auto Complexity Detection

| Task signal | Suggested mode |
|---|---|
| Frontend + backend + tests | Team (Parallel) |
| Fetch → transform → deploy | Team (Sequential) |
| Single file/component | Single Agent |
| Research + implementation | Team (Parallel) |

---

## Before / After

### Input
```
uhh build a crypto dashboard, maybe coingecko data, add caching, test it too, don't break existing api
```

### Output
```xml
<role>
Senior full-stack engineer specializing in real-time dashboard systems,
REST API integration, and cache-aware data pipelines.
</role>

<context>
- Frontend + backend + tests required (cross-layer scope)
- Data source: CoinGecko API (free tier, 30 calls/min rate limit)
- Existing API behavior must be preserved — consumers depend on current response schema
- Execution mode: Team (Parallel) due to independent frontend/backend/test workstreams
</context>

<motivation>
User-facing feature with reliability requirements. Users need real-time crypto
prices without page refresh. Prioritize correctness, cache resilience, and
non-breaking backward compatibility for existing API consumers.
</motivation>

<task>
Deliver a real-time crypto dashboard backed by a cache-aware CoinGecko proxy API,
with unit tests for both API and UI, without breaking existing API contracts.
</task>

<requirements>
- Build dashboard UI with loading, error, empty, and stale-data states
- Implement backend CoinGecko proxy with JSON schema validation + configurable cache TTL
- Preserve backward compatibility for all existing API consumers
- Add deterministic unit tests for frontend rendering states and backend edge cases
- Cache must serve stale data on upstream failure (stale-while-revalidate pattern)
</requirements>

<constraints>
- No direct client-side calls to CoinGecko (all traffic through proxy)
- No breaking changes to existing API response fields or status codes
- Mock all external network boundaries in tests — zero real HTTP calls
- Rate limit CoinGecko calls to stay within free tier (30/min)
</constraints>

<output_format>
- Backend: /api/prices endpoint returning { prices: [...], cached: bool, updatedAt: ISO }
- Frontend: React component with 5s auto-refresh interval
- Tests: Vitest suite with ≥80% branch coverage
</output_format>

<success_criteria>
- Dashboard auto-updates every 5s and shows "stale" indicator when cache is old
- Proxy returns normalized data within 200ms (cache hit) / 2s (cache miss)
- Existing API integration tests still pass with zero modifications
- New unit tests cover: success, upstream error, cache hit, cache miss, rate limit paths
</success_criteria>
```

### Quality Jump

| Dimension | Before | After | Delta |
|---|---:|---:|---:|
| Clarity | 3/10 | 9/10 | +200% |
| Specificity | 2/10 | 9/10 | +350% |
| Structure | 1/10 | 10/10 | +900% |
| Constraints | 0/10 | 8/10 | new |
| Verifiability | 1/10 | 9/10 | +800% |
| Decomposition | 2/10 | 9/10 | +350% |
| **Overall** | **1.6/10** | **9.0/10** | **+462%** |

---

## Team Mode

This is where RePrompter stops being "prompt cleanup" and becomes **orchestration**.

When auto-detection finds multiple systems (UI + API + tests), it generates:
1. A **team coordination brief** with handoff rules
2. **Per-agent sub-prompts** with scoped responsibilities

<details>
<summary><strong>📋 Team Brief (generated artifact)</strong></summary>

```markdown
# Reprompter Team Brief

- Execution Mode: Team (Parallel)
- Overall Task: Real-time crypto dashboard with cache-aware backend and full unit coverage

## Agent Roles
1. Frontend Agent — dashboard UI, polling, loading/error/stale states
2. Backend Agent — CoinGecko proxy API, schema validation, cache strategy
3. Tests Agent — deterministic unit tests for frontend + backend behavior

## Coordination Rules
- Backend publishes API contract to /tmp/api-contract.md first
- Frontend consumes contract without shape drift
- Tests use shared DTO definitions from backend contract
- Each agent writes to own output file (no conflicts)
- Integration checkpoint: lead reads all 3 outputs before final merge
```

</details>

<details>
<summary><strong>🎨 Frontend Agent — full Repromptverse prompt</strong></summary>

```xml
<role>
Senior frontend engineer specializing in real-time React dashboards
with WebSocket/polling patterns and graceful degradation.
</role>

<context>
- Framework: Next.js 14 with App Router (detected from package.json)
- Backend agent is building /api/prices endpoint (see /tmp/api-contract.md)
- No direct CoinGecko calls from client — all data via backend proxy
- Other agents handle backend (Agent 2) and tests (Agent 3)
</context>

<task>
Implement the dashboard UI component for real-time crypto price display
with 5-second auto-refresh, loading/error/stale states, and responsive layout.
</task>

<requirements>
- Auto-refresh every 5 seconds via polling (not WebSocket)
- Show loading skeleton on initial fetch
- Show error state with retry button on fetch failure
- Show "stale" indicator when data is older than 30 seconds
- Display: coin name, price, 24h change (green/red), sparkline
- Responsive: mobile-first, 1-column on mobile, grid on desktop
</requirements>

<constraints>
- Do NOT call CoinGecko directly — only use /api/prices
- Do NOT modify any existing pages or components
- Use existing design system tokens (colors, spacing, fonts)
- Keep component tree shallow (max 3 levels deep)
</constraints>

<output_format>
Write complete implementation to /tmp/rpt-frontend.md including:
- Component code (React/TSX)
- Custom hook for polling logic
- CSS/Tailwind styles
- Type definitions
</output_format>

<success_criteria>
- All 4 states render correctly (loading, data, error, stale)
- No CoinGecko imports in any frontend file
- Component renders within 100ms (no heavy computation in render)
- Lighthouse accessibility score ≥ 90
</success_criteria>
```

</details>

<details>
<summary><strong>⚙️ Backend Agent — full Repromptverse prompt</strong></summary>

```xml
<role>
Senior backend engineer specializing in API integration,
resilient caching patterns, and rate-limit-aware proxy design.
</role>

<context>
- Next.js 14 API routes (App Router, /app/api/)
- CoinGecko free tier: 30 calls/min rate limit
- Existing /api/ routes must not break — consumers depend on current schema
- Frontend agent (Agent 1) will consume /api/prices
- Tests agent (Agent 3) will test this endpoint
</context>

<task>
Build a cache-aware /api/prices endpoint that proxies CoinGecko,
validates responses, and serves stale data on upstream failure.
</task>

<requirements>
- GET /api/prices returns { prices: CoinPrice[], cached: boolean, updatedAt: string }
- In-memory cache with configurable TTL (default 10s)
- Stale-while-revalidate: serve cached data when CoinGecko is down
- JSON schema validation on CoinGecko response before caching
- Rate limiter: max 25 calls/min to CoinGecko (5 call buffer)
- Publish API contract to /tmp/api-contract.md for other agents
</requirements>

<constraints>
- Do NOT modify existing API routes or their response schemas
- Do NOT expose CoinGecko API key to frontend
- Do NOT use external cache (Redis) — in-memory only for now
- Error responses must follow existing API error format
</constraints>

<output_format>
Write complete implementation to /tmp/rpt-backend.md including:
- API route handler code
- Cache module with TTL logic
- Rate limiter module
- Type definitions + API contract
</output_format>

<success_criteria>
- Cache hit returns in < 50ms
- Upstream failure returns last cached data (not 500)
- Rate limiter prevents > 25 calls/min to CoinGecko
- Zero breaking changes to existing routes (verified by existing tests)
</success_criteria>
```

</details>

<details>
<summary><strong>🧪 Tests Agent — full Repromptverse prompt</strong></summary>

```xml
<role>
Senior test engineer specializing in deterministic unit tests,
API boundary mocking, and React component testing with Vitest.
</role>

<context>
- Test framework: Vitest + React Testing Library (from vitest.config.ts)
- Frontend agent (Agent 1) builds dashboard component
- Backend agent (Agent 2) builds /api/prices endpoint
- Read their outputs from /tmp/rpt-frontend.md and /tmp/rpt-backend.md
- All external HTTP calls must be mocked — zero real network in tests
</context>

<task>
Create comprehensive unit tests for both the frontend dashboard component
and the backend /api/prices endpoint, covering all edge cases.
</task>

<requirements>
- Backend tests: success, upstream error, cache hit, cache miss, rate limit, schema validation failure
- Frontend tests: loading state, data render, error state + retry, stale indicator, auto-refresh
- Minimum 15 test cases total (8 backend + 7 frontend)
- Each test must be deterministic — no timers, no real HTTP, no flaky assertions
- Mock CoinGecko responses with realistic fixtures
- Test cache TTL expiry with fake timers (vi.useFakeTimers)
</requirements>

<constraints>
- Do NOT make real HTTP calls to any external service
- Do NOT modify existing test files or test utilities
- Use vi.mock() for fetch/HTTP, vi.useFakeTimers() for time-dependent logic
- Each test must complete in < 100ms
</constraints>

<output_format>
Write complete test suite to /tmp/rpt-tests.md including:
- Backend test file (*.test.ts)
- Frontend test file (*.test.tsx)
- Mock fixtures (CoinGecko response shapes)
- Coverage expectations
</output_format>

<success_criteria>
- All 15+ tests pass deterministically
- ≥ 80% branch coverage on both frontend and backend
- Zero network calls in test execution
- Tests run in < 2 seconds total
</success_criteria>
```

</details>

---

## Installation

### Claude Code

```bash
mkdir -p skills/reprompter
curl -sL https://github.com/aytuncyildizli/reprompter/archive/main.tar.gz | \
  tar xz --strip-components=1 -C skills/reprompter
```

Claude Code auto-discovers `skills/reprompter/SKILL.md`.

### OpenClaw

```bash
# Copy to your OpenClaw workspace
cp -R reprompter /path/to/workspace/skills/reprompter
```

### Codex

```bash
mkdir -p ~/.codex/skills/reprompter
curl -sL https://github.com/aytuncyildizli/reprompter/archive/main.tar.gz | \
  tar xz --strip-components=1 -C ~/.codex/skills/reprompter
```

Codex auto-discovers `~/.codex/skills/reprompter/SKILL.md`.

### Any Structured-Prompt LLM

Use `SKILL.md` as the behavior spec. Templates are in `references/`.

> Note: Non-Claude runtimes are supported for **prompt-improvement mode**. Repromptverse orchestration can run in any runtime with sequential fallback; parallel launch methods remain runtime-specific.

---

## Quick Start

After installing, just say one of these trigger phrases:

```
reprompt this: build a REST API with auth and rate limiting
```

```
reprompter teams - audit the auth module for security and test coverage
```

**Single mode** triggers: "reprompt", "reprompt this", "clean up this prompt", "structure my prompt"
**Team mode** triggers: "reprompter teams", "repromptverse", "run with quality", "smart run", "smart agents", "campaign swarm", "engineering swarm", "ops swarm", "research swarm"

RePrompter will interview you (2-5 questions), generate a structured XML prompt, and show a before/after quality score.

---

## Quality Dimensions

Every transformation is scored on six weighted dimensions:

| Dimension | Weight | What it checks |
|---|---:|---|
| Clarity | 20% | Is the task unambiguous? |
| Specificity | 20% | Are requirements concrete and scoped? |
| Structure | 15% | Is prompt structure complete and logical? |
| Constraints | 15% | Are boundaries explicit? |
| Verifiability | 15% | Can output be validated objectively? |
| Decomposition | 15% | Is work split cleanly (steps or agents)? |

**Overall score** = weighted average. Most rough prompts score 1–3. RePrompter typically outputs 8–9+.

---

## Templates

| Template | Use case |
|---|---|
| `feature-template` | New functionality |
| `bugfix-template` | Debug + fix |
| `refactor-template` | Structural cleanup |
| `testing-template` | Unit/integration test tasks |
| `api-template` | Endpoint/API work |
| `ui-template` | UI component implementation |
| `security-template` | Security hardening/audit tasks |
| `docs-template` | Technical docs |
| `content-template` | Blog posts, articles, marketing copy |
| `research-template` | Analysis / option exploration |
| `marketing-swarm-template` | Marketing-first multi-agent orchestration |
| `engineering-swarm-template` | Engineering-first multi-agent orchestration |
| `ops-swarm-template` | Reliability/infra multi-agent orchestration |
| `research-swarm-template` | Analysis/benchmark multi-agent orchestration |
| `repromptverse-template` | Multi-agent routing, termination, artifact/eval contract |
| `swarm-template` | Multi-agent coordination |
| `team-brief-template` | Team orchestration brief |

> Templates live in `references/` and are read on demand (not loaded into context). Team brief is generated during Repromptverse Phase 1.

---

## v8.3 — Runtime + Benchmark Hardening

Repromptverse is now the single multi-agent mode. v8.3 adds domain-specific lazy-load profiles plus runtime optimization controls:

- **Routing policy**: explicit next-speaker logic (selector-style where needed)
- **Termination policy**: max turns/time + no-progress stop condition
- **Artifact contract**: one writer per output path, fixed handoff schema
- **Evaluator loop**: score each artifact, retry with delta prompts only
- **Marketing swarm profile**: campaign/growth/SEO/content
- **Engineering swarm profile**: architecture/feature/refactor/migration/test coverage
- **Ops swarm profile**: incident/uptime/gateway/cron/health/SLO
- **Research swarm profile**: benchmark/compare/tradeoff/analysis
- **Implicit complexity detection**: auto-enables multi-agent routing for `audit`, `parallel`, or 2+ detected domains
- **Single-mode pattern pack**: intent router + constraint normalizer + self-eval + one-step delta rewrite
- **Capability policy engine**: provider/model routing by capability tier with fallback chains
- **Layered context builder**: token-budgeted context manifests per agent
- **Strict artifact evaluator**: schema/verifiability/boundary gates before synthesis
- **Runtime feature flags**: policy/context/eval/pattern toggles for phased rollout

Design input borrowed from Microsoft patterns:

- AutoGen team orchestration / selector routing / termination contracts
- PromptWizard-style evaluator and iterative optimization loops

Benchmark + validation commands:

```bash
npm run validate:templates
npm run test:intent-router
npm run test:capability-policy
npm run test:context-builder
npm run test:artifact-evaluator
npm run test:pattern-selector
npm run test:runtime-adapter
npm run test:repromptverse-runtime
npm run test:telemetry-schema
npm run test:telemetry-store
npm run test:observability-report
npm run test:recipe-fingerprint
npm run test:outcome-collector
npm run test:strategy-learner
npm run benchmark:swarms
npm run benchmark:provider
npm run benchmark:realworld
npm run benchmark:flywheel
npm run telemetry:report
npm run flywheel:report
npm run check
```

Generated benchmark artifacts:
- `benchmarks/v8.3-swarm-benchmark.md`
- `benchmarks/v8.3-swarm-benchmark.json`
- `benchmarks/v8.3-provider-benchmark.md`
- `benchmarks/v8.3-provider-benchmark.json`
- `benchmarks/v8.3-realworld-benchmark.md`
- `benchmarks/v8.3-realworld-benchmark.json`
- `benchmarks/observability/v8.3-observability-report.md`
- `benchmarks/observability/v8.3-observability-report.json`

Current benchmark snapshot (fixture-driven):

| Metric | Value |
|---|---|
| Routing accuracy | 100% (9/9) |
| Domain profiles covered | marketing, engineering, ops, research, generic repromptverse |
| Template contract coverage | 100% for all swarm templates |
| Proxy quality | 10/10 (domain swarms), 8/10 (generic repromptverse) |
| Provider routing benchmark | 100% (5/5) |
| Artifact evaluator benchmark | 100% (4/4) |
| Real-world routing benchmark | 100% (64/64) |
| Real-world artifact benchmark | 100% (84/84) |
| Flywheel fingerprint benchmark | 100% (4/4) |
| Flywheel effectiveness benchmark | 100% (6/6) |
| Flywheel strategy benchmark | 100% (3/3) |

Codex troubleshooting:

- If you see `Unsupported value: 'xhigh' ... reasoning.effort`, set `model_reasoning_effort = "high"` in `~/.codex/config.toml`.

---

## v7.0 — Unified Skill + Repromptverse 🧠

**v7.0 merges `reprompter` + `reprompter-teams` into a single skill with two modes.** No more separate skills — one SKILL.md handles both single prompts and full agent team orchestration.

Most agent orchestration tools improve the overall task, then hand vague sub-tasks to each agent. RePrompter individually RePrompts every agent's prompt:

```
Raw task
    ↓
Layer 1: Team Plan — roles, coordination, brief
    ↓
Layer 2: Repromptverse — each agent's sub-task gets its own
         full RePrompter pass (score, improve, add constraints,
         success criteria, output format)
    ↓
Execute — every agent starts with an 8+/10 prompt
    ↓
Evaluate — score output against success criteria
    ↓
Retry (if needed) — delta prompts targeting specific gaps
```

**Before Repromptverse:** Raw task given to 4 agents:
> "audit my system for security, cost waste, config issues, and memory bloat"
>
> That's a **2.5/10** prompt. Each agent gets a vague one-liner and has to guess scope, output format, and success criteria.

**After Repromptverse:** Each agent gets a structured XML prompt (all 4 shown below).

The team lead sends all 4 agents in parallel. Each writes to their own `/tmp/` file. No scope overlap.

<details open>
<summary><strong>🔒 Agent 1: SecurityAuditor (score: 2.0 → 8.9)</strong></summary>

```xml
<role>
Senior application security engineer specializing in Python web applications,
OWASP Top 10, and credential hygiene in git-tracked repositories.
</role>

<context>
- Codebase: Python 3.11, psycopg2, urllib3, FastAPI. DB: Neon Postgres + SQLite.
- 76 Python files across scripts/whatsapp-memory/, scripts/finance/, scripts/norget/
- Known issue: .gitignore was recently expanded but credentials may exist in git history
- Other agents: TokenCostAuditor (#2), ConfigAuditor (#3), MemoryBloatAuditor (#4)
- YOUR scope: source code security ONLY
</context>

<task>Audit all Python source files for security vulnerabilities, hardcoded credentials,
injection risks, and unsafe patterns.</task>

<requirements>
- SQL injection: parameterized queries vs string formatting in all DB calls
- Hardcoded secrets: API keys, OAuth tokens, passwords in source code
- SSRF: URL construction in urllib/requests — user input in URLs
- Subprocess calls: shell=True, unsanitized arguments
- Minimum 8 findings across at least 3 severity levels
</requirements>

<constraints>
- Source code ONLY — do not audit .env, memory/, or config (other agents do that)
- READ-ONLY: report only, do not modify files
- Verify every file:line reference before reporting
</constraints>

<output_format>
/tmp/rpc2-audit-security.md — findings table with severity, file:line, fix suggestion
</output_format>

<success_criteria>
- ≥8 findings, every one with exact file:line, ≥1 CRITICAL + 2 HIGH, concrete fixes
</success_criteria>
```

</details>

<details>
<summary><strong>💸 Agent 2: TokenCostAuditor (score: 2.2 → 9.0)</strong></summary>

```xml
<role>
Cost optimization engineer specializing in LLM API usage analysis,
cron job efficiency, and AI session token consumption patterns.
</role>

<context>
- 52 cron jobs in .openclaw/cron/jobs.json (each spawns isolated AI session)
- 3 gateways: Mahmut (port 18789), Ziggy (18795), ZeroClaw (18790)
- Model: Claude Opus 4.6 ($15/M input, $75/M output)
- Known waste: some crons use full AI sessions to run simple bash scripts
- Other agents: SecurityAuditor (#1), ConfigAuditor (#3), MemoryBloatAuditor (#4)
</context>

<task>Analyze all cron jobs for token waste, calculate monthly costs per job,
identify redundancies, and propose a tiered savings plan.</task>

<requirements>
- Calculate cost per job: frequency × avg tokens × model pricing
- Identify jobs that can be converted from AI sessions to pure bash/launchd
- Find duplicate jobs across gateways
- Group savings into tiers: immediate ($0 effort), this week, this month
- Total monthly spend and achievable target
</requirements>

<constraints>
- Analyze cron jobs ONLY — do not audit source code or memory files
- Use real pricing ($15/M input, $75/M output for Opus 4.6)
- Do not disable or modify any jobs — report recommendations only
</constraints>

<output_format>
/tmp/rpc2-audit-tokens.md — cost table per job, savings tiers, total reduction
</output_format>

<success_criteria>
- Every job has estimated monthly cost, ≥$200/mo in identified savings, tiered action plan
</success_criteria>
```

</details>

<details>
<summary><strong>⚙️ Agent 3: ConfigSettingsAuditor (score: 1.8 → 8.9)</strong></summary>

```xml
<role>
DevSecOps engineer specializing in configuration security, secrets management,
.gitignore hygiene, and mechanical enforcement of safety rules.
</role>

<context>
- OpenClaw config: openclaw.json + .openclaw/ directory
- Claude Code settings: ~/.claude/settings.json (deny list, env vars)
- Safety rules in SOUL.md (8 hard rules — but are they mechanically enforced?)
- .gitignore recently expanded but may still miss sensitive paths
- Other agents: SecurityAuditor (#1), TokenCostAuditor (#2), MemoryBloatAuditor (#4)
</context>

<task>Audit all configuration files for security gaps, missing enforcement of safety rules,
credential exposure risks, and .gitignore completeness.</task>

<requirements>
- Check .gitignore covers: .env, memory/, secrets/, logs/, *.sqlite, PII files
- Check settings.json deny list enforces SOUL.md rules (kill commands, tweet posting)
- Check for credentials in config files, entity files, memory summaries
- Check gateway config for unnecessary permissions or exposed endpoints
- Verify each SOUL.md hard rule has mechanical enforcement (not just prompt compliance)
</requirements>

<constraints>
- Config and settings ONLY — do not audit Python source code or cron jobs
- Do not modify any config files — report gaps only
- Check both Mahmut and ZeroClaw configs if accessible
</constraints>

<output_format>
/tmp/rpc2-audit-config.md — gap analysis table, SOUL.md enforcement matrix, remediation steps
</output_format>

<success_criteria>
- Every SOUL.md rule checked for mechanical enforcement, ≥10 findings, prioritized P0/P1/P2
</success_criteria>
```

</details>

<details>
<summary><strong>🧠 Agent 4: MemoryBloatAuditor (score: 2.0 → 8.7)</strong></summary>

```xml
<role>
Systems optimization engineer specializing in context window management,
memory file deduplication, and token budget analysis for LLM-powered assistants.
</role>

<context>
- Memory files: MEMORY.md, memory/*.md, memory/entities/*.md, memory/summaries/*.json
- Entity files auto-generated by PARA synthesis (daily cron)
- Known issue: openclaw-setup.md is 29K words (38K tokens) — largest single file
- Context window: 1M tokens (Opus 4.6), but bloat reduces useful conversation space
- Other agents: SecurityAuditor (#1), TokenCostAuditor (#2), ConfigAuditor (#3)
</context>

<task>Analyze all memory and entity files for bloat, duplication, misfiled facts,
and stale content. Quantify token savings from cleanup.</task>

<requirements>
- Measure total tokens loaded per session (all injected files)
- Identify duplicate content across: MEMORY.md ↔ entity files ↔ SESSION_STATE.md
- Find misfiled entity facts (e.g., unrelated content in wrong entity file)
- Identify stale/completed TODOs, old audit reports, obsolete sections
- Calculate token savings per cleanup action
</requirements>

<constraints>
- Memory and entity files ONLY — do not audit source code, config, or cron jobs
- Do not delete or modify files — report recommendations with exact paths + line numbers
- Count tokens using ~4 chars per token approximation
</constraints>

<output_format>
/tmp/rpc2-audit-bloat.md — bloat inventory table, per-file token count, cleanup actions with savings
</output_format>

<success_criteria>
- Total token count for all injected files, ≥50K tokens in identified savings, specific line ranges to remove
</success_criteria>
```

</details>

**4-phase loop:** Team Plan → Repromptverse → Execute → Evaluate+Retry

Trigger words: `"reprompter teams"`, `"repromptverse"`, `"run with quality"`, `"smart run"`, `"smart agents"`, `"campaign swarm"`, `"engineering swarm"`, `"ops swarm"`, `"research swarm"`

Normal single-prompt usage is unchanged — Repromptverse only activates for team/multi-agent tasks.

### Proven Results

**E2E test** — 3 Opus agents, sequential pipeline:

| Metric | Value |
|--------|-------|
| Original prompt score | 2.15 / 10 |
| After Repromptverse | **9.15 / 10** |
| Delta | **+7.00 points (+326%)** |
| Quality audit | **PASS (99.1%)** |
| Weaknesses found → fixed | 24 → 24 (100%) |
| Cost | $1.39 |
| Time | ~8 minutes |

**Repromptverse vs Raw Agent Teams** — same audit, 4 Opus agents:

| Metric | Raw | Repromptverse | Delta |
|--------|-----|----------------|-------|
| CRITICAL findings | 7 | 14 | **+100%** |
| Total findings | ~40 | 104 | **+160%** |
| Cost savings found | $377/mo | $490/mo | **+30%** |
| Token bloat found | 45K | 113K | **+151%** |
| Cross-validated findings | 0 | 5 | — |

Methodology: scores from parallel audit runs with identical task prompts

The pipeline runs via **Claude Code Agent Teams** with `teammateMode: "tmux"` for real-time split-pane monitoring. All orchestration docs are now in SKILL.md (TEAMS.md removed in v7).

---

## Other Features

- **Extended thinking** — Favors outcome clarity over rigid step scripting
- **Response prefilling** — Suggests `{` prefills for JSON-first API workflows
- **Context engineering** — Prompts complement runtime context, don't duplicate it
- **Token budget** — Keeps prompts compact (~2K single mode, ~1-2K per agent)
- **Uncertainty handling** — Explicit permission to ask, not fabricate
- **Motivation capture** — Maps "why this matters" into `<motivation>` so priority survives execution
- **Closed-loop quality** — Execute → Evaluate → Retry (Repromptverse mode only — Single mode generates prompts, does not execute; max 2 retries, delta prompts)

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- 🐛 [Report a bug](https://github.com/aytuncyildizli/reprompter/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/aytuncyildizli/reprompter/issues/new?template=feature_request.md)
- 📝 Submit a template PR

---

## License

MIT — see [LICENSE](LICENSE).

---

## Star History

<p align="center">
  <a href="https://www.star-history.com/#AytuncYildizli/reprompter&Date">
    <img src="https://api.star-history.com/svg?repos=AytuncYildizli/reprompter&type=Date" alt="Star History Chart" width="600">
  </a>
</p>

---

<p align="center">
  <sub>If RePrompter saved you from writing another messy prompt, consider giving it a ⭐</sub>
</p>
