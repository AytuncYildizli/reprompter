#!/usr/bin/env bash
# Refresh every grokbot-plugin copy under references/ or scripts/ from its root
# file, except the intentional edits listed in grokbot-plugin/DIVERGED-COPIES.
# Copies with no root counterpart are split-only files and are left alone.
# usage: bash grokbot-plugin/sync-copies.sh [--apply]
set -euo pipefail
apply="${1:-}"
cd "$(git rev-parse --show-toplevel)"
diverged_list="$(grep -vE '^\s*(#|$)' grokbot-plugin/DIVERGED-COPIES || true)"
stale=0 current=0 diverged=0 split_only=0
while IFS= read -r copy; do
  inner="${copy#grokbot-plugin/skills/}"
  rel="${inner#*/}"
  case "$rel" in references/*|scripts/*) ;; *) continue ;; esac
  if [ ! -e "$rel" ]; then echo "SPLIT-ONLY $copy (no root $rel)"; split_only=$((split_only+1)); continue; fi
  if printf '%s\n' "$diverged_list" | grep -qxF "$inner"; then echo "DIVERGED $copy (listed in DIVERGED-COPIES)"; diverged=$((diverged+1)); continue; fi
  if cmp -s "$rel" "$copy"; then current=$((current+1)); continue; fi
  echo "STALE $copy <- $rel"; stale=$((stale+1))
  if [ "$apply" = "--apply" ]; then cp "$rel" "$copy"; fi
done < <(git ls-files 'grokbot-plugin/skills/*/references/*' 'grokbot-plugin/skills/*/scripts/*')
echo "SUMMARY stale=$stale current=$current diverged=$diverged split_only=$split_only"
