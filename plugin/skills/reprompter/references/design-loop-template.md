# Design Loop Template

Use this when the ask is that something **look designed rather than generated** — a landing page, a marketing site, a dashboard's visual layer, a redesign. Not for building a component to a spec: that is `ui-template.md`.

This template is **prose, not XML**. Like `oneshot-template.md`, it specifies who does the work, who judges it, and what "good" is measured against — because that is what a design pass needs. A spec cannot carry taste.

Everything below came out of one real redesign (a live product landing page, mid-2026), including the parts where the first attempt was rejected. Treat it as one observation, not a study.

## Why banning the AI look does not produce a designed one

The available anti-slop rules are negative: no purple gradients, no Inter as display, no cream-and-terracotta, no three equal feature cards. Those bans are correct and they are not enough. With the known clusters closed off, a model picks the *next* default — in the run behind this template, a cold technical Swiss dashboard, which the owner rejected in the same words he had rejected the first version.

Two things cause that:

- **A negative constraint cannot produce a point of view.** It only moves where the output lands.
- **The vocabulary used to demand quality is itself a style attractor.** "Premium", "editorial", "museum quality", "instrument-grade" each pull toward a specific cluster regardless of subject. Anthropic's own harness write-up records the same effect: adding "the best designs are museum quality" to an evaluator's criteria pushed generations toward one look.

So the direction cannot come from adjectives. It has to come from the subject's own world — its materials, its jokes, its vernacular, its existing artefacts.

## Stage 0: find what already exists, before designing anything

**This is the stage that decides the outcome, and it is the one models skip.** In the run behind this template, a full design cycle was spent inventing a direction that had to be thrown away, because the brand already had a board, a copy deck and an original mascot illustration sitting in the repo. The winning version was not designed; it was *ported*.

Before proposing anything, look for:

- brand boards, mockups, concept art, logo files, any image checked into **this** repo. If the material is elsewhere, ask the user for the path — an unprompted scan of adjacent directories reads other people's secrets and proprietary work, and it lands in model-visible output.
- a copy deck, positioning doc, or launch post draft — brand voice is usually written down somewhere before it is designed
- prior versions in git history, and any "canonical source" the current code was extracted from
- the product's own vocabulary: mascot names, mode names, campaign names, error strings, microcopy

Read them. Show the user what you found and say plainly whether the existing material is stronger than anything you would invent. If it is, port it and say so. Inventing over the top of a brand that already has one is the most expensive way to produce slop.

If genuinely nothing exists, derive the direction from the subject's own world rather than from a mood word: what the thing physically is, who uses it, what its jargon sounds like.

## Interview (plain language, max 3)

1. **"What is this page for, and who lands on it?"** — one sentence each. If the raw ask already says, skip.
2. **"Anything it should feel like, or anything it must not look like?"** — ask for something inspectable (a link, a screenshot, a file). A reference you can open beats one you remember. A "must not" is as useful as a "should".
3. **"How far can I go?"** — *fix what's broken* · *restyle inside the current direction* · *change the direction*. The third is a different job and needs saying out loud.

Never say "token system", "signature element" or "second-order defaults" to the user. Show them pixels and ask what they think.

## The prompt

Fill every bracket. This is the whole emitted prompt:

> Redesign **[what]** for **[who lands on it]**. Its job is **[the one thing the page must do]**. Look at **[the reference the user gave you]** before you start.
>
> Before designing anything, search **this repository** for material that already exists: brand boards, mockups, illustrations, copy decks, positioning docs, prior versions in git history, and the product's own names for things. List what you found. If the brand material lives outside the repo, ask for the path rather than scanning around — do not read directories you were not pointed at, because adjacent workspaces hold other people's secrets and unrelated proprietary work. Before you port any claim out of found copy, check it against what the code actually does, and rewrite or flag every claim you cannot verify: brand material records what someone hoped for, not what shipped.
>
> Then commit to one direction in writing before writing any code: 4-6 named colours with hex values, the typefaces for display and body and data, a one-sentence layout idea, and **one** signature element the page will be remembered by — one, because two signatures is none. Derive the direction from **[the subject's own world]** — never from words like premium, editorial or high-end, which each point at a specific look regardless of what you are designing. Say what you are deliberately not doing. Never **[hard negative]**.
>
> Build it. If it is meant to move, say which motion genre you are building — a scroll-scrubbed reveal, a sticky stack, a horizontal pan, a staggered reveal — and build the layout for it rather than adding effects afterwards. Never animate `top`, `left`, `width`, `height` or `margin`, which force layout every frame; `transform` and `opacity` are free, and colour changes on interactive states are fine. Make sure the page is complete and readable with animation switched off.
>
> Then have **a different helper** open the built page in a browser and try to get it rejected — one that did not build it. If your runtime has no way to run a second helper, do it as a pass of its own and say plainly in your report that a self-review is weaker than an independent one. If you have no way to open a browser at all, stop and say so: do not describe screenshots you did not take.
>
> The critic checks these, in this order. **First, is anything a fallback rather than a choice** — confirm each chosen face actually loaded and is rendering, not merely that the stylesheet asks for it. A declared family is not proof: if the webfont fails to load, the computed family still names it. Check that the font is loaded for the exact family and weight, and where you are unsure, measure the rendered width of a string against the same string in the fallback and confirm they differ. A page rendering in the browser's default serif can look more deliberate than the real thing. **Then contrast**, computed rather than judged, for every piece of text on the page and not only the body copy — navigation, headings, buttons, form labels and status text are usually the ones that fail — at 4.5:1 against its own background, or 3:1 where the text is large. **Then whether the signature damages the content** it sits next to. **Then the craft floor**: nested corner radii concentric (outer = inner + padding), optical rather than geometric centring for icons and asymmetric shapes, layered transparent shadows for depth with borders kept for structure and state, interruptible transitions for interactive states and keyframes only for one-shot sequences, and a press scale no smaller than 0.96. **Then every state this page actually has** — hover, focus, active, and loading or empty only where the page has them; an empty state that renders an empty bordered box is a defect, not a neutral. **Then the floor**: no horizontal overflow at 390px wide, visible keyboard focus on every control, and reduced motion respected.
>
> Any check you script rather than look at, calibrate before trusting it: run it against something you know is good and something you know is bad and confirm it says so. Confirm the instrument too — the screenshot's real pixel dimensions rather than the flag you passed, and that anything you compare is in the same coordinate space. If the page moves, capture it at fixed scroll positions across the whole scroll, let each position settle before capturing, and judge two things separately: every frame has to stand alone as a composed image, and the sequence has to read as one move you can describe in a sentence. Measure frame time during a scripted scroll, not while the page sits still. Say what budget you are measuring against before you measure, and state the conditions with the number: viewport, emulated pixel ratio, theme, and what was on screen. If you cannot reproduce those conditions, record the item unverified rather than reporting a number from an easier configuration — a frame time with no budget and no conditions is not a check.
>
> Then fix what the critique found and run the critic again. Polish beyond the list stops after three rounds — keep the best attempt, note it and move on. The list itself is not polish: **[done-list, 5-10 items each checkable by looking at the built page]**. Work each one until it passes, or record it unverified naming the condition you could not reproduce; three rounds never ends the run with an item still open.
>
> Whatever already works has to keep working. Nothing here licenses a broken page: the navigation, the forms, the data that loads and every link still behave as they did, and if you cannot check that in the browser, say which parts you could not. A page that photographs well and no longer works is not done. Anything you claim in a demo must be labelled as a demo. It is done when every done-list item is confirmed or recorded unverified and nothing that worked before is broken. Build it in **[stack]**.

### Scale it to the page

A one-fold page does not need the whole apparatus. Before emitting, cut what the ask does not carry: a page with no data does not need a third typeface, a page with nothing that loads has no loading state to walk, and a page that does not move gets no motion stage at all. The critique rounds are a ceiling, not a quota — one round that finds nothing is a finished page. Do not manufacture a signature element for a page whose job is one sentence and a button; if there is nothing to be remembered by, say so instead of inventing a gimmick.

### Assembling it for the answer you got

The interview's third question decides which paragraphs you emit, because a user who asked you to fix what is broken did not ask for a new direction:

- **fix what's broken** — drop the direction paragraph entirely and keep the existing palette and typefaces. Emit the rest.
- **restyle inside the current direction** — keep the direction paragraph but pin the existing colours and faces in it rather than choosing new ones.
- **change the direction** — emit all of it.

If the user gave no inspectable reference, drop that sentence rather than inventing one. If the ask is a new page rather than a redesign, say "Build" instead of "Redesign" and drop the git-history clause.

### Filling the blanks

- **`[the reference the user gave you]`** — a link, a screenshot or a file the agent can actually open. Drop the sentence if there is none; never substitute a remembered example.
- **`[hard negative]`** — a load-bearing thing that must not happen, captured verbatim from the user ("never touch the existing colour tokens"). Drop the whole "Never ..." sentence if the ask has none — but keep "Say what you are deliberately not doing", which stands on its own.
- **`[stack]`** — the framework and styling approach the page is built in. It shapes the result more than it looks like it will.
- **`[the subject's own world]`** — the concrete thing, not a mood: *air-traffic strips*, *a switchboard*, *a parody mascot with a microphone*, *hardware store signage*. If you cannot name a physical world, you do not have a direction yet.
- **the signature element** — the prompt has the agent choose this rather than taking it pre-filled, because it should come out of the direction it just committed to. There is no bracket for it; what the prompt enforces is that there is exactly one, and the surrounding page stays quiet.
- **`[done-list]`** — the visual items go here, and each must be checkable by looking: *the primary CTA is above the fold at 1440x900*, *no text renders in a fallback font*, *body text clears 4.5:1 on its own background*. "Looks premium" is not an item.

## What the critic must actually check

A critique that reads the code, or trusts the builder's summary, catches nothing. Give the critic these, in this order:

1. **Is anything a fallback rather than a choice?** In the run behind this template the page rendered its entire type in Times, because three CSS font variables were referenced and never defined. It looked *more* intentional broken than fixed. Check computed values, not appearance: if the display face is not the one that was chosen, nothing else about the typography matters.
2. **Contrast, computed.** One accent measured 4.36:1 on its own surface and read fine to the eye. It failed. Compute; do not judge.
3. **Does the signature damage the content?** The first signature in that run drew connector lines from words to cards, and two of three ran straight through the headline. A geometric check said the headline was clear — but it was comparing SVG user units to viewport coordinates, so it was measuring nothing. The pixels showed a line struck through a sentence.
4. **The craft floor**, which is where "feels expensive" actually lives. These are standard design-engineering practice rather than findings from the run, and they are worth stating because they are the details a generated page misses: nested corner radii concentric (outer = inner + padding), optical rather than geometric centring for icons and asymmetric shapes, layered transparent shadows for depth and borders only where they carry structure or state, interruptible transitions for interactive states and keyframes only for one-shot sequences, ~100ms stagger on infrequent entrances and none on frequent ones, and a press scale no smaller than 0.96. Review motion at 10% speed in the browser's animations panel: what is subtly wrong at full speed is obvious there.
5. **Every state, not just the happy one.** Hover, focus, active, loading, empty. An empty state that renders an empty bordered box is a defect, not a neutral.
6. **The quality floor, at real viewports.** No horizontal overflow at 390px, visible keyboard focus, reduced motion respected.

## When the page is supposed to move

If the ask names motion, or the reference is a site that animates as you scroll, the loop gains a stage between build and critique. Do not treat animation as polish applied at the end: the layout has to be built for the motion, so the motion has to be decided with the direction.

**Name the genre in the direction, not "add animations".** The common shapes each imply a different layout: a **scroll-scrubbed reveal** (one subject, usually a product, that turns or assembles as the scroll position advances), a **sticky stack** (sections pinned while their contents change), a **horizontal pan** (vertical scroll driving sideways travel), a **staggered reveal** (content entering as it comes into view). "Animated" is not a genre and produces the same scattered fades every time.

**A screenshot cannot judge motion, so capture a filmstrip.** Drive the page to fixed scroll positions and screenshot each, letting the page settle at every stop — a smooth-scroll or lerped implementation is still moving when the scroll call returns, so a capture taken immediately catches an intermediate state that is not what the visitor sees. Quartiles are the minimum and they undersample: the failures below live between the stops, so sample more densely wherever something enters or leaves. Then judge two separate things:

- **Every frame has to stand alone as a composed image.** Mid-scrub is where AI motion falls apart: a subject half off-canvas, a headline overlapping the thing it introduces, text at 40% opacity that is neither in nor out. If a frame would be unacceptable as a still, the animation is unacceptable.
- **The sequence has to read as one move.** Flip through the frames in order. If you cannot say in one sentence what happens, neither can a visitor.

**What is actually measurable, and worth measuring:**

- **Frame time during a scripted scroll**, not while sitting still. Record it under the configuration the thing ships at, including the real pixel ratio — a motion budget measured at the wrong pixel ratio is the same useless number as any other.
- **Nothing animates a layout property.** `top`, `left`, `width`, `height` and `margin` force layout on every frame; `transform` and `opacity` do not. This is greppable, so grep it.
- **Reduced motion resolves to a readable page**, not a frozen half-state. Set the preference and confirm the final composition is complete and legible with no animation at all. A scroll-scrubbed hero that shows nothing until you scroll fails this.
- **No orphaned listeners or triggers**, where the page has a lifecycle to test — a framework route or a mounted component. A static page has nothing to unmount, so this one does not apply to it. Half-built motion — a cut-off trigger, a jumpy enter, a missing cleanup — reads worse than no motion.

**The honest limit:** these checks catch broken, not beautiful. A filmstrip proves the frames compose and the sequence is legible; it cannot tell you the timing feels good. For that, review the motion at a tenth of normal speed in the browser's animation panel, where a wrong ease or a stagger that is 60ms too long is obvious, and then decide with your own eyes. That panel is a human affordance: an agent can slow CSS and Web Animations API timelines through `getAnimations()`, but nothing driven by a JavaScript loop is reachable that way, so treat feel as the part you judge yourself.

## When measurement and eyes disagree

Both are suspect. In the run behind this template a geometric check reported "no collision" and was right, reported an overlap that was dismissed as harmless, and the screenshot showed a line drawn through a sentence. The overlap report was true but not sufficient on its own, and the dismissal was the error.

- If a check passes and the page still looks wrong, suspect the check first: wrong property, wrong coordinate space, an average hiding one bad element, or a pass that is necessary but not sufficient.
- If a check fails and the page looks fine, suspect the check too — but look again before believing yourself.
- Calibrate any check you script against a case you know is good and one you know is bad before trusting it. A check that has never failed has never been tested.

## Two habits that pay for themselves

- **Cutting copy reveals defects.** Trimming a page's prose by a fifth exposed a label that had been overlapping a data row all along; the longer text had hidden it. Do a copy pass and then re-screenshot, because the layout changes under you.
- **Prefer the interaction that demonstrates a claim** over the one that decorates. In the run behind this template the strongest element was a switch that answered the question its own section asked, and a scripted demo that stopped and waited for the visitor's approval — because "risky actions wait for you" is the one claim worth operating rather than asserting.

## Worked example

**Raw input:** "our landing page keeps coming out as AI slop, redesign it" · **Product:** voice control for coding agents

Stage 0 found a brand board, a copy deck and an original mascot SVG — in a directory the owner named when asked, not one the run went looking in — none of which had reached the live site — the site had been rebuilt in cream paper and Inter, which is two documented AI-design clusters at once. The direction was therefore not invented: palette, hard offset shadows, poster type and the mascot came from the board. The deck's headlines were used too — and that is where the run got caught. The deck described a product the code did not implement, so the page shipped claims the repo contradicts: it was not a separate voice app, one named backend turned out to be one of two, and the thing the product exists for was missing from the page entirely. Found copy is a draft of the positioning, never a statement of fact; the truth test in the emitted prompt exists because this run failed it.

The signature became a switch labelled with the product's own mode name, because the section it sits in asks "how many agents do you want on the mic?" and the switch answers it: one agent working with two on the bench, or the crew dispatched with the receipt printing. The demo below it plays a scripted run that halts on a push and waits for the visitor to approve or hold, and both answers end differently.

Three rounds of critique found, in order: two connector lines crossing the headline and an accent failing contrast at 4.36:1; a connector drawn through a sentence that the geometry check had missed; and a state label overlapping a data row, exposed only after the copy was cut. None of the three were visible in a summary of the work.

## Honest close

Say this to the user, outside the prompt:

> This gets it out of the templated look and into a direction. It will still need your eye — bring back the parts you do not like and they get changed individually.

Do not promise the result is good. The run behind this template had its first direction rejected outright, in blunt terms, and the version that worked was the one that stopped inventing and used what the brand already had.
