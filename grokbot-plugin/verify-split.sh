#!/usr/bin/env bash
# verify-split.sh — check that grokbot-plugin/skills is a lossless split of the root SKILL.md.
#
#   1. Coverage: every non-blank line of the root SKILL.md (frontmatter included;
#      skills/reprompter/references/original-frontmatter.md holds it verbatim) must
#      appear, as an exact whole line, in some file under grokbot-plugin/skills/.
#   1b. Staleness: grokbot-plugin/SPLIT-BASE holds the git blob id of the root
#      SKILL.md the split was last synced against (a blob id survives squash
#      merges; a commit SHA does not). Every non-blank line under skills/ that was a
#      line of that base blob and is no longer a line of the current root SKILL.md
#      is reported STALE. Files that are byte copies of the root file at the same
#      path (references/..., scripts/...) are skipped: they carry that file's text,
#      not SKILL.md's. When the blob is not in the object store (shallow clone),
#      the check is skipped with a note. After a sync, set SPLIT-BASE to
#      `git rev-parse HEAD:SKILL.md`.
#   2. Links: every relative markdown link `[text](target)` in grokbot-plugin/**/*.md
#      must resolve to an existing file or directory.
#   3. Path refs: every backticked `references/...` or `../...` path in
#      grokbot-plugin/skills/**/*.md must exist (relative to the file's directory or
#      its skill root). Paths containing placeholders ({...}, *, <...>, ...) are skipped.
#   4. Scripts: every `scripts/<file>.(js|sh|json)` mentioned in grokbot-plugin/skills/**/*.md
#      must be bundled in skills/reprompter/scripts/ (mode skills resolve `scripts/<name>`
#      to `../reprompter/scripts/<name>`); every local `require("./x")` in the bundled
#      scripts must resolve; and, when node is on PATH, every bundled .js must pass
#      `node --check` and `workflow-command.js --help` must exit 0.
#
# Usage: bash grokbot-plugin/verify-split.sh [path/to/root/SKILL.md]
# Exit status: 0 when missing=0, stale=0 (or skipped), broken_links=0, broken_refs=0 and
# broken_scripts=0; 1 otherwise.
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_SKILL="${1:-$PLUGIN_DIR/../SKILL.md}"
REPO_ROOT="$(cd "$(dirname "$ROOT_SKILL")" && pwd)"
SKILLS_DIR="$PLUGIN_DIR/skills"
SPLIT_BASE_FILE="$PLUGIN_DIR/SPLIT-BASE"

[ -f "$ROOT_SKILL" ] || { echo "root SKILL.md not found: $ROOT_SKILL" >&2; exit 2; }
[ -d "$SKILLS_DIR" ] || { echo "skills dir not found: $SKILLS_DIR" >&2; exit 2; }
split_base="$(tr -d '[:space:]' < "$SPLIT_BASE_FILE" 2>/dev/null || true)"
[ -n "$split_base" ] || { echo "SPLIT-BASE missing or empty: $SPLIT_BASE_FILE" >&2; exit 2; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# --- 1. Line coverage -------------------------------------------------------
# Non-blank root lines, keeping original line numbers so misses can be located.
awk '{ printf "%d\t%s\n", NR, $0 }' "$ROOT_SKILL" \
  | grep -v $'^[0-9]*\t[[:space:]]*$' > "$tmp/body.tsv" || true

find "$SKILLS_DIR" -type f -name '*.md' -print0 | xargs -0 cat | sort -u > "$tmp/split-lines.txt"

total=$(wc -l < "$tmp/body.tsv" | tr -d ' ')
: > "$tmp/missing.tsv"
# grep -Fxv -f prints body lines that are not exactly any line of the split files.
cut -f2- "$tmp/body.tsv" > "$tmp/body.txt"
grep -nFxv -f "$tmp/split-lines.txt" "$tmp/body.txt" > "$tmp/miss-idx.txt" || true
while IFS= read -r hit; do
  idx="${hit%%:*}"
  sed -n "${idx}p" "$tmp/body.tsv" >> "$tmp/missing.tsv"
done < "$tmp/miss-idx.txt"
missing=$(wc -l < "$tmp/missing.tsv" | tr -d ' ')

echo "== Line coverage =="
echo "root non-blank lines: $total"
echo "missing: $missing"
if [ "$missing" -gt 0 ]; then
  echo "first missing lines (root line number<TAB>text):"
  head -n 40 "$tmp/missing.tsv" | cut -c1-160
fi

# --- 1b. Stale lines --------------------------------------------------------
echo
echo "== Stale lines (deleted from root since SPLIT-BASE) =="
echo "split base: $split_base"
if git -C "$PLUGIN_DIR" cat-file -e "$split_base" 2>/dev/null; then
  git -C "$PLUGIN_DIR" cat-file -p "$split_base" | grep -v '^[[:space:]]*$' | sort -u > "$tmp/base-lines.txt" || true
  sort -u "$tmp/body.txt" > "$tmp/root-lines.txt"
  comm -23 "$tmp/base-lines.txt" "$tmp/root-lines.txt" > "$tmp/deleted.txt"
  echo "lines deleted from root since base: $(wc -l < "$tmp/deleted.txt" | tr -d ' ')"
  : > "$tmp/stale-scan.lst"
  while IFS= read -r -d '' f; do
    rel="${f#"$SKILLS_DIR"/}"
    mirror="$REPO_ROOT/${rel#*/}"
    [ -f "$mirror" ] && cmp -s "$f" "$mirror" && continue
    printf '%s\0' "$rel" >> "$tmp/stale-scan.lst"
  done < <(find "$SKILLS_DIR" -type f -name '*.md' -print0)
  (cd "$SKILLS_DIR" && xargs -0 grep -nFx -f "$tmp/deleted.txt" /dev/null < "$tmp/stale-scan.lst") > "$tmp/stale.txt" || true
  stale=$(wc -l < "$tmp/stale.txt" | tr -d ' ')
  echo "stale: $stale"
  if [ "$stale" -gt 0 ]; then
    echo "stale lines (skills/<file>:<line>:<text>):"
    head -n 60 "$tmp/stale.txt" | cut -c1-160 | sed 's/^/STALE: /'
  fi
else
  stale=skipped
  echo "stale: skipped (blob $split_base not in this clone; fetch full history to run it)"
fi

# --- 2. Relative markdown links --------------------------------------------
broken_links=0
checked_links=0
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  # Extract `](target)` occurrences; drop titles after a space.
  while IFS= read -r target; do
    target="${target%% *}"
    case "$target" in
      ''|'#'*|http://*|https://*|mailto:*) continue ;;
    esac
    path="${target%%#*}"
    [ -n "$path" ] || continue
    checked_links=$((checked_links + 1))
    if [ ! -e "$dir/$path" ]; then
      echo "BROKEN LINK: ${f#"$PLUGIN_DIR"/}: ($target)"
      broken_links=$((broken_links + 1))
    fi
  done < <(grep -o '](\([^)]*\))' "$f" | sed 's/^](//; s/)$//' || true)
done < <(find "$PLUGIN_DIR" -type f -name '*.md' -print0)

echo
echo "== Relative markdown links =="
echo "checked: $checked_links"
echo "broken links: $broken_links"

# --- 3. Backticked path references ----------------------------------------
broken_refs=0
checked_refs=0
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  rel="${f#"$SKILLS_DIR"/}"
  skill_root="$SKILLS_DIR/${rel%%/*}"
  while IFS= read -r ref; do
    case "$ref" in
      *'{'*|*'*'*|*'<'*|*'...'*) continue ;;
    esac
    checked_refs=$((checked_refs + 1))
    if [ ! -e "$dir/$ref" ] && [ ! -e "$skill_root/$ref" ]; then
      echo "BROKEN REF: $rel: \`$ref\`"
      broken_refs=$((broken_refs + 1))
    fi
  done < <(grep -o '`\(references/\|\.\./\)[^` ]*`' "$f" | tr -d '`' | sort -u || true)
done < <(find "$SKILLS_DIR" -type f -name '*.md' -print0)

echo
echo "== Backticked path refs =="
echo "checked: $checked_refs"
echo "broken refs: $broken_refs"

# --- 4. Bundled scripts ----------------------------------------------------
SCRIPTS_DIR="$SKILLS_DIR/reprompter/scripts"
broken_scripts=0
checked_scripts=0
while IFS= read -r -d '' f; do
  rel="${f#"$SKILLS_DIR"/}"
  while IFS= read -r name; do
    checked_scripts=$((checked_scripts + 1))
    if [ ! -f "$SCRIPTS_DIR/$name" ]; then
      echo "MISSING SCRIPT: $rel: scripts/$name"
      broken_scripts=$((broken_scripts + 1))
    fi
  done < <(grep -o 'scripts/[A-Za-z0-9_.-]*\.\(js\|sh\|json\)' "$f" | sed 's|^scripts/||' | sort -u || true)
done < <(find "$SKILLS_DIR" -type f -name '*.md' -print0)

checked_requires=0
if [ -d "$SCRIPTS_DIR" ]; then
  for js in "$SCRIPTS_DIR"/*.js; do
    [ -e "$js" ] || continue
    while IFS= read -r dep; do
      checked_requires=$((checked_requires + 1))
      base="$SCRIPTS_DIR/${dep#./}"
      if [ ! -f "$base" ] && [ ! -f "$base.js" ] && [ ! -f "$base.json" ]; then
        echo "MISSING MODULE: scripts/$(basename "$js"): require(\"$dep\")"
        broken_scripts=$((broken_scripts + 1))
      fi
    # Skip `//` and JSDoc `*` comment lines: usage examples there are
    # repo-root-relative (`require('./scripts/x.js')`), not real requires.
    done < <(grep -Ev '^[[:space:]]*(//|/?\*)' "$js" | grep -o "require([\"']\./[^\"']*[\"'])" | sed "s/^require([\"']//; s/[\"'])\$//" | sort -u || true)
  done
else
  echo "MISSING DIR: skills/reprompter/scripts"
  broken_scripts=$((broken_scripts + 1))
fi

node_status="skipped (node not on PATH)"
if command -v node >/dev/null 2>&1 && [ -d "$SCRIPTS_DIR" ]; then
  for js in "$SCRIPTS_DIR"/*.js; do
    [ -e "$js" ] || continue
    if ! node --check "$js" 2>"$tmp/node.err"; then
      echo "SYNTAX ERROR: scripts/$(basename "$js")"; head -n 5 "$tmp/node.err"
      broken_scripts=$((broken_scripts + 1))
    fi
  done
  # Loads the compiler and its whole require graph from outside the repo.
  if (cd "$tmp" && node "$SCRIPTS_DIR/workflow-command.js" --help >/dev/null 2>"$tmp/node.err"); then
    node_status="ok (node --check all, workflow-command.js --help exit 0)"
  else
    node_status="FAILED (workflow-command.js --help)"; head -n 10 "$tmp/node.err"
    broken_scripts=$((broken_scripts + 1))
  fi
fi

echo
echo "== Bundled scripts =="
echo "script refs checked: $checked_scripts"
echo "local requires checked: $checked_requires"
echo "node smoke: $node_status"
echo "broken scripts: $broken_scripts"

echo
echo "SUMMARY: missing=$missing stale=$stale broken_links=$broken_links broken_refs=$broken_refs broken_scripts=$broken_scripts"
if [ "$missing" != 0 ] || { [ "$stale" != skipped ] && [ "$stale" != 0 ]; }; then
  echo "To re-sync: put each MISSING root line in the mode skill SPLIT-MAP.md names, update or remove each STALE line, run bash grokbot-plugin/sync-copies.sh --apply, then git hash-object SKILL.md > grokbot-plugin/SPLIT-BASE and rerun this check."
fi
[ "$missing" -eq 0 ] && { [ "$stale" = skipped ] || [ "$stale" -eq 0 ]; } && [ "$broken_links" -eq 0 ] && [ "$broken_refs" -eq 0 ] && [ "$broken_scripts" -eq 0 ]
