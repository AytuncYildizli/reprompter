---
name: reprompter-reverse
description: |
  RePrompter Reverse mode (advanced) — extract the prompt DNA from a great output and emit the XML prompt that would have produced it, with extracted success criteria; optionally seeds the Prompt Flywheel.
  Use when: "reverse reprompt", "reverse reprompter", "prompt dna", "prompt genome", "extract prompt from", "reprompt from example", "reprompt from this", "learn from this", "reverse engineer prompt", "prompt from output".
  Don't use to improve a raw prompt (use reprompter-improve) or for simple Q&A.
  Outputs: Reverse Extraction Card + reverse-engineered XML prompt with extracted <success_criteria> + quality score.
  Target score: spec >= 7/10.
---

# RePrompter — Reverse (prompt DNA extraction)

> Mode skill of the `reprompter` plugin. Entry/routing: `../reprompter/SKILL.md`. Content below is verbatim from root SKILL.md lines 1314-1479; the reverse template is `references/reverse-template.md`. Task templates, scoring and `outcome-schema.md` live in `../reprompter-improve/`; headless-relay delivery of a finished Reverse prompt is in `../reprompter-goal-workflow/SKILL.md`; the Prompt Flywheel is in `../reprompter/references/advanced-features.md`. `scripts/<name>` paths resolve to the bundled `../reprompter/scripts/<name>` (e.g. `../reprompter/scripts/reverse-engineer.js`).
>
> **Required reading:** `../reprompter/references/advanced-features.md`. The always-on rules in `../reprompter/SKILL.md` → "Core shared rules" (context check, uncertainty permission, WHAT not HOW) apply to every extracted prompt.

## Advanced: Reverse Reprompter

### TL;DR

```
Great output in → optimal prompt out. Extract the DNA that produced excellence.

Phase 1: EXTRACT — structural analysis of the exemplar (~5s)
Phase 2: ANALYZE — classify task type, domain, tone, quality (~5s)
Phase 3: SYNTHESIZE — generate full XML prompt matching the exemplar's pattern (~10s)
Phase 4: INJECT — seed flywheel with pre-graded exemplar outcome (optional, ~2s)
```

**Key insight:** Users encounter great outputs constantly but can't reproduce the quality. Reverse Reprompter closes that gap by extracting the prompt that would have produced it.

### Trigger words

- "reverse reprompt", "reverse reprompter"
- "reprompt from example", "reprompt from this"
- "learn from this"
- "extract prompt from"
- "reverse engineer prompt"
- "prompt from output", "prompt dna", "prompt genome"

### Process

1. **Receive exemplar** — user provides text (paste, file path, or points to an existing output)
2. **Input guard** — must be substantial output (>50 chars, has structure). Reject raw prompts (use Single mode instead), empty text, or single-word inputs
3. **Quick interview** (max 2 questions via AskUserQuestion):
   - "What do you love about this output?" (with options: Structure / Depth / Tone / Coverage / Everything)
   - "What context produced it?" (with options: Code review / Architecture / API work / Research / Other) — skip if task type is detectable with high confidence
4. **Analyze** — extract structure, classify type, detect domain and tone
5. **Extract criteria** — derive a v1 `<success_criteria schema_version="1">` block from the exemplar's observable features (see "Criteria extraction from exemplars" below). The exemplar *is* the target, so the criteria encode "future outputs should match this exemplar's distinguishing properties."
6. **Generate** — produce full XML prompt using reverse template + best-fit task template; embed the extracted `<success_criteria>` block.
7. **Score** — show quality dimensions of the generated prompt
8. **Flywheel injection** — offer to save as pre-graded exemplar outcome

### Generate after analysis

After analysis completes, immediately:
1. Extract `<success_criteria>` from the exemplar (see "Criteria extraction from exemplars" below — 3–6 criteria anchored to observable features of the exemplar)
2. Generate the full reverse-engineered prompt, embedding the extracted `<success_criteria>` block
3. Show the Extraction Card (see below)
4. Show the generated prompt in XML format
5. Show quality score
6. Ask: "Save to flywheel? / Execute with this prompt? / Copy?"

```
❌ WRONG: Analyze exemplar → stop
❌ WRONG: Analyze exemplar → generate prompt → stop (skipping criteria extraction)
✅ RIGHT: Analyze exemplar → extract criteria → generate prompt with criteria → show Extraction Card → show score → offer actions
```

### Extraction Card (transparency layer)

Rendered after analysis, before the generated prompt. Use this exact format:

```markdown
## Reverse Extraction

| Dimension | Detected | Confidence |
|-----------|----------|------------|
| Task type | {code-review, architecture-doc, etc.} | {high/medium/low} |
| Domain | {primary domain} | - |
| Tone | {formal/neutral/casual} | - |
| Structure | {N sections, M bullets, K code blocks} | - |
| Quality | Clarity {N}/10, Specificity {N}/10, Coverage {N}/10 | - |

Template match: `{template-id}` | Flywheel injection: {ready/skipped}
```

### Criteria extraction from exemplars

Reverse Reprompter converts the exemplar into criteria by examining three layers of its structure and encoding the distinguishing features as v1 `<criterion>` entries. Aim for 3–6 total, mix of methods.

**Structural layer** (produces `rule` / `predicate` criteria):

- Section/header count: `len(output_text) > N` bounded by the exemplar's length ±20%
- Presence of specific section names the exemplar uses (e.g. "## Summary", "## Trade-offs") → `rule` / `regex` matching those headers
- Minimum number of bulleted items, code blocks, or table rows if the exemplar has them → predicate

**Content layer** (produces `rule` / `regex` or `llm_judge` criteria):

- Required domain terminology that the exemplar uses distinctively (e.g. "CVE-", "SLO", "RFC 7231") → `rule` / `regex`
- Presence of quantitative claims (numbers + units) when the exemplar has them → regex like `\d+\s*(ms|MB|%|seconds)`
- Judgement calls that can't be regex-checked (e.g. "argues from concrete evidence") → `llm_judge` with a judge_prompt that references the exemplar's reasoning style

**Style layer** (produces `llm_judge` or `manual` criteria):

- Tone match to exemplar → `llm_judge` with an explicit "matches the tone of this reference passage: {first 200 chars}" prompt
- Voice (active vs passive, first-person vs third-person) → `llm_judge` or `manual`
- Citation style or formatting conventions unique to the exemplar → `manual`

Rules of thumb:

- **No more than 2 `llm_judge` criteria per reverse prompt** — they're expensive to evaluate and easy to over-rely on. Prefer `rule` when the exemplar exposes an observable pattern.
- **At least one `manual` criterion for any deeply stylistic property** — those are the ones humans actually care about on review and shouldn't be auto-approved.
- **Anchor criteria to exemplar-specific features**, not generic ones. "Output uses headers" is useless; "Output has exactly the sections Summary / Trade-offs / Recommendation in that order" is useful.

### Exemplar types supported

| Exemplar type | Detected via | Template match |
|---------------|-------------|----------------|
| Code review | "critical issues", "suggestions", file:line refs | bugfix-template |
| Security audit | "vulnerability", severity levels, CVE refs | security-template |
| Architecture doc | "components", "tradeoffs", "decision" headings | research-template |
| API specification | HTTP methods, status codes, endpoint paths | api-template |
| Test plan | "test cases", "coverage", assertion patterns | testing-template |
| Bug report | "steps to reproduce", "expected", "actual" | bugfix-template |
| PR description | "what changed", "fixes #N", "breaking changes" | feature-template |
| Documentation | "installation", "usage", "configuration" | docs-template |
| Blog/content | "introduction", "key takeaways", "in this article" | content-template |
| Research/analysis | "methodology", "findings", "recommendations" | research-template |
| Ops report | "timeline", "root cause", "action items" | refactor-template |

### Flywheel integration

Reverse Reprompter is the **data pump** for the flywheel. Each reverse-engineered prompt creates a pre-graded outcome entry:

```
exemplar (known-good output) + generated prompt = high-confidence recipe
→ injected into .reprompter/flywheel/outcomes.ndjson
→ strategy learner can recommend this recipe for similar future tasks
→ solves cold-start problem (no need to accumulate data from scratch)
```

**Injection rules:**
- Only inject with explicit user consent ("Save to flywheel?")
- Exemplar outcomes get a +0.5 effectiveness bonus (user curated = high quality)
- Source field marked as `reverse-exemplar` to distinguish from execution outcomes
- User verdict defaults to `accept` (they chose the exemplar because it's good)

**When NOT to inject:**
- User says "just show me the prompt" or "don't save"
- Exemplar is too short or low quality (analysis quality score < 5)
- Flywheel is disabled (`REPROMPTER_FLYWHEEL=0`)

### Inspiration: Extraktor pattern

Reverse Reprompter follows the same architectural pattern as [Extraktor](https://github.com/AytuncYildizli/extraktor) (design system reverse-engineering from websites):

| Phase | Extraktor | Reverse Reprompter |
|-------|-----------|-------------------|
| **EXTRACT** | Scrape DOM, computed styles, assets | Parse structure, sections, patterns, tone |
| **ANALYZE** | Vision AI identifies components, layout | Classify task type, detect template match, infer constraints |
| **SYNTHESIZE** | Generate React components + genome.json | Generate XML prompt + flywheel entry |

The key borrowed insight is **dual-signal analysis**: Extraktor sends Claude both the screenshot AND the DOM for better results. Reverse Reprompter uses both structural analysis (heading count, bullet density, code blocks) AND content analysis (keywords, tone markers, domain signals) for classification.

### Token budget

| Phase | Tokens | Source |
|-------|--------|--------|
| Interview | 50-200 | AskUserQuestion (0-2 questions) |
| Analysis | 0 | Deterministic (no AI calls) |
| Prompt generation | ~500-1000 | XML prompt output |
| Extraction Card | ~100 | Summary table |
| **Total** | **~650-1300** | **Lighter than Single mode** |

Canonical implementation for structural analysis and classification lives in `scripts/reverse-engineer.js`. If docs and code ever diverge, the script is the source of truth.

After the extracted prompt is emitted, apply **Deliver via headless-relay
(post-output step)**: offer delivery once, only when that skill is installed;
otherwise stay completely silent about it.

---
