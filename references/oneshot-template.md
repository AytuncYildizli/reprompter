# One-Shot Template

Use this when the user wants **one prompt that builds a whole thing** — an app, a game, a site, a deck — in a single autonomous run.

This template is **prose, not XML**. Other templates specify *what to build*. This one specifies *who does the work, who checks it, and when it is finished*, because that is what a long autonomous run needs.

The shape below is a proven one-shot prompt structure. RePrompter's job is not to invent a new shape — it is to **fill the blanks well**, because choosing the right reference, the right two seed areas, and the right stack is the part users get wrong.

## Interview (plain language, max 4)

Ask via `AskUserQuestion`. Never say "exemplar", "orchestrator", or "termination condition" to the user — those are mechanics, not their vocabulary.

1. **"What are you making?"** — usually already in the raw prompt; skip if clear. → fills `[what you want]`
2. **"Anything it should feel like?"** — name a real game/app/site, "describe it instead", or "no reference". If they name one, say plainly whether you know it well; a reference you know shallowly yields generic output and the user cannot tell that from outside — you can. → fills `[the best known example]`, `[what good looks like]`
3. **"What are you building it with?"** — Browser/web · Phone app · Desktop · Game engine · Not sure, pick for me. → fills `[your tool or stack]`
4. **"How far should it go?"** — **Finish in one session (default)** · **Go maximal**. See "Two modes" below.

Derive the rest yourself and show it for confirmation rather than asking: the quality word (`[top tier]`), the two seed areas, and the done-list. Pull must-have features from the user's own words.

**Do not** add a no-libraries or no-downloaded-assets rule unless the user asks. Libraries and assets usually produce a better result faster. "Build everything from scratch" is an option, never a default.

## Two modes

| | Finish in one session (default) | Go maximal (opt-in only) |
|---|---|---|
| Ends when | the done-list is complete | the runtime stops it |
| Loop keywords | none | `/loop`, `ultracode` (Claude Code) |
| Cost | completes inside a normal working session | **consumes your 5-hour window and can eat into the weekly cap** |

Default is **finish in one session**. Only emit the maximal variant when the user explicitly picks it, and when they do, state the limit cost in one plain sentence before the prompt. Never add `ultracode` or "loop until perfect" on your own initiative — those are the burn switches, and an unbounded run against an unreachable bar does not end on its own; it ends when the platform cuts it off.

## The prompt (default mode)

Fill every bracket. Three paragraphs, no headings, no XML:

> I want you to build **[what you want]** at the level of **[the best known example]**. It should be **[what good looks like]**, with every single thing done at **[top tier]** quality, from **[example area]** to **[example area]** to anything you could think of.
>
> Fan out sub-agents and have sub-agents tackle each one individually. Have a separate sub-agent check each piece to ensure it is **[top tier]** — one that did not build it, and that is told to be a really harsh critic rather than an encouraging one. If a piece isn't **[top tier]**, it goes back.
>
> It is done when: **[done-list, 5-12 checkable items]**. Each item is either working and verified, or explicitly marked not possible in **[your tool or stack]** with a reason. Build it in **[your tool or stack]**.

### Filling the blanks

- **`[the best known example]`** — a real named thing, never an adjective. "AAA", "polished", "professional" let the model pick its own bar and it picks a generous one. Naming a real product hands over everything the model already knows about it: how it should feel, how it should read, what belongs on screen.
- **`[what good looks like]`** — one phrase of what quality means here ("fast and readable", "calm and editorial"), not a paragraph.
- **`[example area]` ×2** — two concrete areas of work, then "anything you could think of" hands the rest of the list back. The model enumerates the remaining areas itself, and working out what the work even *is* is the part people are worst at.
- **`[done-list]`** — 5-12 items, each checkable by looking at the built thing. **This is what ends the run.** Allow "not possible here, because X" as valid closure so one impossible item cannot block everything.
- **`[your tool or stack]`** — the only technical instruction. It shapes the result more than it looks like it will.

### Why the done-list, and why the reference is not the finish line

"Don't stop until it's as good as **[the best known example]**" is unreachable by construction — the real thing had a studio and years — so the run never terminates itself and instead runs until the platform cuts it off. That is exactly what happened in the public run this shape comes from. The reference sets **direction**; the done-list sets **done**.

## The prompt (maximal mode — opt-in)

Same three paragraphs, but the third ends with the reference as the bar and the loop keywords appended:

> Don't stop until each sub-agent is utterly wowed with the quality compared with **[the best known example]**. Build it in **[your tool or stack]**. /loop until it's utterly perfect. Fan out sub-agents and ultracode.

Precede it with: *"This will run until your 5-hour limit and can eat into your weekly cap."*

## Runtime line

The prompt body is portable prose that works in any agent that can spawn helpers. Append **at most one** runtime line, only in maximal mode:

| Runtime | Append |
|---|---|
| Claude Code, Cursor | `/loop until it's utterly perfect. Fan out sub-agents and ultracode.` |
| Codex | Route through the `/goal` preflight lane — it compresses this into `/goal <objective>`. |
| Gemini · Grok · Kimi · GLM · Hermes · OpenClaw · other | Nothing. The prose already asks for parallel helpers and a harsh checker in words every agent understands. |

If the runtime has no sub-agent mechanism, replace "fan out sub-agents" with "do each area as a separate pass, then re-read your own output as a hostile reviewer before moving on."

## Honest close

One sentence after the prompt, not a disclaimer block:

> This lands at a strong working prototype — expect to keep iterating after it stops.

Do not promise it matches the reference. The public run behind this shape scored about 5/10 against its reference and blind checks still preferred the real thing — while producing a real, working, impressive artifact. That is the honest pitch and it is a good one.

## Worked example

**Raw input:** "a roguelike like Hades but in the browser" · **Mode:** finish in one session

> I want you to build a browser roguelike at the level of Hades. It should be fast and readable — you always know what hit you — with every single thing done at top-tier quality, from combat feel to room generation to anything you could think of.
>
> Fan out sub-agents and have sub-agents tackle each one individually. Have a separate sub-agent check each piece to ensure it is top-tier — one that did not build it, and that is told to be a really harsh critic rather than an encouraging one. If a piece isn't top-tier, it goes back.
>
> It is done when: a run is playable start to death without a reload; three weapons that feel genuinely different; four room layouts that chain without loading breaks; enemies with two attack patterns and readable telegraphs; a boss with phases; upgrades that change how a run plays rather than just numbers; death returns to a hub and a new run starts clean; it holds 60fps on a laptop; audio for hits, deaths and pickups. Each item is either working and verified, or explicitly marked not possible in a browser with a reason. Build it in the browser with WebGL/Three.js.

*This lands at a strong working prototype — expect to keep iterating after it stops.*

## When to use

- "one-shot this", "one shot", "tek prompt", "vibe a game", "build me a whole X"
- The user wants a finished artifact from one prompt, not a prompt to hand to themselves.
- Works beyond software: a landing page against a site they admire, a report, a deck, a design.

## When not to use

- A bounded task → Single mode.
- They want to run a team and review results themselves → Repromptverse.
- No checkable finished state (open-ended research, audits) — the done-list cannot be written, so the run cannot end.
