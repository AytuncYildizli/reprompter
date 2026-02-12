#!/usr/bin/env bash
# Create GitHub Releases for all versions in CHANGELOG.md
# Run once after merging. Requires: gh CLI with repo write access.
# Usage: ./scripts/create-past-releases.sh [--dry-run]

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

CHANGELOG="CHANGELOG.md"
VERSIONS=$(grep -oP '^## v\K[0-9]+\.[0-9]+\.[0-9]+' "$CHANGELOG")
FIRST_VERSION=$(echo "$VERSIONS" | head -1)

for VERSION in $VERSIONS; do
  TAG="v${VERSION}"
  NOTES=$(awk "/^## v${VERSION//./\\.}/{found=1; next} /^## v[0-9]/{if(found) exit} found{print}" "$CHANGELOG")
  [ -z "$NOTES" ] && NOTES="Release ${TAG}"

  FLAGS=""
  [ "$VERSION" = "$FIRST_VERSION" ] && FLAGS="--latest"

  if $DRY_RUN; then
    echo "=== $TAG $FLAGS ==="
    echo "$NOTES" | head -3
    echo "---"
  else
    echo "Creating $TAG..."
    git tag "$TAG" 2>/dev/null || true
    git push origin "$TAG" 2>/dev/null || true
    gh release create "$TAG" --title "$TAG" --notes "$NOTES" $FLAGS 2>&1 || echo "  ⚠️  Skipped"
  fi
done
echo "Done!"
