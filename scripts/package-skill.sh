#!/bin/bash
# Package reprompter skill for Claude.ai upload
# Excludes repo-level files per Anthropic's Skills Guide:
# "Don't include README.md inside your skill folder"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
OUT="$REPO_DIR/reprompter-skill.zip"

cd "$REPO_DIR"

rm -f "$OUT"

zip -r "$OUT" . \
  -x ".git/*" \
  -x ".github/*" \
  -x "README.md" \
  -x "CONTRIBUTING.md" \
  -x "CHANGELOG.md" \
  -x "TESTING.md" \
  -x "LICENSE" \
  -x ".gitignore" \
  -x "assets/demo.*" \
  -x "assets/social-preview.*" \
  -x "scripts/create-past-releases.sh" \
  -x "scripts/package-skill.sh" \
  -x "reprompter-skill.zip"

echo "✅ Packaged to: $OUT"
echo "Contents:"
unzip -l "$OUT" | tail -n +4 | head -n -2
