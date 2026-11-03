#!/usr/bin/env bash
# Refresh every grokbot-plugin file under references/ or scripts/ that is a
# verbatim copy of a root file. "Verbatim" is judged at the last commit that
# touched grokbot-plugin/, when CI last held the split in sync; a copy that
# differed from root there is an intentional split edit and is only reported.
# usage: bash grokbot-plugin/sync-copies.sh [--apply]
set -euo pipefail
apply="${1:-}"
cd "$(git rev-parse --show-toplevel)"
base="$(git log -1 --format=%H -- grokbot-plugin)"
updated=0 same=0 diverged=0 gone=0
while IFS= read -r copy; do
  rel="${copy#grokbot-plugin/skills/*/}"
  case "$rel" in references/*|scripts/*) ;; *) continue ;; esac
  if ! git cat-file -e "$base:$rel" 2>/dev/null; then diverged=$((diverged+1)); continue; fi
  if ! git show "$base:$rel" | cmp -s - "$copy"; then echo "DIVERGED $copy"; diverged=$((diverged+1)); continue; fi
  if [ ! -e "$rel" ]; then echo "ROOT-GONE $copy (root $rel was removed or renamed)"; gone=$((gone+1)); continue; fi
  if cmp -s "$rel" "$copy"; then same=$((same+1)); continue; fi
  echo "STALE $copy <- $rel"; updated=$((updated+1))
  if [ "$apply" = "--apply" ]; then cp "$rel" "$copy"; fi
done < <(git ls-files 'grokbot-plugin/skills/*/references/*' 'grokbot-plugin/skills/*/scripts/*')
echo "SUMMARY stale=$updated current=$same diverged_or_split_only=$diverged root_gone=$gone"
