#!/usr/bin/env bash
set -euo pipefail

REQUIRED_TAGS=(
  role
  context
  task
  motivation
  requirements
  constraints
  output_format
  success_criteria
)

TEMPLATE_DIR="references"
# Files in references/ that are NOT prompt templates and should be skipped
# by this validator. Keep alphabetical.
EXCEPTION_TEMPLATES=(
  "outcome-schema.md"    # schema spec for flywheel outcome capture, not a prompt template
  "team-brief-template.md"  # Markdown-only by design
)

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "ERROR: Template directory not found: $TEMPLATE_DIR"
  exit 1
fi

echo "Validating templates in $TEMPLATE_DIR"
echo "Required tags: ${REQUIRED_TAGS[*]}"
echo "Skipping non-template exceptions: ${EXCEPTION_TEMPLATES[*]}"
echo

is_exception() {
  local name="$1"
  for except in "${EXCEPTION_TEMPLATES[@]}"; do
    if [[ "$name" == "$except" ]]; then
      return 0
    fi
  done
  return 1
}

shopt -s nullglob
templates=("$TEMPLATE_DIR"/*.md)
shopt -u nullglob

if [[ ${#templates[@]} -eq 0 ]]; then
  echo "ERROR: No templates found in $TEMPLATE_DIR"
  exit 1
fi

checked=0
passed=0
failed=0

for template in "${templates[@]}"; do
  name="$(basename "$template")"

  if is_exception "$name"; then
    echo "SKIP  $name (exception)"
    continue
  fi

  ((checked+=1))
  missing=()

  for tag in "${REQUIRED_TAGS[@]}"; do
    if ! grep -qi "<${tag}>" "$template"; then
      missing+=("$tag")
    fi
  done

  if [[ ${#missing[@]} -eq 0 ]]; then
    echo "PASS  $name"
    ((passed+=1))
  else
    echo "FAIL  $name"
    echo "      Missing tags: ${missing[*]}"
    ((failed+=1))
  fi
done

echo
skipped=${#EXCEPTION_TEMPLATES[@]}
if [[ "$failed" -eq 0 ]]; then
  echo "All $passed templates passed validation (checked: $checked, skipped: $skipped)."
  exit 0
else
  echo "$failed template(s) failed validation (checked: $checked, passed: $passed, skipped: $skipped)."
  exit 1
fi
