# Design: reprompter ↔ headless-relay integration

**Date:** 2026-07-09
**Status:** Approved
**Ships as:** reprompter v12.16.0 (Track 1), PR to dorukardahan/headless-relay (Track 2), per-machine fleet rollout (Track 3)

## Problem

Reprompter produces high-quality prompts, but delivering them to a non-Claude model
(Codex/GPT, GLM, Grok, Gemini) is a manual copy-paste step, and fleet agents
(OpenClaw-based company agents) have no reprompter at all. headless-relay
(dorukardahan/headless-relay, v1.3.1) already solves headless delivery to other
models' CLIs with preflight and provider-terms compliance gates. Integrate the two
without coupling them.

## Decisions (from brainstorm)

1. **Direction:** relay-out is primary (reprompt in Claude Code → relay delivers).
   Fleet agents additionally reprompt themselves natively. No relay-in service.
2. **Placement:** both sides — reprompter carries the canonical integration;
   headless-relay gets a small cross-linking reference PR.
3. **Shape:** a post-output **delivery step**, not a sixth lane.
4. **Fleet install:** one shared clone per machine at `~/.agents/skills/reprompter`.

## Track 1 — "Deliver via headless-relay" step in reprompter

New `SKILL.md` section + short README subsection + one capability-matrix row.

**Scope — which lanes get the step:**

| Lane | Delivery step? | Why |
|------|----------------|-----|
| Single | yes | produces a prompt artifact with no execution path |
| Reverse | yes | same — extracted prompt is a deliverable artifact |
| `/goal` preflight | no | the `/goal` card is already runtime-targeted paste material |
| Workflow preflight | no | executed by the Workflow tool |
| Repromptverse | no | Phase 3 already owns runtime execution (Options A–H) |

**Behavior:**

- After a Single or Reverse lane emits its final prompt, **if and only if** the
  headless-relay skill is available in the session, offer once:
  "Deliver this prompt to Codex / GLM / Grok / Gemini via headless-relay?"
- On yes: hand off `(prompt text, target model, output expectations e.g. JSON)`
  to the headless-relay skill and let it run its own flow. Report the relayed
  model's result back per headless-relay's own instructions.
- On no / no answer: stop after the prompt artifact, exactly as today.
- **Never auto-execute.** Delivery always requires the user's explicit yes.

**Silent absence (hard rule):** when headless-relay is not installed, the delivery
step is completely invisible. No offer, no "install headless-relay to enable
delivery" suggestion, no mention of the step anywhere in reprompter's output.
Reprompter's behavior with relay absent is byte-for-byte its current behavior.

**Ownership boundary (load-bearing):**

| Concern | Owner |
|---------|-------|
| Prompt quality, structure, scoring | reprompter |
| Target-CLI preflight (installed + authenticated) | headless-relay |
| Provider-terms compliance gates | headless-relay |
| CLI flags, output parsing, troubleshooting | headless-relay |

Reprompter's docs contain **zero CLI flags** for the relay lanes — every
mechanical detail defers to the headless-relay skill so the repos cannot drift.
The single caveat reprompter repeats inline: **the Gemini lane must run
sequentially** (agy parallel-burst hang, headless-relay v1.3.1), because it
affects multi-prompt delivery decisions reprompter itself makes.

**Claude as a delivery target is excluded.** Same-provider delegation uses the
harness's native subagent (headless-relay Check 1). The delivery offer lists
only Codex / GLM / Grok / Gemini.

**Change class:** docs-only. No scripts, no telemetry changes, no gate changes.
Both generated packages regenerate after the SKILL.md edit (`package:hermes`
and `package:plugin`). Version bumps to 12.16.0 (new capability, minor).

## Track 2 — Reference PR to headless-relay

Add `references/reprompter-relay.md` to dorukardahan/headless-relay:

- Content: the recipe from the relay's side — "the relay carries whatever prompt
  you give it; quality-in determines quality-out. If the orchestrator has a
  prompt-engineering skill (e.g. reprompter), run it before relaying." Includes
  the handoff shape `(prompt text, target model, output expectations)` and links
  back to reprompter's delivery-step section.
- Plus one link line in headless-relay's README.
- Credit both directions with @handles per GitHub style rules.
- Open item resolved at implementation time: whether the `dorukardahan` identity
  pushes a branch directly or we fork + PR — check with `gh` first.

## Track 3 — Fleet native reprompting

Per machine (MBP2, Mac Studio, dadflix-mac-mini):

```bash
git clone https://github.com/AytuncYildizli/reprompter ~/.agents/skills/reprompter
```

- `~/.agents/skills` is scanned by OpenClaw, Codex CLI, and Hermes runtimes —
  one copy serves every agent on the machine.
- Update path: `git pull`; `scripts/version-check.js` flags staleness on first
  invocation per session.
- No ambient gate for OpenClaw fleet agents (no hook surface); fleet reprompting
  is on-demand skill use only.
- **Verify before rollout** on one machine: (a) OpenClaw actually scans
  `~/.agents/skills` (claimed by headless-relay's README — verify, don't trust);
  (b) a fleet agent loads the skill and completes a Single-mode reprompt.

**Out of scope (possible follow-up):** a one-line soul nudge for select fleet
agents to consult reprompter before complex tasks.

## Error handling

- Relay skill absent → silent (see hard rule above).
- Target CLI missing or unauthenticated → headless-relay preflight reports and
  skips; reprompter does not retry or substitute.
- Relayed model errors → surface headless-relay's report verbatim; the prompt
  artifact remains valid and usable manually.

## Non-goals

- No relay-in service (other agents calling `claude -p` to reprompt).
- No sixth lane, no new triggers, no Relay Command Card artifact.
- No changes to prompt-gate.js, stop-gate.js, telemetry, or flywheel.
- No CLI mechanics duplicated into reprompter docs.

## Verification

- Track 1: `npm run validate:templates && npm run validate:tool-refs`, plugin +
  hermes package checks (`check:plugin-package`, `check:hermes-package`), then a
  fresh-session manual smoke: Single-mode reprompt → delivery offer appears with
  relay installed → deliver to Codex via `codex exec` → result reported. Second
  smoke with relay removed → no mention of delivery anywhere.
- Track 2: PR review on the headless-relay repo.
- Track 3: single-machine verification (above) before rolling to remaining machines.
