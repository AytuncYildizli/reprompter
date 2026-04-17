# Outcome Capture Schema (v1)

This document defines two paired artifacts that close the reprompter feedback
loop for **Mode 1 Single** prompts:

1. **`success_criteria`** — a list of named assertions embedded *inside* the
   generated prompt as an XML block. Tells the model (and any later verifier)
   what "good output" looks like.
2. **`outcome_record`** — a JSON object written to
   `.reprompter/outcomes/<timestamp>.json` after the prompt runs. Captures
   what actually happened so future runs can learn from it.

Multi-agent flows (Mode 2+) are out of scope for v1. Verifier implementations
are out of scope — this spec only fixes the *shape* of the data.

---

## 1. `success_criteria` — XML block embedded in the generated prompt

The reprompter skill appends a `<success_criteria>` block to every Mode 1
prompt it generates, using the same XML idiom already established in
`SKILL.md`. Each child `<criterion>` is one named assertion.

### Element shape

```xml
<success_criteria schema_version="1">
  <criterion id="<short-slug>" verification_method="rule|llm_judge|manual">
    <description>One-sentence check, present tense.</description>
    <!-- Exactly one of the following, depending on verification_method: -->
    <rule type="regex|predicate"><![CDATA[ ... ]]></rule>
    <judge_prompt><![CDATA[ ... ]]></judge_prompt>
    <!-- (none) for verification_method="manual" -->
  </criterion>
  ...
</success_criteria>
```

### Field contract

| Field                 | Required | Notes                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------- |
| `schema_version`      | yes      | Integer attribute on the root. Currently `1`.                         |
| `id`                  | yes      | Short kebab-case slug, unique within the block. Stable across runs.   |
| `verification_method` | yes      | Enum: `rule`, `llm_judge`, `manual`.                                  |
| `description`         | yes      | One sentence. The model reads this to self-check before responding.   |
| `rule`                | cond.    | Required iff `verification_method="rule"`. `type` is `regex` or `predicate`. |
| `judge_prompt`        | cond.    | Required iff `verification_method="llm_judge"`. Inline judge instructions. |

For `verification_method="manual"` neither `rule` nor `judge_prompt` is set —
a human inspects the output and records the result.

`rule` payload conventions:
- `type="regex"` — body is a single regex, anchored as written. Match against
  full `output_text`. Pass = at least one match.
- `type="predicate"` — body is a short DSL string (e.g. `len(output_text) < 4000`).
  v1 readers may treat this opaquely; the v2 verifier will define grammar.

---

## 2. `outcome_record` — JSON written to `.reprompter/outcomes/`

One file per prompt execution. Filename:
`.reprompter/outcomes/<UTC-timestamp>-<short-fingerprint>.json` where `<short-fingerprint>` is the first 8 hex chars of `prompt_fingerprint` (e.g. `2026-04-17T14-23-09Z-b1946ac9.json`). The short fingerprint dedupes same-timestamp runs with distinct prompts. Timestamp colons are swapped for hyphens so the filename is portable across filesystems.
Keys are `snake_case`. Top-level shape:

```json
{
  "schema_version": 1,
  "timestamp": "2026-04-17T14:23:09Z",
  "prompt_fingerprint": "sha256:<hex>",
  "prompt_text": "...full generated prompt that was actually run...",
  "task_type": "fix_bug",
  "mode": "single",
  "role": "architect",
  "success_criteria": [ { "id": "...", "...": "..." } ],
  "output_text": "...full output string from the model...",
  "verification_results": {
    "<criterion-id>": "pass" | "fail" | "skipped"
  },
  "score": 7,
  "notes": "free-form string, may be empty"
}
```

> `role` is **optional** and typically only set for `mode="repromptverse"` records, so the flywheel bridge can route distinct agent roles into distinct recipe fingerprint buckets. Omit it for `mode="single"` records (no role).

### Field contract

| Field                  | Type            | Notes                                                                                       |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| `schema_version`       | integer         | Currently `1`.                                                                              |
| `timestamp`            | string          | ISO 8601, UTC, second precision.                                                            |
| `prompt_fingerprint`   | string          | `sha256:` prefix + hex digest of `prompt_text` bytes (UTF-8). Lets us dedupe identical runs. |
| `prompt_text`          | string          | The full generated prompt that was run — *not* the user's rough input.                      |
| `task_type`            | string          | One of the slugs from SKILL.md's task-type table (e.g. `fix_bug`, `write_code`, `explain`). |
| `mode`                 | string          | `"single"`, `"repromptverse"`, or `"reverse"`.                                              |
| `role`                 | string \| absent | Optional. Agent name for Repromptverse records (e.g. `"architect"`, `"backend-coder"`). Routes into the flywheel bridge as the recipe `domain`, so distinct roles on the same `task_type` produce distinct recipe hashes and the strategy learner can tell them apart. Omit for `mode="single"`. |
| `success_criteria`     | array of object | Same list as embedded in the prompt, normalised to JSON (see below).                        |
| `output_text`          | string          | Full model output. Do not truncate.                                                         |
| `verification_results` | object          | Map of `criterion.id → "pass" | "fail" | "skipped"`. Missing keys imply `"skipped"`.        |
| `score`                | integer 0–10    | `round(passed / (passed + failed) * 10)`. If denominator is 0, score is `null`.             |
| `notes`                | string          | Free-form. Author of the run may attach context, retry reasons, regressions.                |

### `success_criteria` normalised JSON form

Each criterion in the JSON record mirrors the XML element:

```json
{
  "id": "must_compile",
  "description": "Patched file compiles without TypeScript errors.",
  "verification_method": "manual"
}
```

For `rule` criteria add `"rule": { "type": "regex", "body": "..." }`. For
`llm_judge` criteria add `"judge_prompt": "..."`.

---

## 3. Versioning & forward compatibility

- `schema_version` lives on **both** artifacts and starts at `1`.
- **Writers** must always set `schema_version`. When adding fields, keep older
  fields populated and only *add* — never repurpose a key.
- **Readers** must tolerate unknown fields (ignore them) and missing optional
  fields (treat as absent, not as an error). A reader written against v1 must
  still parse a v2 record's known v1 fields.
- A breaking change requires bumping `schema_version` and shipping a migration
  note in this file.

---

## 4. Worked example — Mode 1 "Fix Bug" prompt

### 4a. Generated prompt with embedded `success_criteria`

```
<role>
Senior TypeScript engineer fixing a regression in a Next.js API route.
</role>

<task>
The /api/checkout route returns 500 when `cart.items` is empty. Patch
src/app/api/checkout/route.ts so it returns a 400 with body
{"error": "cart_empty"} instead. Do not change behaviour for non-empty carts.
</task>

<success_criteria schema_version="1">
  <criterion id="returns_400_on_empty" verification_method="rule">
    <description>Patch contains a 400 status response for the empty-cart branch.</description>
    <rule type="regex"><![CDATA[status:\s*400]]></rule>
  </criterion>
  <criterion id="error_code_present" verification_method="rule">
    <description>Response body uses the agreed cart_empty error code.</description>
    <rule type="regex"><![CDATA["error"\s*:\s*"cart_empty"]]></rule>
  </criterion>
  <criterion id="non_empty_branch_untouched" verification_method="llm_judge">
    <description>The non-empty cart code path is unchanged in behaviour.</description>
    <judge_prompt><![CDATA[Read the diff. Does the non-empty cart branch produce the same response as before? Answer pass or fail with one sentence.]]></judge_prompt>
  </criterion>
  <criterion id="compiles" verification_method="manual">
    <description>tsc --noEmit succeeds on the patched file.</description>
  </criterion>
</success_criteria>
```

### 4b. Matching `outcome_record` JSON

`.reprompter/outcomes/2026-04-17T14-23-09Z-b1946ac9.json`:

```json
{
  "schema_version": 1,
  "timestamp": "2026-04-17T14:23:09Z",
  "prompt_fingerprint": "sha256:b1946ac92492d2347c6235b4d2611184f1d6f7a9c3d4e5b6a7c8d9e0f1a2b3c4",
  "prompt_text": "<role>\nSenior TypeScript engineer fixing a regression in a Next.js API route.\n</role>\n\n<task>\nThe /api/checkout route returns 500 when `cart.items` is empty. Patch src/app/api/checkout/route.ts so it returns a 400 with body {\"error\": \"cart_empty\"} instead. Do not change behaviour for non-empty carts.\n</task>\n\n<success_criteria schema_version=\"1\"> ... </success_criteria>",
  "task_type": "fix_bug",
  "mode": "single",
  "success_criteria": [
    {
      "id": "returns_400_on_empty",
      "description": "Patch contains a 400 status response for the empty-cart branch.",
      "verification_method": "rule",
      "rule": { "type": "regex", "body": "status:\\s*400" }
    },
    {
      "id": "error_code_present",
      "description": "Response body uses the agreed cart_empty error code.",
      "verification_method": "rule",
      "rule": { "type": "regex", "body": "\"error\"\\s*:\\s*\"cart_empty\"" }
    },
    {
      "id": "non_empty_branch_untouched",
      "description": "The non-empty cart code path is unchanged in behaviour.",
      "verification_method": "llm_judge",
      "judge_prompt": "Read the diff. Does the non-empty cart branch produce the same response as before? Answer pass or fail with one sentence."
    },
    {
      "id": "compiles",
      "description": "tsc --noEmit succeeds on the patched file.",
      "verification_method": "manual"
    }
  ],
  "output_text": "Here is the patch...\n\n```ts\nif (cart.items.length === 0) {\n  return NextResponse.json({ error: \"cart_empty\" }, { status: 400 });\n}\n// existing non-empty handling unchanged\n```",
  "verification_results": {
    "returns_400_on_empty": "pass",
    "error_code_present": "pass",
    "non_empty_branch_untouched": "pass",
    "compiles": "skipped"
  },
  "score": 10,
  "notes": "compiles criterion skipped — no local toolchain available at run time; rerun manually before merge."
}
```

Score math: 3 passed, 0 failed, 1 skipped → `round(3 / (3 + 0) * 10) = 10`.
Skipped criteria do not count against the score; they are surfaced in
`verification_results` for follow-up.
