# RePrompter v8.2 Launch Pack

## Positioning

RePrompter v8.2 is a prompt orchestration skill that routes work into the right domain swarm and enforces execution contracts.

- Single mode: intent router + structured prompt + self-eval + delta rewrite
- Multi-agent mode (Repromptverse): routing policy + termination policy + artifact contract + evaluator loop
- Domain swarms: marketing, engineering, ops, research
- Runtime compatibility: Claude Code, Codex, OpenClaw

## Proof Points

- Swarm router benchmark: `benchmarks/v8.2-swarm-benchmark.md`
  - Routing accuracy: 100% (6/6 fixtures)
  - Contract coverage: 100% for all swarm templates
- Codex runtime smoke:
  - `codex exec --model gpt-5-codex --full-auto "Reply with only: codex-v82-ok"`
  - Result: `codex-v82-ok`

## X Post (TR)

RePrompter v8.2 yayında.

- Repromptverse tek multi-agent mode
- 4 lazy-load swarm profile: marketing / engineering / ops / research
- Deterministik intent router + testler
- Benchmark harness: 100% routing accuracy (6/6)
- Codex + Claude + OpenClaw parity

Repo: https://github.com/AytuncYildizli/reprompter

## X Post (EN)

RePrompter v8.2 is live.

- Repromptverse is now the single multi-agent mode
- 4 lazy-loaded swarm profiles: marketing / engineering / ops / research
- Deterministic intent router with tests
- Benchmark harness with 100% routing accuracy (6/6 fixtures)
- Codex + Claude + OpenClaw parity

Repo: https://github.com/AytuncYildizli/reprompter

## LinkedIn (TR)

RePrompter v8.2 ile prompt cleanup'tan orchestration'a geçtik.

Bu sürümde:
- Repromptverse tek multi-agent standart
- Domain bazlı swarm profilleri (marketing, engineering, ops, research)
- Deterministik intent routing + unit test
- Benchmark harness (fixture tabanlı, repeatable)
- Codex ve Claude tarafında eşdeğer çalışma modeli

Özellikle ekip içi task delegation ve multi-agent kalite kontrolünde net kazanım sağladı.

Repo + release notları:
https://github.com/AytuncYildizli/reprompter

## Demo Prompt Set

### Marketing
`repromptverse launch campaign for AI community growth with SEO, content calendar, and conversion funnel`

### Engineering
`repromptverse refactor auth module, migrate api contract, and increase integration test coverage`

### Ops
`repromptverse gateway timeout incident with cron failures, uptime drops, and latency spikes`

### Research
`repromptverse benchmark memory systems and compare tradeoff matrix with confidence levels`

## Suggested Hashtags

`#AI #Agents #PromptEngineering #OpenSource #Codex #Claude #Automation #DevTools`
