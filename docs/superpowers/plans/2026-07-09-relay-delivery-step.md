# Headless-Relay Delivery Step + Fleet Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a docs-only "Deliver via headless-relay" post-output step to reprompter (v12.16.0), contribute a cross-linking reference to dorukardahan/headless-relay, and roll reprompter out to fleet machines via `~/.agents/skills`.

**Architecture:** Track 1 edits root `SKILL.md` + `README.md` only, then regenerates the two derived packages (`plugin/skills/reprompter`, `skills/reprompter`) from root. Track 2 is a small reference-file PR to an external repo. Track 3 is per-machine git clones with verify-first rollout. Spec: `docs/superpowers/specs/2026-07-09-relay-integration-design.md`.

**Tech Stack:** Markdown docs, npm test/validate scripts (Node 20+), `gh` CLI, git.

## Global Constraints

- Branch: all reprompter work on `feat/relay-delivery-step` (already created; spec committed as `02c52af`). NEVER commit to main.
- Git attribution: NO `Co-Authored-By` trailers, NO "Generated with ..." footers in commits or PR bodies (user rule, non-negotiable).
- Version: `12.16.0` everywhere it appears (SKILL.md frontmatter + title, README badge, package.json, package-lock.json; plugin.json / marketplace.json / generated packages pick it up via regeneration).
- Silent absence is a HARD rule: when headless-relay is not installed, reprompter output must be byte-for-byte its current behavior — no offer, no install suggestion, no mention.
- Reprompter docs contain ZERO relay CLI flags. The single permitted relay mechanic: "Gemini prompts deliver sequentially, one at a time."
- Claude is never a delivery target (headless-relay Check 1: same-provider work uses the native subagent).
- Docs-only for Track 1: no changes to any `scripts/*.js`, hooks, or telemetry.
- Root `SKILL.md` is canonical. NEVER hand-edit `plugin/skills/reprompter/` or `skills/reprompter/` — regenerate with `npm run package:plugin` and `npm run package:hermes`.
- GitHub comments/PR text in B1 English, short sentences. Credit collaborators by @handle.

---

### Task 1: SKILL.md — delivery-step section + lane pointers

**Files:**
- Modify: `SKILL.md` (root only) — frontmatter `compatibility` block (~line 12-16), end of Single lane (~line 567, before the `---` preceding `## Lane: Repromptverse (Agent Teams)`), end of Reverse lane (~line 1419, before the `---` preceding `## Quality scoring`), new section inserted immediately before `## Quality scoring` (~line 1422).

**Interfaces:**
- Produces: SKILL.md section heading `## Deliver via headless-relay (post-output step)` — Task 2's README section and Task 5's reference file link to this exact heading text.

- [ ] **Step 1: Add one sentence to the frontmatter `compatibility` block**

In the YAML frontmatter, the `compatibility: |` block currently ends with the line about Workflow preflight ("...additive, detected by tool presence, with first-class ultracode."). Append this as a new line inside the block, same indentation:

```
  A post-output delivery step hands finished Single/Reverse prompts to the headless-relay skill (targets: Codex, GLM, Grok, Gemini) when that skill is installed; when it is not installed the step is invisible.
```

- [ ] **Step 2: Insert the new section before `## Quality scoring`**

Find the line `## Quality scoring` (~line 1422). Insert this entire block immediately BEFORE it (the preceding line is `---`; keep it, and end the new section with its own `---`):

```markdown
## Deliver via headless-relay (post-output step)

Applies after the **Single** and **Reverse** lanes only. The other lanes own their
execution path: `/goal` cards paste into a runtime, Workflow preflight runs via the
Workflow tool, and Repromptverse Phase 3 owns runtime execution (Options A-H).

After emitting the final prompt artifact, check whether the **headless-relay** skill
is available in this session (it appears in the available-skills list as
`headless-relay`).

**Relay available** — offer exactly once:

> Deliver this prompt to Codex / GLM / Grok / Gemini via headless-relay?

On yes: invoke the headless-relay skill and hand off three things — the finished
prompt text, the target model, and output expectations (for example "JSON only").
headless-relay owns everything downstream: CLI preflight (installed and
authenticated), provider-terms compliance, exact flags, and output parsing. Report
the relayed model's answer back following that skill's own instructions. On no, or
no answer: stop after the prompt artifact, exactly as if this step did not exist.

**Relay absent** — stay completely silent. Do not offer delivery, do not suggest
installing headless-relay, do not name the skill. Output must be identical to a
session where this section does not apply.

Hard rules:

- Never auto-execute. Delivery always requires the user's explicit yes.
- Claude is not a delivery target. Same-provider delegation uses the harness's
  native subagent (headless-relay Check 1). Offer only Codex / GLM / Grok / Gemini.
- Deliver Gemini prompts sequentially, one at a time. This is the only relay
  mechanic repeated here; every other CLI detail defers to the headless-relay
  skill so the two never drift.

---
```

- [ ] **Step 3: Add the Single-lane pointer**

At the end of the Single lane, after the last bullet of "### Project context detection" (`- Never scan parent directories or carry context between sessions`) and before the `---` that precedes `## Lane: Repromptverse (Agent Teams)`, insert:

```markdown
### After the final prompt

If the headless-relay skill is installed, apply **Deliver via headless-relay
(post-output step)**. If it is not installed, say nothing about delivery.
```

- [ ] **Step 4: Add the Reverse-lane pointer**

At the end of the Reverse Extraction section, after the line "Canonical implementation for structural analysis and classification lives in `scripts/reverse-engineer.js`. If docs and code ever diverge, the script is the source of truth." and before the `---` that precedes the new delivery-step section, insert:

```markdown
After the extracted prompt is emitted, apply **Deliver via headless-relay
(post-output step)** — offer delivery only when that skill is installed;
otherwise stay silent about it.
```

- [ ] **Step 5: Run validators**

Run: `npm run validate:templates && npm run validate:tool-refs`
Expected: both exit 0 (they validate `references/` templates and tool references; the new section adds neither).

- [ ] **Step 6: Verify no CLI flags leaked into the new content**

Run: `sed -n '/## Deliver via headless-relay/,/^---$/p' SKILL.md | grep -nE '\-\-[a-z]|codex exec|opencode run|grok -p|agy -p|zcode'`
Expected: no output (exit 1). The section must defer all CLI mechanics.

- [ ] **Step 7: Commit**

```bash
git add SKILL.md
git commit -m "feat: deliver-via-headless-relay post-output step for Single and Reverse lanes"
```

---

### Task 2: README — section, compatibility row, badge text

**Files:**
- Modify: `README.md` — new section after the Five Output Lanes table (~line 38, before `## Before / After`), Compatibility table (~line 399), footnotes below it, badge (line 11), what's-new line (line 16).

**Interfaces:**
- Consumes: section heading `## Deliver via headless-relay (post-output step)` from Task 1 (link target).

- [ ] **Step 1: Insert README section after the Five Output Lanes table**

After the lanes table and its closing `---` (before `## Before / After`), insert:

```markdown
## Relay delivery (post-output step)

Not a sixth lane. When the [headless-relay](https://github.com/dorukardahan/headless-relay) skill is installed alongside RePrompter, the **Single** and **Reverse** lanes end with a one-time offer to deliver the finished prompt to Codex, GLM, Grok, or Gemini headlessly. RePrompter owns prompt quality; headless-relay owns CLI preflight, provider-terms compliance, and all CLI mechanics. Delivery never auto-executes, Claude is not a relay target (same-provider work uses the harness's native subagent), and Gemini prompts deliver sequentially. Without headless-relay installed, the step is invisible — no offer, no install nag. See `SKILL.md` section "Deliver via headless-relay (post-output step)".

---
```

- [ ] **Step 2: Add the Compatibility table row**

In the `## Compatibility` table, after the `| Ambient gate | ... |` row, add:

```markdown
| Relay delivery (headless-relay) | yes⁵ | yes⁵ | yes⁵ | - | yes⁵ | - |
```

- [ ] **Step 3: Add footnote ⁵**

After footnote ⁴ (the Hermes scripts/ note), add:

```markdown
⁵ Requires the [headless-relay](https://github.com/dorukardahan/headless-relay) skill (v1.3.1+) installed in the same session — its README documents install paths for Claude Code, Codex CLI, OpenClaw, and Hermes. When headless-relay is absent the step is completely silent. Grok CLI is a relay *target*, not a documented headless-relay host.
```

- [ ] **Step 4: Update badge and what's-new line**

Line 11: change `version-12.15.1-0969da` to `version-12.16.0-0969da`.
Line 16: change `**What's new (v12.8–v12.15):** ambient prompt gate, one-command plugin install, template refresh, fleet learning` to `**What's new (v12.8–v12.16):** ambient prompt gate, one-command plugin install, headless-relay delivery step, fleet learning`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README relay-delivery section, compatibility row, v12.16.0 badge"
```

---

### Task 3: Version bump, CHANGELOG, regenerate both packages

**Files:**
- Modify: `SKILL.md` (frontmatter `version:` + title line 19 + bold blurb line 21), `package.json`, `package-lock.json`, `CHANGELOG.md`.
- Regenerate: `plugin/` tree, `skills/reprompter/` tree, `.claude-plugin/marketplace.json`, `plugin/.claude-plugin/plugin.json` (all via npm scripts — never hand-edit).

**Interfaces:**
- Consumes: Task 1 + Task 2 content (packages embed SKILL.md).
- Produces: version `12.16.0` in every artifact; Task 4 pushes it.

- [ ] **Step 1: Bump root SKILL.md version markers**

- Frontmatter: `version: 12.15.1` → `version: 12.16.0`
- Line 19: `# RePrompter v12.15.1` → `# RePrompter v12.16.0`
- Line 21 blurb: replace the trailing bold sentence (`**v12.15.1 hardens ... normal input.**`) with `**v12.16.0 adds a deliver-via-headless-relay post-output step for Single and Reverse lanes — silent unless the headless-relay skill is installed.**`

- [ ] **Step 2: Bump package.json + lockfile**

Run: `npm version 12.16.0 --no-git-tag-version`
Expected: `v12.16.0` printed; `package.json` and `package-lock.json` both updated.

- [ ] **Step 3: Add CHANGELOG entry**

At the top of `CHANGELOG.md`, insert:

```markdown
## v12.16.0 (2026-07-09) — Headless-relay delivery step

### Added

- New post-output step "Deliver via headless-relay": when the headless-relay skill (dorukardahan/headless-relay v1.3.1+) is installed, Single and Reverse lanes end with a one-time offer to deliver the finished prompt to Codex, GLM, Grok, or Gemini. Never auto-executes; Claude is not a relay target; Gemini delivers sequentially.
- Silent-absence guarantee: without headless-relay installed, output is unchanged — no offer, no install suggestion.
- README: Relay delivery section, Compatibility row + footnote ⁵.

### Changed

- Ownership boundary documented: RePrompter owns prompt quality; headless-relay owns CLI preflight, provider-terms compliance, and CLI mechanics. No relay CLI flags appear in RePrompter docs.
- `package.json`, `package-lock.json`, generated plugin, and generated Hermes package — version `12.16.0`.

### Verification

- `npm run validate:templates`
- `npm run validate:tool-refs`
- `npm run test:plugin-package && npm run check:plugin-package`
- `npm run test:hermes-package && npm run check:hermes-package`
```

- [ ] **Step 4: Regenerate BOTH packages**

Run: `npm run package:plugin && npm run package:hermes`
Expected: both exit 0; `git status` shows changes under `plugin/` and `skills/reprompter/` including version `12.16.0` in `plugin/.claude-plugin/plugin.json` and the regenerated SKILL.md copies containing the new section.

- [ ] **Step 5: Run the package test + check suite**

Run: `npm run test:plugin-package && npm run check:plugin-package && npm run test:hermes-package && npm run check:hermes-package && npm run check:hermes-guard`
Expected: all exit 0. If `check:hermes-guard` flags the new section (Skills Guard scan), fix via sanitizer rules in `scripts/hermes-sanitizer.json` — never by hand-editing the generated package.

- [ ] **Step 6: Verify version consistency**

Run: `grep -rn "12\.15\.1" SKILL.md README.md package.json plugin/.claude-plugin/plugin.json .claude-plugin/marketplace.json skills/reprompter/manifest.json`
Expected: no output (exit 1).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: v12.16.0 — version bump, changelog, regenerate plugin and hermes packages"
```

---

### Task 4: Push reprompter branch + open PR

**Files:** none (git/gh operations only).

- [ ] **Step 1: Push**

Run: `git push -u origin feat/relay-delivery-step`

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: deliver-via-headless-relay post-output step (v12.16.0)" --body "$(cat <<'EOF'
Adds a docs-only post-output step: when the headless-relay skill (dorukardahan/headless-relay v1.3.1+) is installed, Single and Reverse lanes end with a one-time offer to deliver the finished prompt to Codex, GLM, Grok, or Gemini headlessly.

Design spec: docs/superpowers/specs/2026-07-09-relay-integration-design.md

Key rules:
- Silent absence: without headless-relay, output is byte-for-byte unchanged. No offer, no install nag.
- Never auto-executes. Claude is not a relay target (native subagent instead).
- Ownership boundary: RePrompter owns prompt quality; headless-relay owns preflight, compliance, CLI mechanics. Zero CLI flags in RePrompter docs (single caveat: Gemini delivers sequentially).
- Both generated packages regenerated. All package tests + checks green.

Credit: relay skill by @dorukardahan.
EOF
)"
```

Note: NO attribution footer (global constraint).

- [ ] **Step 3: Watch CI**

Run: `gh pr checks --watch`
Expected: check + install-smoke green (ubuntu, node 20/22). If red, fix before proceeding.

---

### Task 5: Reference PR to dorukardahan/headless-relay

**Files:**
- Create (in a local clone of that repo, NOT in reprompter): `references/reprompter-relay.md`
- Modify: that repo's `README.md` "What's inside" table.

**Interfaces:**
- Consumes: reprompter SKILL.md heading `## Deliver via headless-relay (post-output step)` (link target), handoff shape `(prompt text, target model, output expectations)`.

- [ ] **Step 1: Check identity and permissions**

```bash
gh auth status
gh api repos/dorukardahan/headless-relay --jq '.permissions'
```

If `push: true` → work on a branch in the origin repo. If not → `gh repo fork dorukardahan/headless-relay --clone` and work in the fork. Do NOT push to that repo's main either way.

- [ ] **Step 2: Clone and branch**

```bash
git clone https://github.com/dorukardahan/headless-relay.git /private/tmp/claude-501/-Users-aytuncyildizli-reprompter/cbe98bc9-0557-4a09-b42c-593b317b28f3/scratchpad/hr-pr
cd /private/tmp/claude-501/-Users-aytuncyildizli-reprompter/cbe98bc9-0557-4a09-b42c-593b317b28f3/scratchpad/hr-pr
git checkout -b docs/reprompter-relay
```

(Adjust the remote to the fork if Step 1 said no push access.)

- [ ] **Step 3: Write `references/reprompter-relay.md`**

```markdown
# Reprompt before you relay

The relay carries whatever prompt you give it. Quality-in determines quality-out:
a vague prompt relayed to Codex, GLM, Grok, or Gemini comes back as a vague answer
from a different model. If the orchestrating agent has a prompt-engineering skill
installed, run it BEFORE relaying a nontrivial task.

## Known integration: RePrompter

[RePrompter](https://github.com/AytuncYildizli/reprompter) (v12.16.0+) integrates
with this skill from the other side. Its Single and Reverse lanes end with a
post-output delivery step: when headless-relay is installed in the same session,
RePrompter offers once to deliver the finished prompt through this skill, then
hands off three things:

1. the finished prompt text,
2. the target model (Codex / GLM / Grok / Gemini — never Claude, per Check 1),
3. output expectations (for example "JSON only").

Everything downstream stays owned by headless-relay: preflight availability, the
provider-terms compliance gate, CLI flags, and output parsing. RePrompter's docs
deliberately contain no CLI mechanics, so the two skills cannot drift apart.
See the "Deliver via headless-relay (post-output step)" section of RePrompter's
SKILL.md.

## When NOT to reprompt first

- Short factual asks ("what does this error mean") — relay directly.
- Consensus runs where the SAME prompt must go to several models — reprompt once,
  then fan out, honoring this skill's parallel rules (Gemini lane stays sequential).
- The user already supplied a structured, complete prompt.

Skill by @dorukardahan. Integration contributed by @AytuncYildizli.
```

- [ ] **Step 4: Add the README table row**

In that repo's `README.md` "What's inside" table, after the `references/anthropic-terms.md` row, add:

```markdown
| `references/reprompter-relay.md` | Pairing recipe: run a prompt-engineering skill (e.g. RePrompter) before relaying |
```

- [ ] **Step 5: Commit, push, open PR**

```bash
git add references/reprompter-relay.md README.md
git commit -m "docs: reprompter pairing recipe (reprompt before you relay)"
git push -u origin docs/reprompter-relay
gh pr create --repo dorukardahan/headless-relay --title "docs: reprompter pairing recipe" --body "Adds references/reprompter-relay.md: run a prompt-engineering skill before relaying; documents the RePrompter v12.16.0 handoff (prompt text, target model, output expectations) and links back. One README table row. No behavior change."
```

Note: B1 English, short sentences, no attribution footer.

---

### Task 6: Fleet rollout to ~/.agents/skills (verify-first)

**Files:** none in-repo; per-machine clones at `~/.agents/skills/reprompter`.

- [ ] **Step 1: Install on this machine (MBP2) first**

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/AytuncYildizli/reprompter ~/.agents/skills/reprompter
```

Expected: clone succeeds; `~/.agents/skills/reprompter/SKILL.md` exists.

- [ ] **Step 2: Verify OpenClaw actually scans ~/.agents/skills**

Claimed by headless-relay's README — verify, don't trust. First try the OpenClaw CLI (`openclaw skills list` or the gateway's skills endpoint via `mcp__openclaw-config__read_config`); if no listing surface exists, send one low-stakes fleet agent (e.g. Ziggy) a message via `mcp__fleet-messenger__fleet_send` asking it to name its available skills, and check for `reprompter`.
Expected: reprompter visible to at least one OpenClaw agent. If NOT visible: stop the rollout, fall back to `~/.openclaw/skills/reprompter` (spec's alternative), and record the finding.

- [ ] **Step 3: Functional smoke on one fleet agent**

Via `mcp__fleet-messenger__fleet_send`, ask the same agent: "Use the reprompter skill in Single mode on this rough prompt: 'add caching to the api somehow and make it faster etc'. Return the structured prompt and the before/after score."
Expected: a structured XML/Markdown prompt + score comes back. This confirms load + execution, not just listing.

- [ ] **Step 4: Roll out to the remaining machines**

Over Tailscale ssh (use the existing host aliases for Mac Studio and dadflix-mac-mini from the agentcookie setup):

```bash
ssh <mac-studio> 'mkdir -p ~/.agents/skills && git clone https://github.com/AytuncYildizli/reprompter ~/.agents/skills/reprompter'
ssh <dadflix-mac-mini> 'mkdir -p ~/.agents/skills && git clone https://github.com/AytuncYildizli/reprompter ~/.agents/skills/reprompter'
```

Repeat Step 2's verification on each machine (one agent per machine).
Note: clones are `main`; after the v12.16.0 PR merges, `git pull` on each machine (or wait — `scripts/version-check.js` will nag copy-based installs when the release is cut).

- [ ] **Step 5: Manual fresh-session smokes for the delivery step (Claude Code, this machine)**

These need a NEW Claude Code session (skill cache loads at session start):

1. With headless-relay installed (it is, v1.3.1): run a Single-mode reprompt → after the prompt artifact, the one-time delivery offer must appear listing Codex / GLM / Grok / Gemini (not Claude). Accept once targeting Codex → prompt relays via headless-relay and the answer is reported.
2. Silent-absence check: `mv ~/.claude/skills/headless-relay /tmp/hr-parked`, new session, Single-mode reprompt → output mentions NOTHING about delivery or headless-relay. Then `mv /tmp/hr-parked ~/.claude/skills/headless-relay`.

Expected: both behaviors match the spec's hard rules. Record results in `.remember/`.
