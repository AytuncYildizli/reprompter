## Deliver via headless-relay (post-output step)

Applies after the **Improve (spec-XML)** and **Reverse** intents only. The other intents own their
execution path: `/goal` cards paste into a runtime, Workflow preflight runs via the
Workflow tool, and Repromptverse Phase 3 owns runtime execution (Options A-H).

After emitting the final prompt artifact, check whether the **headless-relay** skill
is available in this session: it appears in the available-skills list as
`headless-relay` or any harness-namespaced form of that name (for example
`some-plugin:headless-relay`).

**Relay present — obtain the live target list, once per session.** The list of
offerable targets comes from headless-relay, never from here: load that skill and
follow its own preflight instructions to determine which targets are available —
its built-in lanes plus any custom targets the user has connected through its
registry, local models included, all first-class once available. "Available"
means whatever that skill's preflight says (including targets that need no
authentication). Do not reproduce its checks from memory and do not invent CLI
probes. Run this discovery at most once per session and reuse the result; treat
errors, timeouts, and targets you cannot verify as unavailable. If discovery
cannot run on this harness (no shell access, or the checks would require
interactive permission prompts before an unsolicited offer), or if no target
survives, stay silent: an offer with nothing available is noise, not a feature.
Also drop the orchestrator's own provider — the provider serving the current
session's model, per headless-relay Check 1 — since same-provider delegation
uses the harness's native subagent.

**Offer — exactly once, structured when possible.** If the harness has a
structured-question tool (for example AskUserQuestion), render the offer as ONE
question whose options are the available targets plus a decline option ("No —
just the prompt"); the target choice IS the offer, so a bare yes/no is never
shown. If the available targets cannot fit the tool's option limit, or there is
no structured-question tool, ask the same thing as one plain-text line with the
same shape — for example: "Deliver this prompt via headless-relay to Codex,
Grok, or qwen-local — or No, just the prompt?" — always including the decline
option. If the user accepts without naming exactly one target, ask once which
one; never pick a default and never fan out to several.

**On delivery — the orchestrator stays in the loop.** headless-relay exists to
involve other models, not to sideline the orchestrating agent. Invoke the
headless-relay skill and hand off three things — the finished prompt text, the
chosen target, and output expectations (for example "JSON only"). From here
headless-relay owns everything: any revalidation, provider-terms compliance,
exact flags, and output parsing. When the relayed answer returns, the
orchestrator reviews it by default: score it against the prompt's own
`<success_criteria>` (criterion-by-criterion pass/fail) — or, when the prompt
carries no criteria block, against its stated objective — flag gaps, and
recommend accept or retry-with-delta. Report the relayed output AND the review
verdict. Skipping review needs no extra question: if the user says "verbatim" or
"no review" at or after the target choice, report the raw relayed answer only.
On decline, or no answer: stop after the prompt artifact, exactly as if this
step did not exist.

**Relay absent** — stay completely silent. Do not offer delivery, do not suggest
installing headless-relay, do not name the skill. Output must be identical to a
session where this section does not apply.

Hard rules:

- Never auto-execute. Delivery always requires the user's explicit target choice.
- Never offer a target headless-relay's preflight did not mark available, and
  never offer the orchestrator's own provider (native subagent instead).
- The available-target list is headless-relay's answer, not this skill's:
  user-connected custom/local targets it reports are offered exactly like
  built-in lanes, and no availability check is ever reimplemented here.
- **Grok delivery target requires headless-relay v2.0.0+.** headless-relay only isolates Grok
  fail-closed (non-git working dir) from v2.0.0 onward (**v3.0.0 recommended: it also runs Grok
  under a hermetic `env -i` with a clean `HOME`/temp `GROK_HOME` and its cross-tool config scan
  off, so your global `~/.grok` rules do not leak into the model turn**); this repo's documented
  relay minimum is v1.3.1+, which is fine for the other targets. So if you cannot confirm the
  installed relay is v2.0.0+ (e.g. its SKILL.md `metadata.version`), do NOT offer Grok as a
  delivery target — an older or unprotected relay would run Grok in the caller's repo. The other
  targets are unaffected.
- Deliver Gemini prompts sequentially, one at a time. This is the only relay
  mechanic repeated here; every other CLI detail defers to the headless-relay
  skill so the two never drift.

