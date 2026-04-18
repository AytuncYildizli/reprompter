<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/logo.svg">
  <img alt="RePrompter" src="assets/logo.svg" width="440">
</picture>

<br/>

**Your prompt sucks. Let's fix that.**

[![Version](https://img.shields.io/badge/version-12.1.0-0969da)](https://github.com/aytuncyildizli/reprompter/releases)
[![License](https://img.shields.io/github/license/aytuncyildizli/reprompter?color=2da44e)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-205%20passing-2da44e)](#testing)
[![Stars](https://img.shields.io/github/stars/aytuncyildizli/reprompter?style=flat&color=f0883e)](https://github.com/aytuncyildizli/reprompter/stargazers)

RePrompter is a prompt engineering skill for AI coding agents. It takes rough, low-quality prompts and transforms them into structured, high-scoring prompts that produce dramatically better results. Works with Claude Code, OpenClaw, Codex, or any LLM that accepts structured prompts.

<br/>
<p align="center">
  <img src="assets/demo.gif" alt="RePrompter demo — rough prompt to structured output in 15 seconds" width="720">
</p>

---

## Three Modes

| Mode | What it does | Trigger |
|------|-------------|---------|
| **Single** | Interview, structure, score one prompt | `reprompt this`, `clean up this prompt` |
| **Repromptverse** | Plan a team of 2-5 agents, reprompt each one, execute in parallel, evaluate, retry | `reprompter teams`, `repromptverse`, `smart run` |
| **Reverse** | Show a great output, extract the prompt DNA that produced it | `reverse reprompt`, `learn from this`, `prompt dna` |

---

## Before / After

```
Input:  "uhh build a crypto dashboard, maybe coingecko data, add caching, test it too"
Score:  1.6/10
```

```xml
Output: Structured XML prompt with role, context, task, requirements,
        constraints, output format, and success criteria
Score:  9.0/10  (+462%)
```

<details>
<summary>See the full generated prompt</summary>

```xml
<role>
Senior full-stack engineer specializing in real-time dashboard systems,
REST API integration, and cache-aware data pipelines.
</role>

<context>
- Frontend + backend + tests required (cross-layer scope)
- Data source: CoinGecko API (free tier, 30 calls/min rate limit)
- Existing API behavior must be preserved
</context>

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
- Mock all external network boundaries in tests
- Rate limit CoinGecko calls to stay within free tier (30/min)
</constraints>

<output_format>
- Backend: /api/prices endpoint returning { prices: [...], cached: bool, updatedAt: ISO }
- Frontend: React component with 5s auto-refresh interval
- Tests: Vitest suite with >=80% branch coverage
</output_format>

<success_criteria>
- Dashboard auto-updates every 5s and shows "stale" indicator when cache is old
- Proxy returns normalized data within 200ms (cache hit) / 2s (cache miss)
- Existing API integration tests still pass with zero modifications
</success_criteria>
```
</details>

| Dimension | Before | After | Change |
|-----------|-------:|------:|-------:|
| Clarity | 3 | 9 | +200% |
| Specificity | 2 | 9 | +350% |
| Structure | 1 | 10 | +900% |
| Constraints | 0 | 8 | new |
| Verifiability | 1 | 9 | +800% |
| Decomposition | 2 | 9 | +350% |
| **Overall** | **1.6** | **9.0** | **+462%** |

> Scores are self-assessed. Treat as directional indicators, not absolutes.

---

## Install

### Claude Code

```bash
mkdir -p skills/reprompter
curl -sL https://github.com/aytuncyildizli/reprompter/archive/main.tar.gz | \
  tar xz --strip-components=1 -C skills/reprompter
```

### OpenClaw / Codex

```bash
cp -R reprompter /path/to/workspace/skills/reprompter
```

### Any LLM

Use `SKILL.md` as the behavior spec. Templates are in `references/`.

---

## Quick Start

```
reprompt this: build a REST API with auth and rate limiting
```

```
reprompter teams - audit the auth module for security and test coverage
```

```
reverse reprompt this: [paste a great output you want to reproduce]
```

RePrompter interviews you (2-5 questions), generates a structured XML prompt, and shows a before/after quality score.

---

## How It Works

### Single Mode

```
Rough prompt → Input guard → Quick mode gate → Interview (2-5 questions)
→ Template selection → XML prompt generation → Quality scoring → Delta rewrite if < 7/10
```

17 templates cover feature, bugfix, refactor, testing, API, UI, security, docs, content, research, and multi-agent swarm patterns.

### Repromptverse Mode

```
Phase 1: Score prompt, interview if needed, plan team, show Plan Cards → user approves
Phase 2: Write XML prompt per agent (target 8+/10), show quality scorecard
Phase 3: Execute (tmux / TeamCreate / OpenClaw / sequential fallback)
Phase 4: Show Result Cards, evaluate, retry with delta prompts if needed (max 2)
```

Agents get non-overlapping scopes, explicit success criteria, and file:line reference requirements. The evaluator loop ensures quality before synthesis.

### Reverse Mode

```
Exemplar output → EXTRACT structure → ANALYZE task type + domain + tone
→ SYNTHESIZE XML prompt → Score → Optional: INJECT into flywheel
```

11 task type classifiers (code review, security audit, architecture doc, API spec, test plan, bug report, PR description, documentation, content, research, ops report) with 8 domain detectors and tone analysis. Solves the flywheel cold-start problem by seeding it with known-good prompt/output pairs.

---

## Key Features

**Closed-Loop Flywheel (v12)** - The loop is now end-to-end. Every prompt emits a `<success_criteria>` block of testable assertions. After execution, `scripts/outcome-record.js` writes a structured record joining prompt + criteria + output; `scripts/evaluate-outcome.js` scores it against the criteria (regex / predicate / llm_judge / manual). Records feed into a local flywheel via `npm run flywheel:ingest`. At generation time, `REPROMPTER_FLYWHEEL_BIAS=1` makes the skill consult past outcomes and bias toward historically winning recipes. `npm run flywheel:ab` compares bias-on vs bias-off effectiveness so you can *prove* whether the bias is helping. All data local.

**Prompt Flywheel Recipe Fingerprinting** - Every prompt carries a deterministic recipe fingerprint (template + patterns + capability tier + domain + context layers + quality bucket). Strategy learner groups outcomes by fingerprint so recommendations are grounded in repeated evidence, not one-off runs.

**Agent Cards** - Plan Cards (before execution), Status Line (during), Result Cards (after). Full transparency into what agents will do, are doing, and found.

**Dimension Interview** - Low-scoring prompt dimensions trigger targeted questions. No more vague prompts spawning expensive agents.

**Pattern Library** - 6 pluggable prompt engineering patterns: constraint-first framing, uncertainty labeling, self-critique checkpoints, delta retry scaffolds, evidence-strength labeling, context-manifest transparency.

**Capability Routing** - When multiple models are available, routes each agent by capability tier (reasoning, long context, cost-optimized, latency-optimized) with provider-diverse fallback chains.

---

## Testing

```bash
npm run check    # 205 tests + 4 benchmarks
npm test         # individual: npm run test:reverse-engineer
```

| Suite | Tests |
|-------|------:|
| Intent router | 21 |
| Reverse engineer | 43 |
| Outcome collector | 43 |
| Strategy learner | 36 |
| Recipe fingerprint | 14 |
| Repromptverse runtime | 9 |
| Capability policy | 7 |
| Pattern selector | 7 |
| Runtime adapter | 5 |
| Flywheel E2E | 5 |
| Others | 4 |
| **Total** | **169** |

All benchmarks at 100%: routing (64/64), artifacts (84/84), flywheel (13/13), provider (9/9).

---

## Compatibility

| Capability | Claude Code | Codex | OpenClaw | Any LLM |
|-----------|:-:|:-:|:-:|:-:|
| Single mode | yes | yes | yes | yes |
| Reverse mode | yes | yes | yes | yes |
| Multi-agent parallel | yes | yes | yes | - |
| Multi-agent sequential | yes | yes | yes | yes |

Codex parallel paths: **D1 native subagents** (Codex CLI 0.121.0+, `multi_agent` default-enabled) or **D2 shell-level** (`codex exec --ephemeral --sandbox workspace-write` + background + `wait`; workspace-write is required for workers to write their `/tmp/rpt-*.md` artifacts, and `codex exec` keeps approval = `never` automatically). See SKILL.md Option D and `references/runtime/codex-runtime.md`.

---

## Configuration

```json
// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "preferences": {
    "model": "opus"
  }
}
```

Feature flags: `REPROMPTER_FLYWHEEL`, `REPROMPTER_POLICY_ENGINE`, `REPROMPTER_LAYERED_CONTEXT`, `REPROMPTER_STRICT_EVAL`, `REPROMPTER_PATTERN_LIBRARY`, `REPROMPTER_TELEMETRY` (all `0|1`, enabled by default).

---

## Architecture

```
SKILL.md                        # Behavior spec (the product)
references/                     # 18 templates (XML + markdown)
  feature-template.md
  bugfix-template.md
  reverse-template.md
  marketing-swarm-template.md
  ...
scripts/                        # Runtime engine
  intent-router.js              # Mode + profile routing
  reverse-engineer.js           # Exemplar analysis + prompt extraction
  capability-policy.js          # Model selection + fallback chains
  context-builder.js            # Token-budgeted context assembly
  artifact-evaluator.js         # Output quality gates
  pattern-selector.js           # Pluggable prompt patterns
  recipe-fingerprint.js         # Strategy hashing
  outcome-collector.js          # Flywheel data capture
  strategy-learner.js           # Historical recommendation engine
  repromptverse-runtime.js      # Orchestration composer
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

## License

[MIT](LICENSE)
