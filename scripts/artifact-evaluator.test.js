"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateArtifact } = require("./artifact-evaluator");

const GOOD_ARTIFACT = `
## Findings
- High: Token leak risk at src/auth.ts:42

## Decisions
- Prioritize rotating stale credentials and add guardrails.

## Risks
- Regression risk around middleware ordering in src/server.ts:15.

## Next Actions
- Patch auth middleware and add tests in test/auth.test.ts:21.
`;

test("passes high-quality artifact with all required sections", () => {
  const result = evaluateArtifact(GOOD_ARTIFACT, {
    threshold: 8,
    requiredSections: ["findings", "decisions", "risks", "next actions"],
    requiresLineRefs: true,
  });

  assert.equal(result.pass, true);
  assert.ok(result.overallScore >= 8);
  assert.equal(result.stats.missingSections.length, 0);
});

test("fails artifact when required sections are missing", () => {
  const result = evaluateArtifact("## Findings\n- Only findings", {
    requiredSections: ["findings", "decisions"],
    requiresLineRefs: false,
    threshold: 7,
  });

  assert.equal(result.pass, false);
  assert.ok(result.gaps.some((gap) => gap.includes("Missing sections")));
});

test("fails artifact without line refs when required", () => {
  const result = evaluateArtifact(
    "## Findings\n- Risk found\n## Decisions\n- Do X\n## Risks\n- R1\n## Next Actions\n- A1",
    {
      requiredSections: ["findings", "decisions", "risks", "next actions"],
      requiresLineRefs: true,
      threshold: 6,
    }
  );

  assert.equal(result.pass, false);
  assert.ok(result.gaps.some((gap) => gap.includes("file:line")));
});

test("flags forbidden pattern boundary violations", () => {
  const result = evaluateArtifact(GOOD_ARTIFACT + "\nDo not edit config, but edited .env anyway", {
    forbiddenPatterns: ["edited \\.env"],
    requiresLineRefs: true,
    threshold: 6,
  });

  assert.equal(result.pass, false);
  assert.ok(result.stats.forbiddenHits.length > 0);
});
