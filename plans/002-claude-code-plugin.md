# Plan 002: Ship RePrompter as a Claude Code plugin — one install command, skill + ambient gate hook auto-registered (v12.9.0)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do NOT run any `git` commands — the reviewer handles all git operations.
> Do NOT update `plans/README.md` — the reviewer maintains the index.
>
> **Drift check (run first)**: confirm `scripts/prompt-gate.js` exists and
> `grep -c "12.8.0" package.json` returns 1. If either fails, STOP (this plan
> stacks on the ambient-prompt-gate branch).

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (new distribution surface; mitigated by generated-artifact pattern + structural tests)
- **Depends on**: plans/001-ambient-prompt-gate.md (DONE — branch feat/ambient-prompt-gate)
- **Category**: direction
- **Planned at**: commit `a51bd93`, 2026-07-02

## Why this matters

Today Claude Code users install RePrompter via `curl | tar` and must hand-edit `~/.claude/settings.json` to enable the ambient prompt gate hook — two manual steps, no update mechanism beyond a custom version-check script. Claude Code plugins fix all three at once: a plugin ships `skills/` and `hooks/hooks.json` that **auto-register when the user installs the plugin** (install = consent), paths resolve via `${CLAUDE_PLUGIN_ROOT}` (no absolute-path editing), and `plugin.json` version drives native update detection. The repo itself doubles as the marketplace. The plugin is a **generated artifact** (same pattern as the Hermes package in `skills/reprompter/`): root `SKILL.md` stays canonical, other runtimes (Codex, OpenClaw, Grok, Hermes) keep their existing install paths untouched.

## Current state

- `scripts/prompt-gate.js` — the ambient gate hook (fail-soft, exit 0 always). The plugin's `hooks.json` will point at the plugin's copy of it.
- `scripts/package-hermes-skill.sh` + `scripts/package-hermes-skill.js` — the existing generated-artifact pattern: build `skills/reprompter/` from root sources. Read both before writing the plugin generator; MATCH this pattern (bash wrapper + node logic, deterministic output, a `check:` script that regenerates and `git diff --exit-code`s the result).
- `scripts/check-hermes-package.sh` — the committed-vs-regenerated guard to mirror:

  ```bash
  "$SCRIPT_DIR/package-hermes-skill.sh"
  if ! git -C "$REPO_DIR" diff --exit-code -- skills/reprompter; then
    echo "ERROR: Generated Hermes package differs from committed files." >&2
    exit 1
  fi
  ```

- `scripts/hermes-package.test.js` — structural test exemplar for a generated package (`node:test`, asserts manifest/files consistency). Model the new plugin-package test on it.
- `scripts/version-check.js` — reads local version from `SKILL.md` frontmatter at `path.join(__dirname, "..", "SKILL.md")`; prints a `curl | tar` upgrade command when behind. In a plugin install that command is wrong (plugins update natively) — Step 4 adds plugin detection.
- `.gitattributes` — export-ignore list (one path per line, `/skills export-ignore` style). Source archives are runtime-only; plugin installs use **git clone** (marketplace add clones the repo), so export-ignoring the plugin tree does not break plugin installs.
- `package.json` — version `12.8.0`; `check` chain runs every `test:*` + `check:` script. `SKILL.md` frontmatter `metadata.version: 12.8.0`, title `# RePrompter v12.8.0`.
- Repo already has a `skills/` dir (the HERMES package — do not confuse it with the plugin's `skills/` dir; they are unrelated).

### Claude Code plugin facts (verified against official docs 2026-07-02 — treat as authoritative)

1. **Layout**: `.claude-plugin/plugin.json` is the ONLY thing inside `.claude-plugin/`. All components live at the plugin ROOT: `skills/`, `hooks/`, etc. Putting `skills/` inside `.claude-plugin/` is a documented common mistake.
2. **plugin.json**: required `name` (becomes the skill namespace, e.g. `/reprompter:reprompter`), `description`; optional `version` (drives update detection — SET IT, sync with package.json), `author`.
3. **Skills in plugins**: `skills/<name>/SKILL.md` with optional `references/`(reference files) and `scripts/` — identical format and loading to a personal skill. So the plugin's skill dir can be an EXACT mirror of a normal RePrompter install.
4. **Hooks in plugins**: `hooks/hooks.json` at plugin root, same JSON shape as the `hooks` object in `settings.json`. Auto-registers on plugin install/enable. `UserPromptSubmit` is supported. Reference scripts via `${CLAUDE_PLUGIN_ROOT}/...` — relative paths do NOT work. `disableAllHooks: true` still disables plugin hooks. There is no per-hook disable UI (all-or-nothing with the plugin) — the gate's `REPROMPTER_AMBIENT=0` env kill switch is the granular off.
5. **Marketplace**: `.claude-plugin/marketplace.json` at REPO root; entries have `name`, `description`, `source` (subdirectory path), `version`. User flow: `/plugin marketplace add AytuncYildizli/reprompter` then `/plugin install reprompter@reprompter`.
6. **Shadowing**: a personal `~/.claude/skills/reprompter` overrides/duplicates the plugin skill — docs must tell migrating users to remove the personal copy.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Full gate | `npm run check` | exit 0 |
| New generator | `npm run package:plugin` (you create) | exit 0, deterministic output |
| New guard | `npm run check:plugin-package` (you create) | exit 0 after regeneration is committed; before commit it fails on git diff — expected, report, don't fix |
| New tests | `npm run test:plugin-package` (you create) | exit 0 |
| Manifest sanity (optional) | `claude plugin validate plugin/` if the subcommand exists (`claude --help | grep -i plugin`) | if unavailable, skip — structural tests cover it |

## Scope

**In scope** (only these):

- `.claude-plugin/marketplace.json` (create — repo root)
- `plugin/**` (create — generated ONLY via the new generator, never by hand)
- `scripts/package-plugin.sh` + `scripts/package-plugin.js` (create)
- `scripts/check-plugin-package.sh` (create)
- `scripts/plugin-package.test.js` (create)
- `scripts/version-check.js` (plugin-context detection only)
- `.gitattributes` (add `/plugin` and `/.claude-plugin` export-ignore)
- `package.json`, `package-lock.json` (new scripts, check chain, version 12.9.0)
- `SKILL.md`, `README.md`, `CHANGELOG.md` (docs + version 12.9.0)
- `skills/reprompter/**` (ONLY via `npm run package:hermes` after SKILL.md edits)

**Out of scope** (do NOT touch):

- `scripts/prompt-gate.js` and its test — the gate is done; the plugin only packages it.
- Hermes packaging scripts, `references/**`, `benchmarks/**`, `docs/**`, `plans/**`.
- Any auto-edit of `~/.claude/settings.json` — the whole point is that plugins make that unnecessary.

## Git workflow

None. Reviewer handles branch/commit/push/PR.

## Steps

### Step 1: Plugin generator — `scripts/package-plugin.sh` + `scripts/package-plugin.js`

Generate `plugin/` from root sources, deterministic (stable file order, no timestamps):

```
plugin/
  .claude-plugin/plugin.json      # {"name":"reprompter","description":<from package.json>,"version":<from package.json>,"author":"AytuncYildizli"}
  hooks/hooks.json                # UserPromptSubmit -> node "${CLAUDE_PLUGIN_ROOT}/skills/reprompter/scripts/prompt-gate.js"
  skills/reprompter/
    SKILL.md                      # byte-identical copy of root SKILL.md
    references/**                 # copy of root references/
    scripts/**                    # copy of root scripts/ EXCLUDING *.test.js and packaging scripts (package-*.sh/js, check-*.sh)
```

`hooks/hooks.json` exact content:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/skills/reprompter/scripts/prompt-gate.js\"" } ] }
    ]
  }
}
```

`plugin.json` `version` and `description` are READ from `package.json` at generation time (single source of truth — never hardcode). Follow `package-hermes-skill.{sh,js}` structure/style. Add npm scripts `package:plugin` and wire nothing else yet.

**Verify**: `npm run package:plugin` → exit 0; `node -e "console.log(JSON.parse(require('fs').readFileSync('plugin/.claude-plugin/plugin.json','utf8')).version)"` prints the package.json version; running the generator twice produces zero diff (`npm run package:plugin && git status --porcelain plugin/ | wc -l` stable).

### Step 2: Marketplace manifest — `.claude-plugin/marketplace.json` (repo root)

```json
{
  "name": "reprompter",
  "owner": { "name": "AytuncYildizli" },
  "plugins": [
    { "name": "reprompter", "source": "./plugin", "description": <same as plugin.json>, "version": <same as plugin.json> }
  ]
}
```

If the docs-verified shape in "Current state" conflicts with what a local `claude plugin validate` accepts, prefer what validates; if no validator is available, use the shape above. The marketplace.json `version` must be updated by the GENERATOR too (it rewrites both manifests from package.json), so they can never drift.

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'))"` → exit 0; version field matches package.json.

### Step 3: Guard + tests

1. `scripts/check-plugin-package.sh` — mirror `check-hermes-package.sh`: regenerate, then `git diff --exit-code -- plugin .claude-plugin/marketplace.json` + untracked check. npm script `check:plugin-package`.
2. `scripts/plugin-package.test.js` (npm script `test:plugin-package`, model on `hermes-package.test.js`), asserting at minimum:
   - `plugin/.claude-plugin/plugin.json` parses; `name === "reprompter"`; version === package.json version; marketplace.json version matches too.
   - `plugin/hooks/hooks.json` parses; the command string contains `${CLAUDE_PLUGIN_ROOT}` and references a file that EXISTS in the generated tree (resolve the path with CLAUDE_PLUGIN_ROOT replaced by the plugin dir).
   - `plugin/skills/reprompter/SKILL.md` is byte-identical to root `SKILL.md`.
   - No `*.test.js` and no `package-*.{sh,js}` files inside `plugin/`.
   - The hook script actually runs from the generated location: spawn `node plugin/skills/reprompter/scripts/prompt-gate.js` with a low-quality JSON payload and a temp `XDG_CACHE_HOME` → stdout contains `<reprompter-ambient-gate>`; with `REPROMPTER_AMBIENT=0` → empty. (This catches a missing telemetry-store/schema dependency in the copied scripts.)
3. Add `test:plugin-package` and `check:plugin-package` into the `check` chain (after the hermes equivalents).

**Verify**: `npm run test:plugin-package` → exit 0.

### Step 4: version-check plugin awareness

In `scripts/version-check.js`: when the script is running from inside a plugin install, the printed `curl | tar` upgrade command is wrong (plugins update via `/plugin marketplace update`). Detection: from `SKILL_ROOT` (the skill dir), check `fs.existsSync(path.join(SKILL_ROOT, "..", "..", ".claude-plugin", "plugin.json"))` — in the plugin layout the skill dir is `<pluginRoot>/skills/reprompter`, so the plugin manifest sits exactly two levels up. When detected: stay silent (exit 0, no notice) — the plugin's native update mechanism owns freshness. Add one test to `scripts/version-check.test.js` covering the plugin-layout no-op (create the layout in a temp dir; follow the existing injectable-test patterns in that file).

**Verify**: `npm run test:version-check` → exit 0 including the new test.

### Step 5: Docs + version bump + regeneration

1. Version → `12.9.0` in `package.json`, `package-lock.json` (BOTH spots), `SKILL.md` frontmatter + title + header blurb clause.
2. `README.md`: make plugin install the FIRST/recommended Claude Code path:

   ```
   /plugin marketplace add AytuncYildizli/reprompter
   /plugin install reprompter@reprompter
   ```

   One install → skill + ambient gate hook active, native updates. Keep the `curl | tar` section as the fallback and for non-plugin setups. Add a migration note: users with `~/.claude/skills/reprompter` must remove it or it shadows the plugin skill. Note the gate ships enabled with the plugin; `REPROMPTER_AMBIENT=0` is the per-feature off switch; `disableAllHooks` still wins. Update the version badge and, if test counts changed, the Testing table (use REAL counts from `npm run check`).
3. `SKILL.md`: in the Ambient Prompt Gate section, add the plugin path as the recommended install (hook auto-registers; manual settings.json snippet remains for copy-based installs).
4. `CHANGELOG.md`: v12.9.0 entry (plugin distribution + marketplace + version-check plugin awareness; Claude Code-only, additive; other runtimes unchanged).
5. `.gitattributes`: add `/plugin export-ignore` and `/.claude-plugin export-ignore` (keeps tarball installs runtime-only; git-clone-based plugin installs unaffected).
6. Regenerate BOTH artifacts: `npm run package:plugin` then `npm run package:hermes` (SKILL.md changed).

**Verify**: `grep -c "12.9.0" package.json` → 1; `grep -c '"version": "12.9.0"' package-lock.json` → 2; `npm run check` → exit 0.

## Test plan

Step 3's `plugin-package.test.js` (≥7 structural + 2 behavioral) and Step 4's version-check addition. Patterns: `hermes-package.test.js`, `version-check.test.js`. Final gate: `npm run check`.

## Done criteria

- [ ] `npm run check` exits 0 (includes new plugin suites).
- [ ] `npm run package:plugin` is deterministic (second run → zero diff).
- [ ] `plugin/skills/reprompter/SKILL.md` byte-identical to root `SKILL.md` (`cmp` exits 0).
- [ ] `echo '{"session_id":"p1","prompt":"uhh build a crypto dashboard, maybe coingecko data, add caching, test it too"}' | XDG_CACHE_HOME=$(mktemp -d) node plugin/skills/reprompter/scripts/prompt-gate.js` prints an advisory, exit 0.
- [ ] `plugin/hooks/hooks.json` command resolves to an existing file when `${CLAUDE_PLUGIN_ROOT}` → `plugin/`.
- [ ] plugin.json, marketplace.json, package.json, package-lock.json (×2), SKILL.md all agree on `12.9.0`.
- [ ] `git archive` of the tree contains no `plugin/` or `.claude-plugin/` entries (run after reviewer commits; executor: just confirm .gitattributes lines exist).
- [ ] No `*.test.js` inside `plugin/`.

## STOP conditions

- `scripts/prompt-gate.js` missing or package.json version ≠ 12.8.0 at start (wrong base branch).
- The copied gate script fails to run from `plugin/skills/reprompter/scripts/` (missing dependency you cannot resolve by copying more root scripts/ files).
- `claude plugin validate` exists AND rejects a manifest shape you cannot fix within the documented fields.
- `npm run check` fails in a suite you did not touch.
- Any step seems to require editing `~/.claude/settings.json` or files outside scope.

## Maintenance notes

- **Three-manifest version sync** (package.json → plugin.json + marketplace.json) is generator-enforced; the test asserts it. If a release ever bumps package.json without regenerating, `check:plugin-package` fails CI — that is the guard working.
- **Reviewer scrutiny**: hooks.json quoting of `${CLAUDE_PLUGIN_ROOT}` (spaces in paths); that the plugin scripts/ copy excludes tests/packaging; the README migration note.
- **Deferred**: marketplace listing polish (screenshots, categories); auto-update recommendation docs; potential `commands/` entry for an explicit `/reprompter:reprompt` slash command; Codex/Hermes hook equivalents (unchanged from plan 001).
