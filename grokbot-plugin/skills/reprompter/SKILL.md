---
name: reprompter
description: |
  Two intents: Improve ("reprompt this") emits a scored spec prompt; Build ("one-shot this") emits a build prompt for a whole app/game/site. Entry point that routes to the reprompter-* mode skills.
  Use when: "reprompt", "clean up this prompt", "before /goal", "Codex /goal", "Claude Code /goal", "Hermes /goal", "repromptverse", "reprompter teams", "smart run", "run with quality", "engineering/ops/research/marketing swarm", "compile to workflow", "workflow preflight", "dynamic workflow", multi-agent tasks, audits, "reverse reprompt", "prompt dna", "extract prompt from", "one-shot this", "one-shot a X", "tek promptla", "tek seferde", "vibe a game", "build me a whole app/game/site".
  Don't use for simple Q&A, casual chat, or execution-only tasks.
  Outputs: structured XML/Markdown prompt + before/after score; /goal command card (Codex/Claude Code/Hermes); optional team brief + per-agent prompts + Agent Cards; Reverse Extraction Card; Workflow Command Card + runnable .workflow.js (Workflow preflight lane / Option H).
  Target score: spec >= 7/10; per-agent >= 8/10.
metadata:
  version: 13.1.0
---

# RePrompter v13.1.0

> **Your prompt sucks. Let's fix that.** Two intents — improve my prompt, or build this whole thing — with `/goal`, Workflow, team execution and cross-model delivery as places the result can go. **v13 (RePrompter v2) restructures six lanes into two intents: a specifiability router picks spec-XML or an autonomous build prompt inside Improve, and Build can run as one prompt or split across a team. Every v12 trigger keeps working.**

---

## Two intents

Users learn two sentences. Everything else is machinery underneath them.

| Intent | Trigger | What happens |
|--------|---------|-------------|
| **Improve** — "make my prompt better" | "reprompt this", "clean up this prompt" | Interview → the specifiability router picks the shape: **spec-XML** when the done-state is enumerable up front (bugfix with a repro, endpoint with a contract, bounded feature), **outcome-prose** in the One-Shot shape when done can only be judged against a quality bar (whole product, "like X", aesthetic outcome) → score (spec-XML only) → output-format step |
| **Build** — "build this whole thing" | "one-shot this", "one-shot a X", "tek promptla", "tek seferde", "vibe a game", "build me a whole app/game/site" | Plain-language interview (max 4) → done-list brief → execution choice: **one prompt** (default; finishes in one session, maximal/loop opt-in) or **split across a team** (the brief seeds Repromptverse: done-list becomes the team's success criteria, the harsh checker becomes the evaluator) |

**Output formats (Improve):** these apply to **spec-XML results only** — an outcome-prose build brief is delivered as-is (it must not be compressed to `/goal` or compiled to a workflow, which would discard its staffing plan and checklist). paste (default) · compress to a `/goal <objective>` command (Codex CLI, Claude Code v2.1.139+, Hermes) · compile to a runnable `.workflow.js` (Claude Workflow tool) · deliver to another model via headless-relay (post-output step). The `/goal` and Workflow sections below define these formats; their triggers ("before /goal", "workflow preflight", "compile to workflow", "dynamic workflow", ...) jump straight to Improve with that format.

**Team execution (Build and beyond):** "repromptverse", "reprompter teams", "smart run", "smart agents", "run with quality" and the swarm triggers route to the Repromptverse machinery below — either standalone as today, or seeded by a Build brief.

**Advanced:** Reverse mode (extract the prompt DNA from a great output — "reverse reprompt", "prompt dna") keeps working exactly as before and feeds the flywheel; it lives in its own section below.

**Specifiability rule (Improve):** when the router picks outcome-prose, announce it in one line — "This looks like a whole-product ask — generating an autonomous build prompt; say 'spec' for the structured version." — and switch shapes if the user objects. Outcome-prose always keeps a constraints sentence (the home for "never touch auth"); it is not scored on the six dimensions.

Auto-detection: if task mentions 2+ systems, "audit", or "parallel" → ask: "This looks like a multi-agent task. Want to use Repromptverse mode?"

Definition — **2+ systems** means at least two distinct technical domains that can be worked independently. Examples: frontend + backend, API + database, mobile app + backend, infrastructure + application code, security audit + cost audit.

## Don't use when

- User wants a simple direct answer (no prompt generation needed)
- User wants casual chat/conversation
- Task is immediate execution-only with no reprompting step
- Scope does not involve prompt design, structure, or orchestration

> Clarification: RePrompter **does** support code-related tasks (feature, bugfix, API, refactor) by generating better prompts. It does **not** directly apply code changes in Single mode. Direct code execution belongs to coding-agent unless Repromptverse execution mode is explicitly requested.


---

## Routing

"Below" above means the mode skills. Load exactly one, then follow it:

| Trigger | Load |
|---|---|
| reprompt / improve a prompt (interview, scoring, templates) | `../reprompter-improve/SKILL.md` |
| one-shot / Build triggers; or Improve's router picks outcome-prose | `../reprompter-oneshot/SKILL.md` |
| repromptverse, teams, smart run, run with quality, swarms, audits, 2+ systems; Build "split across a team" | `../reprompter-team/SKILL.md` |
| reverse reprompt, prompt dna, extract prompt from | `../reprompter-reverse/SKILL.md` |
| /goal, workflow (compile, preflight, dynamic); headless-relay | `../reprompter-goal-workflow/SKILL.md`, after `reprompter-improve` |

## Core shared rules (always on)

- **Scoring:** Clarity 20%, Specificity 20%, Structure/Constraints/Verifiability/Decomposition 15% each; before/after table. Targets: spec >= 7, per-agent >= 8. One-Shot briefs unscored. Self-assessed, directional.
- **Closed loop:** IMPROVE → EXECUTE (Repromptverse only) → EVALUATE (0-10 vs criteria) → RETRY below target (max 2, delta prompts).
- **Success criteria:** `<success_criteria schema_version="1">`, 3-6 `<criterion>` (`rule` | `llm_judge` | `manual`); see `../reprompter-improve/references/outcome-schema.md`.
- **Budget:** ~2K tokens/prompt, ~1K/agent. Capitals only for safety-critical boundaries.
- **Interview:** max 5 (Build: 4, plain); autonomous lanes skip it and emit `<assumptions>`.
- **Context:** before generating, check loaded context (CLAUDE.md, skills, MCP, files); reference it, add only what's missing.
- **Uncertainty:** every prompt permits voicing uncertainty over fabricating ("if unsure, ask"; research: confidence labels; code: flag assumptions).
- **WHAT not HOW:** task, requirements, constraints, criteria — no step scripts.
- **Scripts:** helpers ship in `scripts/` here; a mode skill's `scripts/<name>` = `../reprompter/scripts/<name>`. Once per session (unless `REPROMPTER_VERSION_CHECK=0`) run `node scripts/version-check.js`; fail-soft.

## Shared references

- `references/advanced-features.md` — **required reading**; the rules above are its short form.
- `references/ambient-prompt-gate.md` — Ambient Prompt Gate hooks.
- `references/proven-results-and-tips.md` — results, tips, test scenarios.
- `references/original-frontmatter.md` — original frontmatter.
