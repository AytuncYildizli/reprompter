# Reverse Reprompter - Product Requirements Document

**Version:** v11.0.0
**Date:** 2026-03-30
**Author:** Aytunc Yildizli
**Status:** Implemented

---

## 1. Problem Statement

Users constantly encounter great AI outputs - a code review that caught the right bugs, an architecture doc that nailed the tradeoffs, a PR description that made review effortless. But they can't reproduce that quality on demand. The prompt that produced it is lost, implicit, or unknown.

RePrompter v1-v10 solved **forward prompt engineering**: rough prompt → structured prompt. But the harder, more valuable problem is the **inverse**: given a great output, extract the prompt that would reproduce it.

Additionally, RePrompter's flywheel learning system (v9.0+) has a cold-start problem. The combinatorial space of templates x patterns x tiers x domains is too large for users to naturally accumulate enough execution data for meaningful recommendations.

## 2. Solution

**Reverse Reprompter** (Mode 3) — a new mode that takes an exemplar output and reverse-engineers the optimal prompt that would reproduce that quality level.

### Core Value Propositions

| Value | Description |
|-------|-------------|
| **Reproduce excellence** | Point at any great output, get a reusable prompt |
| **Solve cold-start** | Every exemplar = pre-graded flywheel entry |
| **Zero extra cost** | Structural analysis is deterministic, no AI API calls |
| **Natural extension** | Uses all existing infrastructure (templates, patterns, scoring, flywheel) |

### Inspiration

Follows the same architectural pattern as [Extraktor](https://github.com/AytuncYildizli/extraktor), which reverse-engineers design systems from websites:

- **Extraktor**: Website (output) → Design System (DNA) - colors, typography, components → `genome.json`
- **Reverse Reprompter**: AI Output (exemplar) → Prompt (DNA) - role, task, requirements, constraints → XML prompt

## 3. User Stories

### P0 - Must Have

**US-1: Reverse engineer from pasted output**
> As a user, I can paste a great AI output and get back a structured XML prompt that would reproduce that quality, so I can reuse it for similar future tasks.

**US-2: Task type classification**
> As a user, the system automatically detects what type of output I provided (code review, architecture doc, etc.) so I don't have to specify it manually.

**US-3: Extraction Card transparency**
> As a user, I can see what the system detected (task type, domain, tone, structure, quality) before the prompt is generated, so I can verify the analysis is correct.

**US-4: Flywheel injection**
> As a user, I can choose to save the reverse-engineered prompt + exemplar as a flywheel entry, so the system learns from my best outputs.

### P1 - Should Have

**US-5: File path input**
> As a user, I can point to a file path instead of pasting text, so I can reverse-engineer prompts from existing files.

**US-6: Quick interview**
> As a user, I'm asked 1-2 clarifying questions (what I love about the output, what context produced it) to improve the reverse-engineered prompt.

### P2 - Nice to Have

**US-7: Batch reverse engineering**
> As a user, I can provide multiple exemplars and get a generalized prompt that captures the common pattern across them.

**US-8: Prompt comparison**
> As a user, I can compare the reverse-engineered prompt against what I actually used (if I remember), to see what was missing.

## 4. Functional Requirements

### 4.1 Trigger Detection

The system detects reverse mode via:
- **Explicit triggers**: "reverse reprompt", "reverse reprompter", "reprompt from example", "reprompt from this", "learn from this", "extract prompt from", "reverse engineer prompt", "prompt from output", "prompt dna", "prompt genome"
- **Force flag**: `forceReverse: true` in intent router options

Priority: Reverse triggers are checked before single/multi-agent triggers.

### 4.2 Input Validation

- Must be > 50 characters
- Must have some structure (headings, bullets, or multiple sentences)
- Reject if input looks like a prompt rather than an output (has `<role>`, `<task>` XML tags)
- Reject empty or single-word inputs

### 4.3 Analysis Pipeline

**Phase 1: EXTRACT (structural analysis)**
| Signal | How detected |
|--------|-------------|
| Headings | Markdown `#` pattern matching |
| Bullets | `-`, `*`, `+` list item detection |
| Code blocks | Triple-backtick counting |
| Tables | Pipe-delimited row detection |
| File:line refs | `path.ext:NN` pattern matching |
| Sentence length | Average words per sentence (excl. code/tables) |

**Phase 2: ANALYZE (content classification)**
| Signal | How detected |
|--------|-------------|
| Task type | 11 classifiers with phrases + headings + patterns, scored and ranked |
| Domain | 8 domain keyword sets, ranked by hit count |
| Tone | Formal/casual/neutral marker counting + directive language detection |
| Quality | Composite of specificity, coverage, clarity scores |

**Phase 3: SYNTHESIZE (prompt generation)**
- Map task type → best-fit reprompter template
- Build role from task type + domain expertise
- Build context from detected signals
- Build requirements from structural patterns
- Build constraints from what the exemplar does NOT do
- Build success criteria from quality markers
- Build output format from structural analysis
- Score the generated prompt on 6 dimensions

**Phase 4: INJECT (flywheel seeding)**
- Build outcome record with recipe fingerprint
- Set source as `reverse-exemplar`
- Set user verdict as `accept` (default)
- Apply +0.5 effectiveness bonus
- Write to `.reprompter/flywheel/outcomes.ndjson`

### 4.4 Output Format

The generated prompt follows the standard 8-tag XML structure:
```xml
<role>, <context>, <task>, <motivation>,
<requirements>, <constraints>, <output_format>, <success_criteria>
```

### 4.5 Extraction Card

Rendered after analysis, before prompt generation:
```markdown
## Reverse Extraction

| Dimension | Detected | Confidence |
|-----------|----------|------------|
| Task type | {type} | {high/medium/low} |
| Domain | {primary} | - |
| Tone | {formality} | - |
| Structure | {N sections, M bullets, K code blocks} | - |
| Quality | Clarity {N}/10, Specificity {N}/10, Coverage {N}/10 | - |

Template match: `{template-id}` | Flywheel injection: {ready/skipped}
```

## 5. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Analysis latency | < 100ms (no AI API calls) |
| Generated prompt quality | >= 7/10 overall score |
| Task type accuracy | >= 80% for well-structured exemplars |
| Determinism | Same input → same output (no randomness) |
| Test coverage | 43 unit tests across 10 test suites |
| Backward compatibility | No breaking changes to existing modes |

## 6. Technical Architecture

### New Files
| File | Purpose |
|------|---------|
| `references/reverse-template.md` | Template with EXTRACT/ANALYZE/SYNTHESIZE documentation |
| `scripts/reverse-engineer.js` | Core extraction, classification, and synthesis logic |
| `scripts/reverse-engineer.test.js` | 43 unit tests |

### Modified Files
| File | Change |
|------|--------|
| `scripts/intent-router.js` | Added `REVERSE_MODE_TRIGGERS` and reverse mode detection |
| `scripts/outcome-collector.js` | Added `injectExemplar()` and `sanitizeExemplarSignals()` |
| `SKILL.md` | Added Mode 3 section, updated frontmatter, task types table |
| `package.json` | Added test script, bumped to v11.0.0 |
| `CHANGELOG.md` | Added v11.0.0 entry |

### Integration Points
- **Intent Router**: Reverse triggers checked before single/multi-agent
- **Outcome Collector**: `injectExemplar()` writes pre-graded flywheel entries
- **Recipe Fingerprint**: Reverse-engineered prompts get fingerprinted for flywheel tracking
- **Strategy Learner**: Flywheel entries from reverse mode are indistinguishable from execution outcomes (except source field), enabling cross-mode learning

## 7. Task Type Classifiers

| Type | Template Match | Key Signals |
|------|---------------|-------------|
| code-review | bugfix-template | "critical issues", "suggestions", file:line refs |
| security-audit | security-template | "vulnerability", severity levels, CVE refs |
| architecture-doc | research-template | "components", "tradeoffs", "decision" |
| api-spec | api-template | HTTP methods, status codes, endpoint paths |
| test-plan | testing-template | "test cases", "coverage", assertion patterns |
| bug-report | bugfix-template | "steps to reproduce", "expected", "actual" |
| pr-description | feature-template | "what changed", "fixes #N" |
| documentation | docs-template | "installation", "usage", "configuration" |
| content | content-template | "introduction", "key takeaways" |
| research | research-template | "methodology", "findings", "recommendations" |
| ops-report | refactor-template | "timeline", "root cause", "action items" |

## 8. Success Metrics

| Metric | Target | How measured |
|--------|--------|-------------|
| Adoption | Users invoke reverse mode in >10% of reprompter sessions | Telemetry events |
| Quality | Generated prompts score >= 7/10 | Self-assessed scoring |
| Flywheel activation | >50% of reverse sessions inject into flywheel | Outcome store analysis |
| Cold-start resolution | Flywheel reaches medium confidence (5+ samples) 3x faster | Strategy learner metrics |
| User satisfaction | "Save to flywheel" acceptance rate >70% | User verdict tracking |

## 9. Future Directions (v12+)

- **Batch mode**: Analyze N exemplars, extract common pattern
- **Prompt diff**: Compare reverse-engineered vs actually-used prompt
- **Visual exemplars**: Screenshot input → vision-based analysis (full Extraktor pattern)
- **Cross-session learning**: Remember reverse-engineered prompts across sessions
- **Team reverse**: Analyze a set of agent outputs, reverse-engineer the team brief

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Misclassification | Low - wrong template selected | Quick interview catches it; user can override |
| Low-quality exemplar | Medium - garbage in, garbage out | Quality score < 5 blocks flywheel injection |
| Flywheel pollution | Medium - bad data harms recommendations | Source field enables filtering; user verdict gates injection |
| Feature bloat | Low - SKILL.md grows | Reverse mode is self-contained; ~120 lines added |
