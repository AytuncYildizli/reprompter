---
name: reprompter-oneshot
description: |
  RePrompter Build intent — one prompt that builds a whole app/game/site in one session (default), or a brief that seeds a Repromptverse team.
  Use when: "one-shot this", "one-shot a X", "tek promptla", "tek seferde", "vibe a game", "build me a whole app", "build me a whole game", "build me a whole site", "build me X like <product>", or when reprompter-improve's specifiability router picks outcome-prose.
  Don't use for bounded changes (bugfix, endpoint, a feature in named files) — use reprompter-improve.
  Outputs: three-paragraph prose build brief (named reference, staffing with a separate harsh checker, 5-12 item done-list + stack). Not scored on the six dimensions.
---

# RePrompter — Build (One-Shot)

> Mode skill of the `reprompter` plugin. Entry/routing: `../reprompter/SKILL.md`. "Split across a team" hands the finished brief to `../reprompter-team/SKILL.md` (Repromptverse). Content below is verbatim from root SKILL.md lines 1285-1311; the template is `references/oneshot-template.md`.
>
> **Required reading:** `../reprompter/references/advanced-features.md`. The always-on rules in `../reprompter/SKILL.md` → "Core shared rules" (context check, uncertainty permission) apply to every build brief.

## Intent: Build (One-Shot)

For "one-shot this", "one-shot a X", "tek promptla", "tek seferde", "vibe a game", "build me a whole app/game/site" — the user wants **the whole thing built**, not a prompt they will hand to themselves. Two execution shapes: **one prompt** (default, below) or **split across a team** — if the user asks for a team (or says yes when the ask clearly spans 2+ independent domains), hand the finished brief to Repromptverse: the done-list becomes the team's success criteria, the harsh checker becomes the Phase-4 evaluator, and each work area becomes an agent scope. See `references/oneshot-template.md` "Split across a team".

Full template, interview, bracket-filling rules, and worked example: `references/oneshot-template.md`. Read it when this intent triggers.

The shape in brief — three prose paragraphs, no XML. This describes **default mode**; maximal mode replaces paragraph 3's checklist with the unreachable reference as its only bar and has no done-list at all:

1. **What good looks like** — a real named reference (never "AAA"/"polished", which let the model pick its own generous bar), one phrase of what quality means here, two seed work areas, then "anything you could think of" so the model enumerates the rest itself.
2. **Who does the work** — get one end-to-end slice running first, then expand; work areas in parallel where they don't touch, one helper per area, integrating as you go. A **separate** helper checks each piece and is told to be a harsh critic, not an encouraging one, and it writes and calibrates its own checks. Never let a builder grade its own work - self-graded work always passes. On a runtime with no helper mechanism, swap both helper sentences for an explicit hostile self-review pass and say it is weaker; never leave a prompt demanding a separate checker where none can exist.
3. **When it is done** (default mode) — a 5-12 item done-list, each item checkable by looking at the built thing, each closable as "not possible in {stack}, because X" only when genuinely impossible, or recorded unverified when a named measurement condition cannot be reproduced. The checker confirms items on the real running artifact, never on the builder's summary, and a final smoothing pass reconciles the separately built pieces before stopping. Plus the stack, which is the only technical instruction and shapes the result more than it looks like it will.

One-Shot output is **not scored** on the six dimensions - it is a prose build brief, not a structured prompt. Its bar in default mode is the checklist: 5-12 items, every one checkable by looking at the built thing. Maximal mode has no checklist by design.

Hard rules for this lane:

- **Never add `ultracode` or "/loop until perfect" on your own initiative.** Those are burn switches: an unbounded run against an unreachable bar never decides it is finished, so it runs for hours until someone stops it, and depending on the plan it can consume session or weekly caps. Default mode finishes inside one normal session. When the user does opt into maximal, the loop keywords are allowed as the runtime line only, and that line must repeat the prose's own stopping criterion with the same filled-in reference — never a different bar ("until it's perfect"), a checklist, or a deadline, each of which is a second stopping test that outlives the first.
- **Maximal mode is opt-in**, chosen by the user in the interview, and when chosen you state the limit cost in one plain sentence before the prompt.
- **Name the conditions for any measured item, and only conditions the checker can set itself.** "60fps" is not checkable; "60fps at 1600x900 with pixel ratio emulated to 2 and 40 enemies" is. Unstated conditions get filled in with whatever is easiest — one run reported every budget met at pixel ratio 1 and froze on the owner's pixel-ratio-2 screen. Owner-hardware conditions the checker cannot control make an item uncheckable again. This applies in both modes and to items the building agent adds itself, and when the real conditions cannot be reproduced the item is recorded unverified, never passed under easier ones.
- **Calibrate any scripted or measured check before trusting it**, against something known-good and something known-bad — in both modes, and in team runs. When a builder claims done but the artifact still looks wrong, suspect the check first: measuring the wrong property, a global average hiding one bad element, a pass that is necessary but not sufficient, or an instrument heavy enough to distort what it measures.
- **Maximal mode needs a babysitter.** In the one long run on record it stalled at the end of each turn with its own next prompt unsent, waiting for a keypress; context filled before quota did on that plan, though a smaller plan will hit quota first. Plateaus sometimes break after a reframing, so decide whether to continue on a measured gate rather than elapsed hope, and keep the best *verified* state — the one that passes your final check set, not an older high score under weaker checks.
- **Checklist items are uncapped; polish is not.** A checklist item is worked until it passes. Anything beyond the checklist goes back at most twice, then keep the best attempt and note it. An uncapped "send everything back until it's good" is an unbounded loop even without loop keywords. This is the default-mode contract; maximal deliberately has no polish cap, which is exactly why it is opt-in and costed up front.
- **In default mode the done-list ends the run, not the reference.** "Don't stop until it's as good as {reference}" is unreachable by construction. The reference sets direction; the list sets done. Maximal mode has no done-list and the unreachable reference is deliberately its only bar — that is the mode's mechanism, not an oversight, and it is why maximal must never also carry a checklist.
- **Do not impose a no-libraries or no-downloaded-assets rule** unless the user asks for one. From-scratch is an option, never a default.
- **Plain language in the interview.** Never say "exemplar", "orchestrator", or "termination condition" to the user.
- **Runtime-agnostic.** The prompt body is portable prose. Append at most one runtime line, and only in maximal mode.

