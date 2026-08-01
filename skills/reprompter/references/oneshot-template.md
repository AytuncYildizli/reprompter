# One-Shot Template

Use this when the user wants **one prompt that builds a whole thing** — an app, a game, a site, a deck — in a single autonomous run.

This template is **prose, not XML**. Other templates specify *what to build*. This one specifies *who does the work, who checks it, and when it is finished*, because that is what a long autonomous run needs.

The shape below is a proven one-shot prompt structure. RePrompter's job is not to invent a new shape — it is to **fill the blanks well**, because choosing the right reference, the right two seed areas, and the right stack is the part users get wrong.

## Interview (plain language, max 4)

Ask using the runtime's normal question mechanism (`AskUserQuestion` on Claude Code; plain chat anywhere else). Never say "exemplar", "orchestrator", or "termination condition" to the user — those are mechanics, not their vocabulary.

1. **"What are you making?"** — usually already in the raw prompt; skip if clear. → fills `[what you want]`
2. **"Anything it should feel like?"** — name a real game/app/site, "describe it instead", or "no reference". → fills `[the best known example]`, `[what good looks like]`. Three rules: (a) always ask if they have anything the agent can actually *look at* — screenshots, a link, a file — and include whatever they give in the prompt; an inspectable reference beats a remembered one every time. (b) If you know the named reference only shallowly, say so, and ask for the two or three things it should copy from it — put those in the prompt instead of the name alone, because a shallowly-known reference yields generic output and only you can see that coming. (c) If they have no reference, do not invent one: ask for two or three concrete things that would make it good, and open the prompt with "It should be **[trait]**, **[trait]** and **[trait]**" in place of "at the level of ...".
3. **"What are you building it with?"** — Browser/web · Phone app · Desktop · Game engine · Something else, describe it · Not sure, pick for me. For a CLI or a service, get the language and how it is run; for a non-software artifact (a report, a deck) the "running product" the checker inspects is the rendered document, and performance-style conditions do not apply. → fills `[your tool or stack]`
4. **"How far should it go?"** — ask this last, and only once the one-prompt-vs-team decision (see "Split across a team") is settled, because team execution rules maximal out. — **Finish in one session (default)** · **Go maximal — hours of babysitting, and depending on your plan it can eat your session or weekly cap**. See "Two modes" below. Ask which agent they will paste into if they choose maximal (the runtime line) or if you cannot otherwise tell whether their agent can run helpers — the helper wording below depends on that in **both** modes. When you cannot confirm it, use the no-helper wording rather than guessing.

Derive the rest yourself and show it for confirmation rather than asking: the quality word (`[top tier]`), the two seed areas, and the done-list. Pull must-have features from the user's own words. If the ask carries a load-bearing negative — something that must NOT happen ("never touch auth", "do not add dependencies", "keep the existing API") — capture it verbatim and fill `[hard negative]`; if there is none, drop that sentence from whichever body you emit. Both bodies carry it — a load-bearing negative must survive into a maximal run too. This is the home for constraints in the prose shape.

**Scale the shape to the ask.** A landing page or a small CLI does not need a roster: one build pass, a hostile review pass, and five real items is the whole thing. Do not invent work areas to fill a helper per area, and do not script a check where looking at the result is the check — the machinery is supposed to cost less than the build.

**Do not** add a no-libraries or no-downloaded-assets rule unless the user asks. Libraries and assets usually produce a better result faster. "Build everything from scratch" is an option, never a default.

## Two modes

| | Finish in one session (default) | Go maximal (opt-in only) |
|---|---|---|
| Ends when | the done-list is complete | you stop resending — it stalls after each long turn until you do, and on a smaller plan quota can block it outright. A full context window does not end it: the session compacts and carries on with its history lost, which is worse than stopping |
| Loop keywords | none | `/loop`, `ultracode` (Claude Code) |
| Cost | completes inside a normal working session | **hours of wall-clock, needs babysitting, and can consume your session or weekly caps depending on plan** |

Default is **finish in one session**. Only emit the maximal variant when the user explicitly picks it, and when they do, state the cost in one plain sentence before the prompt. Never add `ultracode` or "loop until perfect" on your own initiative. Maximal opt-in is the one case where the loop keywords are allowed at all, and only as the runtime line below — which must carry the prose's own stopping criterion, never a different bar.

**What one long maximal run looked like** — a single 20-hour run on Claude Code in mid-2026, so treat it as one observation, not the mode's guaranteed nature. The run happened outside this repository and its transcript is not checked in, so everything below is the maintainer's report of it rather than something a reader can audit here:

- **It did not sustain itself.** It ran in long turns (roughly 4-13 hours each within that run), and at the end of each it stopped with its own next-step prompt sitting unsent, waiting for a keypress. Plan for babysitting rather than walking away, and check whether your runtime behaves the same.
- **On that plan, context filled before quota did** — 98% of the session window while the usage quota held. On a smaller plan quota will bite first. Either way, when context fills the session compacts and loses what was already tried; that lost history is what makes a run start repeating itself, and progress resumes when it manages to reframe the problem rather than retry it.
- **Progress was not smooth.** Three blockers looked permanent at hour 8, and by hour 20 the run's own gates reported every performance budget met — though those passes were the ones measured at the wrong pixel ratio, so read them as the run's gates being satisfied, not as the artifact being fast on the owner's machine. Plateaus sometimes break after the model reframes the problem — but decide whether to continue on a measured gate, not on elapsed hope.
- **Keep the best verified state, not the last commit.** Mid-run refactors caused real regressions there: quality dipped after a rewrite before exceeding its previous best. Compare candidates with the *same* final set of checks — an old high score under an older, weaker check set is not better — and in this mode, where there is no done-list, that means a state the harsh checker still passes on every check it was applying at the end.

## The prompt (default mode)

Fill every bracket. Three paragraphs, no headings, no XML:

> I want you to build **[what you want]** at the level of **[the best known example]**. It should be **[what good looks like]**, with every single thing done at **[top tier]** quality, from **[example area]** to **[example area]** to anything you could think of.
>
> Get one end-to-end slice working first — **[the thinnest thing that runs]** — then expand it to close the checklist below. Work the areas in parallel where they don't touch, one helper per area, and integrate as you go rather than at the end. Have a separate helper check each piece — one that did not build it, told to be a really harsh critic rather than an encouraging one. Separate two things: a checklist item either passes or it doesn't — no cap, keep working until it passes — while *polish* beyond the checklist goes back **at most twice**, after which you keep the best attempt, note it, and move on. The checker judges checklist items against the checklist, never against the reference.
>
> Before building, list the areas of work this needs — the two above plus whatever else you can think of — and fold anything essential into the checklist below. For anything you add that is measured rather than looked at, name the conditions it is measured under and make them match where this will actually run. Then build only against that checklist. It is done when: **[done-list, 5-12 checkable items]**. For any check that is scripted or measured rather than simply looked at, the checking helper writes and calibrates it — never the builder whose work it grades — by running it against something known-good and something known-bad and confirming it says so. The checking helper, not the builder, confirms each item, by running or looking at the built thing itself — the running product, its real pixels or its real output — never by reading the code or a summary the builder wrote. When a check disagrees with what you can actually see — passing something that is wrong, or failing something that is right — the check is the first suspect, not the build: it may be measuring the wrong property, averaging over a spot that is actually bad, passing on something necessary but not sufficient, or heavy enough to be causing the problem it is measuring. If you cannot set up the conditions an item is supposed to be measured under, build the thing anyway and record the check as unverified, naming the condition you could not reproduce — never pass it under easier conditions. Unverified does not block finishing and is not an escape from work: the feature is still built, only the measurement is missing, and "this is hard" is never a reason to use it. An item may be marked not possible in **[your tool or stack]** only when the platform genuinely cannot do it — expect zero or near-zero of those; "I could not measure it" is unverified, not impossible. Never **[hard negative]**. You are finished when every item is either confirmed or recorded unverified with the condition you could not reproduce — expect zero or near-zero unverified. Then do one last pass over the whole thing to smooth out inconsistencies between the separately built pieces, and afterwards re-confirm any item that pass could have touched: a smoothing pass that breaks a confirmed item is not finished work. Then stop. Resolve any ambiguity yourself with a sensible choice, note it, and keep going — do not wait for anyone. Build it in **[your tool or stack]**.

### Filling the blanks

- **`[the best known example]`** — a real named thing, never an adjective. "AAA", "polished", "professional" let the model pick its own bar and it picks a generous one. Naming a real product hands over everything the model already knows about it: how it should feel, how it should read, what belongs on screen.
- **`[what good looks like]`** — one phrase of what quality means here ("fast and readable", "calm and editorial"), not a paragraph.
- **`[example area]` ×2** — two concrete areas of work, then "anything you could think of" hands the rest of the list back. The model enumerates the remaining areas itself, and working out what the work even *is* is the part people are worst at.
- **`[done-list]`** — 5-12 items, each checkable by looking at the built thing, and confirmed by the checking helper rather than the builder. **Name the conditions any measured item is measured under, and pick conditions the checker can actually set.** "Holds 60fps" is not checkable. "Holds 60fps at 1600x900 with device pixel ratio emulated to 2, dark theme, 40 enemies spawned" is — every one of those the checker can configure itself. Do not write conditions it cannot control, like the owner's laptop model; that turns a checkable item back into an uncheckable one. Why this matters: one run reported every performance budget met because it measured at pixel ratio 1 while the artifact ran at 2 — four times the pixels, and it froze on the owner's screen. The measurement was honest and the number was useless. And the conditions must match where the thing will actually run — naming them honestly does not help if you name the easy ones. Measure at the target's real configuration (if it ships to retina screens, emulate pixel ratio 2; if it serves 10k-row tables, load 10k rows); if a target configuration cannot be reproduced in the session, mark that item unverified rather than passing it under a substitute. When the thing genuinely ships to several configurations — phone and desktop widths, light and dark — name a small representative set rather than pinning one, or the item passes on the config you picked while broken on the one you did not. Only items that are actually measured need a condition pack — "the pricing page shows three tiers" needs none. Unstated conditions get filled in with whatever is easiest, so state them: for measured visual or performance items that means viewport, emulated pixel ratio, theme where the thing has one, and load — for other kinds it means dataset size, concurrency, and whether the system was warmed up. **This is what ends the run.** "Not possible here, because X" exists so a genuinely impossible item cannot block everything — it is not an escape hatch for hard items, and on a normal stack you should expect zero or near-zero of them.
- **`[your tool or stack]`** — the primary technical instruction; it shapes the result more than it looks like it will.
- **`[hard negative]`** — optional. A load-bearing thing that must NOT happen, captured verbatim from the user ("never touch auth"). Drop the sentence entirely if the ask has none — do not invent one.

### When a check passes but the thing is still wrong

Source material for the checker sentence in paragraph three. Four failures came out of that 20-hour run, all in the checks rather than the build — the categories are general even though the examples are from a 3D renderer:

- **Measuring the wrong property.** A highlight check scored what *fraction of the frame* was bright, when what mattered was whether a bright highlight existed at all — so a small, correct practical light failed a check it should have passed. In a web build the same shape is a check on average response time when the requirement was that no request exceeds a ceiling.
- **Global where it should be regional.** An average passes while one element fails badly — a page-wide contrast score passes while one button is unreadable, or p50 latency looks fine while one tenant times out. The run's own words: *"that's the second time a builder satisfied a number without satisfying the image."*
- **Passing is necessary, not sufficient.** A framing check confirmed the hand was on screen; the hand was behind the weapon, invisible. A pass told you nothing about occlusion.
- **The instrument distorting the thing.** The frame-time gate read pixels back from the GPU every frame and cost 26ms by itself — it was the performance problem it was measuring. Tracing or verbose logging left on during a benchmark does the same.

When a builder claims done and the artifact is still wrong, treat the pass as unproven and look at the criterion, the checker and the build independently — do not assume the builder is the broken part.

### Why the done-list, and why the reference is not the finish line

"Don't stop until it's as good as **[the best known example]**" is unreachable by construction — the real thing had a studio and years — so the run never terminates itself and instead runs until the platform cuts it off. That is exactly what happened in the public run this shape comes from. The reference sets **direction**; the done-list sets **done**.

## The prompt (maximal mode — opt-in)

Emit this complete prompt instead of the default one. It has exactly **one** termination clause: the reference. If the user had no reference and you filled traits instead (interview rule c), the clause becomes "until that harsh checker is genuinely wowed judging it against **[trait]**, **[trait]** and **[trait]**, as harshly as it would judge a shipped product" — and say plainly that traits are a weaker bar than a named product, so the run is likelier to plateau early. Prefer settling on a reference before offering maximal at all. Do not also emit "It is done when" — two termination clauses in one prompt is the most common way this shape fails.

> I want you to build **[what you want]** at the level of **[the best known example]**. It should be **[what good looks like]**, with every single thing done at **[top tier]** quality, from **[example area]** to **[example area]** to anything you could think of.
>
> Get one end-to-end slice working first — **[the thinnest thing that runs]** — then keep expanding. Work the areas in parallel where they don't touch, one helper per area, and integrate as you go rather than at the end. Have a separate helper check each piece — one that did not build it, told to be a really harsh critic rather than an encouraging one. If a piece isn't **[top tier]**, it goes back, however many rounds it takes.
>
> Whenever you measure something rather than just look at it, say in writing what conditions you measured it under and make those match where this will actually run — not the easiest configuration your environment happens to give you. If you cannot reproduce the real conditions, record that measurement as unverified instead of passing it under easier ones. The helper doing the checking writes and calibrates its own checks — never the builder whose work it grades — running each against something you know is good and something you know is bad and confirming it says so before trusting it. When a check disagrees with what you can actually see — passing something wrong or failing something right — the check is the first suspect, not the build: it may be measuring the wrong property, averaging over a spot that is actually bad, passing on something necessary but not sufficient, or heavy enough to be causing the problem it is measuring. Every few rounds, do a pass over the whole thing to smooth out inconsistencies between the separately built pieces. Before any large rewrite, record which state last passed your checks, and if quality drops after it, go back to that state — compare candidates using the checks you are applying now, not the scores an older weaker check gave. Never **[hard negative]**. Don't stop until that harsh checker is genuinely wowed comparing it with **[the best known example]**. Resolve any ambiguity yourself with a sensible choice, note it, and keep going — do not wait for anyone. Build it in **[your tool or stack]**.

Say this to the user in plain words before emitting it, as its own sentence:

> This runs for hours and needs you to restart it each time it stalls; depending on your plan it can also eat your session or weekly cap.

## Helper wording (both modes)

Both bodies staff the work with helpers in three distinct places, and a runtime with no helpers breaks all three, not just the first:

1. the whole parallel-staffing clause: `Work the areas in parallel where they don't touch, one helper per area, and integrate as you go rather than at the end`
2. `Have a separate helper check each piece — one that did not build it, told to be a really harsh critic`
3. every later mention of `the checking helper` / `the helper doing the checking` — the one that writes, calibrates and confirms the checks

If the target runtime has no sub-agent or helper mechanism — a plain chat model, or any agent the user cannot confirm has one — replace **all three** — and replace whole clauses, not substrings: swapping only the words "one helper per area" leaves "Work the areas in parallel where they don't touch, do each area as a separate pass", which contradicts itself.

| In the body | Replace with |
|---|---|
| Work the areas in parallel where they don't touch, one helper per area, and integrate as you go | do each area as a pass of its own, in whatever order suits them, and integrate as you go rather than at the end |
| a separate helper checks each piece, harsh critic | *"Then, in a pass of its own, review the built thing as a hostile critic who did not write it: state what each check is before you run it, run it against the built thing, and record the result before you touch the code again."* |
| the checking helper writes / calibrates / confirms | *"in that review pass, write each measured check yourself — never reuse a check you wrote while building — and before trusting it, run it against something you know is good and something you know is bad and confirm it says so; then confirm each item against the built thing itself, never by reading the code"* |

Leaving any of these as-is is worse than replacing them: a prompt that demands a checker the runtime cannot create is the one instruction an agent resolves by quietly grading its own work. Say plainly to the user that this is weaker than an independent checker, because the same model is grading itself — it is the best available on a runtime with no helpers, not an equivalent. This applies in **both** modes.

## Runtime line

Append **at most one** runtime line, and **only in maximal mode** — the default body needs none. Never append a line whose keywords the runtime does not have; if you are not certain the user's runtime supports `/loop` and `ultracode` in this exact form, append nothing. Vendor name alone is not proof — the user confirming the command exists in their build is. And tell them the loop line goes at the **start of its own message**, not at the end of the pasted block: a slash command in the middle of a paste is just text.

| Runtime | Append |
|---|---|
| Claude Code | `/loop until that harsh checker is genuinely wowed comparing it with [the best known example]. Fan out sub-agents and ultracode.` — permitted only because the user opted into maximal, and it must repeat the prose's own stopping criterion verbatim — the **same filled-in reference**, or the same three traits when there is no reference — so the prompt still has exactly one stopping test. Do not append a different bar (`until it's utterly perfect`), a checklist, or a deadline. Two unreachable bars are not the same bar: the run would be answering to two different tests with no way to tell which one governs, and "perfect" is the vaguer of the two, so it is the one an agent will drift toward or rubber-stamp. One prompt, one bar. |
| Cursor · Gemini · Grok · Kimi · GLM · Hermes · OpenClaw · plain chat model · other | Nothing. The prose already asks for parallel helpers and a harsh checker in words every agent understands. |

**Codex gets nothing appended, and must not be routed through the `/goal` preflight lane.** That lane compresses a prompt into a one-line objective, which would throw away the staffing paragraph and the checklist — the two things that make this artifact work. Paste the prose as-is.

## Honest close

Say this to the user **outside** the copyable prompt block, and never inside it — an agent that receives this line pasted along with the prompt reads it as permission to stop at prototype quality. One sentence, not a disclaimer block:

> This lands at a strong working prototype — expect to keep iterating after it stops.

Do not promise it matches the reference. The public run behind this shape was reported by its author at about 5/10 against its reference, with blind checks still preferring the real thing — while producing a real, working, impressive artifact. That is the honest pitch and it is a good one.

## Worked example

**Raw input:** "a roguelike like Hades but in the browser" · **Mode:** finish in one session

> I want you to build a browser roguelike at the level of Hades. It should be fast and readable — you always know what hit you — with every single thing done at shipped-game quality, from combat feel to room generation to anything you could think of.
>
> Get one end-to-end slice working first — move into a room, kill one enemy, take damage, die, restart — then expand it to close the checklist below. Work the areas in parallel where they don't touch, one helper per area, and integrate as you go rather than at the end. Have a separate helper check each piece — one that did not build it, told to be a really harsh critic rather than an encouraging one. A checklist item either passes or it doesn't — keep working until it passes — while polish beyond the checklist goes back at most twice, after which you keep the best attempt, note it, and move on. The checker judges checklist items against the checklist, never against Hades.
>
> Before building, list the areas of work this needs — the two above plus whatever else you can think of — and fold anything essential into the checklist below. Then build only against that checklist. It is done when: a run is playable from start to death without reloading the page; three weapons with different attack shapes, ranges and cooldowns; four room layouts that chain with no loading break; every enemy attack has a visible wind-up of at least 0.3s before it lands; a boss that changes attack set at least once below half health; the dash has invulnerability frames; at least six upgrades, of which three add or change a behaviour rather than only adjusting a number; death shows a run summary and starting a new run resets state with no page reload; beating the boss ends the run with a victory screen and returns to the hub; it holds 60fps at 1600x900 with device pixel ratio emulated to 2 and 40 enemies on screen; and there is audio for hits, deaths and pickups. The checking helper writes and calibrates the measured checks itself — the frame-rate one and the wind-up timing: confirm the frame-rate check reports a low number on a deliberately overloaded scene and a high one on an empty room, and that the wind-up check fails a deliberately instant attack. If a check passes while the game is still wrong, the check is the first suspect — wrong property, an average hiding one bad case, a pass that is necessary but not sufficient, or a probe heavy enough to be the stutter it is measuring. The checking helper, not the builder, confirms each item by playing the built game — instrumenting the running game where an item needs timing, like the wind-up and the dash frames — never by reading the code. An item may be marked not possible in a browser only when the platform genuinely cannot do it — expect zero of those here. When every item is confirmed, do one last pass to smooth the pieces into one coherent game — then stop. Resolve any ambiguity yourself with a sensible choice, note it, and keep going. Build it in the browser with WebGL/Three.js.

*This lands at a strong working prototype — expect to keep iterating after it stops.*

## Split across a team

**Team execution is default-mode only.** It needs a done-list to become the team's success criteria, and maximal mode deliberately has none — so if the user wants a team, use the default (done-list) prompt, never the maximal one. Decide one-prompt-vs-team before offering maximal.

If the user asks for a team — or says yes when the ask clearly spans 2+ independent domains — do not emit the one-prompt form. Hand the finished brief to Repromptverse (SKILL.md "Team execution") with this mapping:

- the enumerated **work areas** → **2-5 agent scopes** (Repromptverse's cap): group related areas so each agent owns a coherent, non-overlapping slice, and name one agent as integrator for cross-cutting concerns;
- the **done-list** → the team's success criteria, split per agent by area. Carry the measurement rules across with it: any criterion that is measured rather than looked at keeps the conditions it is measured under, and the evaluator calibrates any check it scripts against a known-good and a known-bad case before reporting a pass. Carry the unverified outcome across too: a criterion whose target conditions the evaluator cannot reproduce is recorded unverified with the condition named, not left blocking the phase and not passed under a substitute configuration;
- the **harsh checker** → the Phase-4 evaluator (separate from every builder, "neither passes" allowed). Be honest about the gap: standard Repromptverse Phase 4 reads each agent's report/artifact *file* and scores against criteria — it does not by default run the built product and judge live pixels the way the one-prompt path's checker does. If the artifacts are runnable and live inspection matters, say so in the per-agent success criteria ("the evaluator must run the built file, not read a summary") so the evaluator actually exercises them. Integration is the same trap as the smoothing pass: whatever the integrator changes has to be re-checked after it changes it, or the delivered whole is unverified even though every part passed.
- the **smoothing pass** → the synthesis step after all agents complete. Again mind the gap: default synthesis composes the agents' reported outputs; a code-level integration pass that reconciles the separate pieces into one coherent artifact is extra work you must ask for explicitly in the synthesis instruction, not something the report-merge gives you for free.

Net: the one-prompt path gets live-artifact checking and code smoothing for free; the team path gets parallelism and per-area ownership but you must spell out live inspection and integration, or you get report-level evaluation and text synthesis.

This does not add a fifth question. Before question 4, if the ask clearly spans 2+ independent domains, the user hears one extra sentence: "This splits well across a team — run it as N agents instead of one prompt?" Default remains one prompt; the team path is for when the user wants it or the domains genuinely don't touch.

## When to use

- "one-shot this", "one-shot a X", "tek promptla", "tek seferde", "vibe a game", "build me a whole app/game/site"
- The user wants a finished artifact from one prompt, not a prompt to hand to themselves.
- Works beyond software: a landing page against a site they admire, a report, a deck, a design.

## When not to use

- A bounded task → Improve (spec-XML).
- They want a standalone team for an audit or operator-owned work (not a from-scratch build) → Repromptverse directly. A team that builds a whole thing is this intent with "split across a team".
- No checkable finished state (open-ended research, audits) — the done-list cannot be written, so the run cannot end.
