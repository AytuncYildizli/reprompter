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

TEMPLATE_DIR="docs/references"
EXCEPTION_TEMPLATE="team-brief-template.md"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "ERROR: Template directory not found: $TEMPLATE_DIR"
  exit 1
fi

echo "Validating templates in $TEMPLATE_DIR"
echo "Required tags: ${REQUIRED_TAGS[*]}"
echo "Skipping explicit Markdown exception: $EXCEPTION_TEMPLATE"
echo

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

  if [[ "$name" == "$EXCEPTION_TEMPLATE" ]]; then
    echo "SKIP  $name (Markdown exception)"
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
if [[ "$failed" -eq 0 ]]; then
  echo "All $passed templates passed validation (checked: $checked, skipped: 1)."
  exit 0
else
  echo "$failed template(s) failed validation (checked: $checked, passed: $passed, skipped: 1)."
  exit 1
fi
