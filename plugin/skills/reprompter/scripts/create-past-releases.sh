#!/usr/bin/env bash
# Create GitHub Releases for all versions in CHANGELOG.md
# Run once after merging. Requires: gh CLI with repo write access.
# Usage: ./scripts/create-past-releases.sh [--dry-run]
#
# NOTE: Tags must already exist pointing to the correct commits.
# This script will NOT create tags — it only creates GitHub Releases.
# Create tags manually first:
#   git tag v5.0.0 <commit-hash>
#   git tag v6.0.0 <commit-hash>
#   git push origin --tags

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

CHANGELOG="CHANGELOG.md"
VERSIONS=$(grep -E -o '^## v[0-9]+\.[0-9]+\.[0-9]+' "$CHANGELOG" | sed 's/^## v//')
FIRST_VERSION=$(echo "$VERSIONS" | head -n 1)

for VERSION in $VERSIONS; do
  TAG="v${VERSION}"

  # Safety: skip if tag doesn't exist (don't create tags on HEAD)
  if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "⚠️  Tag $TAG not found — skipping (create it manually on the correct commit first)"
    continue
  fi

  # Extract notes using awk with -v to avoid escaping issues
  NOTES_FILE=$(mktemp)
  awk -v ver="$VERSION" '
    $0 ~ "^## v" ver { found=1; next }
    /^## v[0-9]/ { if(found) exit }
    found { print }
  ' "$CHANGELOG" > "$NOTES_FILE"

  if [ ! -s "$NOTES_FILE" ]; then
    echo "Release ${TAG}" > "$NOTES_FILE"
  fi

  FLAGS=""
  [ "$VERSION" = "$FIRST_VERSION" ] && FLAGS="--latest"

  if $DRY_RUN; then
    echo "=== $TAG $FLAGS ==="
    head -n 3 "$NOTES_FILE"
    echo "---"
  else
    echo "Creating release $TAG..."
    gh release create "$TAG" --title "$TAG" --notes-file "$NOTES_FILE" $FLAGS 2>&1 || echo "  ⚠️  Skipped (may already exist)"
  fi

  rm -f "$NOTES_FILE"
done
echo "Done!"
