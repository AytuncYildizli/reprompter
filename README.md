<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/logo.svg">
  <img alt="RePrompter" src="assets/logo.svg" width="440">
</picture>

<br/>

**Your prompt sucks. Let's fix that.**

[![Version](https://img.shields.io/badge/version-7.0.0-0969da)](https://github.com/aytuncyildizli/reprompter/releases)
[![License](https://img.shields.io/github/license/aytuncyildizli/reprompter?color=2da44e)](LICENSE)
[![Stars](https://img.shields.io/github/stars/aytuncyildizli/reprompter?style=flat&color=f0883e)](https://github.com/aytuncyildizli/reprompter/stargazers)
[![Issues](https://img.shields.io/github/issues/aytuncyildizli/reprompter?color=da3633)](https://github.com/aytuncyildizli/reprompter/issues)
![Claude Code](https://img.shields.io/badge/Claude%20Code-primary-111111)
![OpenClaw](https://img.shields.io/badge/OpenClaw-supported-7c3aed)
![LLM](https://img.shields.io/badge/Any%20Structured%20LLM-compatible-0ea5e9)

---

RePrompter interviews you, figures out what you actually want, and writes the prompt you were too lazy to write yourself. **v7 merges single-prompt and team orchestration into one skill** — it detects complexity, picks execution mode, and scores everything.

Works with **Claude Code**, **OpenClaw**, or **any LLM**.

<br/>

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
| Constraints | 0/10 | 8/10 | +∞ |
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
<summary><strong>🎨 Frontend Agent — full Repromptception prompt</strong></summary>

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
<summary><strong>⚙️ Backend Agent — full Repromptception prompt</strong></summary>

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
<summary><strong>🧪 Tests Agent — full Repromptception prompt</strong></summary>

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

### Any Structured-Prompt LLM

Use `SKILL.md` as the behavior spec. Templates are in `resources/templates/`.

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
| `ui-component-template` | UI component implementation |
| `security-template` | Security hardening/audit tasks |
| `documentation-template` | Technical docs |
| `research-template` | Analysis / option exploration |
| `swarm-template` | Multi-agent coordination |
| `team-brief-template` | Team orchestration brief |

> Templates live in `resources/templates/`. Team brief is generated at runtime.

---

## v7.0 — Unified Skill + Repromptception 🧠

**v7.0 merges `reprompter` + `reprompter-teams` into a single skill with two modes.** No more separate skills — one SKILL.md handles both single prompts and full agent team orchestration.

Most agent orchestration tools improve the overall task, then hand vague sub-tasks to each agent. RePrompter individually RePrompts every agent's prompt:

```
Raw task
    ↓
Layer 1: Team Plan — roles, coordination, brief
    ↓
Layer 2: Repromptception — each agent's sub-task gets its own
         full RePrompter pass (score, improve, add constraints,
         success criteria, output format)
    ↓
Execute — every agent starts with an 8+/10 prompt
    ↓
Evaluate — score output against success criteria
    ↓
Retry (if needed) — delta prompts targeting specific gaps
```

**Before Repromptception (score: 2.0/10):**
> "Security Auditor — scan for vulnerabilities"

**After Repromptception (score: 8.9/10):**
```xml
<role>
Senior application security engineer specializing in Python web applications,
OWASP Top 10, and credential hygiene in git-tracked repositories.
</role>

<context>
- Codebase: Python 3.11, psycopg2, urllib3, FastAPI. DB: Neon Postgres + SQLite.
- 76 Python files across scripts/whatsapp-memory/, scripts/finance/, scripts/norget/
- Known issue: .gitignore was recently expanded but credentials may exist in git history
- Other agents handle: token costs (Agent 2), config settings (Agent 3), memory bloat (Agent 4)
- YOUR scope: source code security ONLY — do not audit config files or memory files
</context>

<task>
Audit all Python source files for security vulnerabilities, hardcoded credentials,
injection risks, and unsafe patterns. Report findings with exact file paths and line numbers.
</task>

<requirements>
- Check SQL injection: parameterized queries vs string formatting in all DB calls
- Check hardcoded secrets: API keys, OAuth tokens, passwords in source code (not .env)
- Check SSRF: URL construction in urllib/requests calls — user input in URLs
- Check input validation: external API data consumed without schema validation
- Check subprocess calls: shell=True, unsanitized arguments
- Check file path traversal: user-controlled paths in open()/read()
- Minimum 8 findings across at least 3 severity levels
</requirements>

<constraints>
- Audit source code ONLY — do not audit .env files, memory/, or config (other agents do that)
- READ-ONLY: do not modify any files, only report findings
- Verify every file:line reference before reporting (no hallucinated paths)
- Use severity framework: CRITICAL / HIGH / MEDIUM / LOW
</constraints>

<output_format>
Write findings to /tmp/rpc2-audit-security.md with:
- Executive summary (1 paragraph)
- Findings table: | # | Severity | File:Line | Issue | Fix Suggestion |
- Detailed analysis per finding (code snippet + explanation)
- Remediation priority list
</output_format>

<success_criteria>
- Minimum 8 findings with severity ratings
- Every finding has exact file:line reference (verified, not guessed)
- At least 1 CRITICAL and 2 HIGH findings
- Each finding includes a concrete fix suggestion (not generic advice)
- No false positives — every reported issue must be a real vulnerability
</success_criteria>
```

**4-phase loop:** Team Plan → Repromptception → Execute → Evaluate+Retry

Trigger words: `"reprompter teams"`, `"repromptception"`, `"run with quality"`, `"smart run"`

Normal single-prompt usage is unchanged — Repromptception only activates for team/multi-agent tasks.

### Proven Results

**E2E test** — 3 Opus agents, sequential pipeline:

| Metric | Value |
|--------|-------|
| Original prompt score | 2.15 / 10 |
| After Repromptception | **9.15 / 10** |
| Delta | **+7.00 points (+326%)** |
| Quality audit | **PASS (99.1%)** |
| Weaknesses found → fixed | 24 → 24 (100%) |
| Cost | $1.39 |
| Time | ~8 minutes |

**Repromptception vs Raw Agent Teams** — same audit, 4 Opus agents:

| Metric | Raw | Repromptception | Delta |
|--------|-----|----------------|-------|
| CRITICAL findings | 7 | 14 | **+100%** |
| Total findings | ~40 | 104 | **+160%** |
| Cost savings found | $377/mo | $490/mo | **+30%** |
| Cross-validated findings | 0 | 5 | — |

The pipeline runs via **Claude Code Agent Teams** with `teammateMode: "tmux"` for real-time split-pane monitoring. All orchestration docs are now in SKILL.md (TEAMS.md removed in v7).

---

## Other Features

- **Think tool-aware** — Claude 4.x dedicated think tool workflows
- **Context engineering** — Prompts complement runtime context, don't duplicate it
- **Extended thinking** — Favors outcome clarity over rigid step scripting
- **Response prefilling** — Suggests `{` prefills for JSON-first API workflows
- **Uncertainty handling** — Explicit permission to ask, not fabricate
- **Motivation capture** — Maps "why this matters" into `<motivation>` so priority survives execution
- **Closed-loop quality** — Execute → Evaluate → Retry (max 2 retries, delta prompts)

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
