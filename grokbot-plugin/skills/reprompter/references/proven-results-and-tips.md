# Proven results, tips, test scenarios

> Verbatim from root SKILL.md lines 1926-1969. `TESTING.md` is at the root of the RePrompter repo.

## Proven results

### Single prompt (v6.0)
Rough crypto dashboard prompt: **1.6/10 → 9.0/10** (+462%)

### Repromptverse E2E (v6.1)
3 Opus agents, sequential pipeline (PromptAnalyzer → PromptEngineer → QualityAuditor):

| Metric | Value |
|--------|-------|
| Original score | 2.15/10 |
| After Repromptverse | **9.15/10** (+326%) |
| Quality audit | PASS (99.1%) |
| Weaknesses found → fixed | 24/24 (100%) |
| Cost | $1.39 |
| Time | ~8 minutes |

### Repromptverse vs raw Agent Teams (v7.0)
Same audit task, 4 Opus agents:

| Metric | Raw | Repromptverse | Delta |
|--------|-----|----------------|-------|
| CRITICAL findings | 7 | 14 | +100% |
| Total findings | ~40 | 104 | +160% |
| Cost savings identified | $377/mo | $490/mo | +30% |
| Token bloat found | 45K | 113K | +151% |
| Cross-validated findings | 0 | 5 | — |

---

## Tips

- **More context = fewer questions** — mention tech stack, files
- **"expand"** — if Quick Mode gave too simple a result, re-run with full interview
- **"quick"** — skip interview for simple tasks
- **"no context"** — skip auto-detection
- Context is per-project — switching directories = fresh detection

---

## Test scenarios

See TESTING.md for 45 verification scenarios + anti-pattern examples.

