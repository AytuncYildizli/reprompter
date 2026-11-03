# Original root SKILL.md frontmatter

> Verbatim from root SKILL.md lines 1-18. The Grok Bot plugin splits the skill into `reprompter` plus mode skills; this keeps the original description, compatibility notes, and metadata.

```yaml
---
name: reprompter
description: |
  Two intents: Improve ("reprompt this") emits a scored spec prompt; Build ("one-shot this") emits a build prompt for a whole app/game/site.
  Use when: "reprompt", "clean up this prompt", "before /goal", "Codex /goal", "Claude Code /goal", "Hermes /goal", "repromptverse", "reprompter teams", "smart run", "run with quality", "engineering/ops/research/marketing swarm", "compile to workflow", "workflow preflight", "dynamic workflow", multi-agent tasks, audits, "reverse reprompt", "prompt dna", "extract prompt from", "one-shot this", "one-shot a X", "tek promptla", "tek seferde", "vibe a game", "build me a whole app/game/site".
  Don't use for simple Q&A, casual chat, or execution-only tasks.
  Outputs: structured XML/Markdown prompt + before/after score; /goal command card (Codex/Claude Code/Hermes); optional team brief + per-agent prompts + Agent Cards; Reverse Extraction Card; Workflow Command Card + runnable .workflow.js (Workflow preflight lane / Option H).
  Target score: spec >= 7/10; per-agent >= 8/10.
compatibility: |
  Single mode works on Claude surfaces, OpenClaw, Codex, Grok CLI, and Hermes Agent.
  `/goal` preflight mode works on Codex CLI (any version exposing the `goals` feature), Claude Code CLI v2.1.139+, and Hermes Agent; all three runtimes accept the same `/goal <objective>` shape. Disabled on Claude surfaces without `/goal` support, OpenClaw, and Grok CLI.
  Repromptverse mode supports Claude Code (TeamCreate or tmux → Option B/A), OpenClaw (sessions_spawn → Option C), Codex CLI (native subagents or `codex exec` → Option D), Grok CLI 4.3+ (spawn_subagent F1 or `grok -p` F2 → Option F), and Hermes Agent (delegate_task G1, shell-level G2, Kanban G3 → Option G). Sequential fallback (Option E) works with any LLM runtime.
  Workflow preflight lane + Repromptverse Option H target Claude Code's dynamic `Workflow` tool (JS-scripted background fan-out with schema-validated returns and resume); additive, detected by tool presence, with first-class ultracode.
  A post-output delivery step can — offered once as a structured choice (plain-text fallback) over the relay targets headless-relay's preflight marks available (built-in lanes plus user-connected custom/local targets), never auto-executed — hand a finished Single/Reverse prompt to the headless-relay skill; the orchestrator reviews the relayed answer against the prompt's success criteria by default. When the relay skill is not installed, no target is available, or availability cannot be verified, the step is invisible.
metadata:
  author: AytuncYildizli
  version: 13.1.0
---
```
