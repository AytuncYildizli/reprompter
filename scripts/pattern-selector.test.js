"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PATTERN_CATALOG,
  selectPatterns,
  renderPatternGuidance,
  getPatternById,
} = require("./pattern-selector");

test("catalog exposes seven selectable patterns", () => {
  assert.equal(PATTERN_CATALOG.length, 7);
});

test("selects evidence and uncertainty patterns for security audit task", () => {
  const result = selectPatterns(
    { task: "audit authentication controls and evaluate evidence quality" },
    "security",
    { maxPatterns: 6 }
  );

  assert.ok(result.patternIds.includes("constraint-first-framing"));
  assert.ok(result.patternIds.includes("evidence-strength-labeling"));
  assert.ok(result.patternIds.includes("uncertainty-labeling"));
});

test("disabled patterns are excluded", () => {
  const result = selectPatterns(
    { task: "benchmark options", preferredOutcome: "balanced" },
    "research",
    { disabledPatterns: ["uncertainty-labeling"] }
  );

  assert.equal(result.patternIds.includes("uncertainty-labeling"), false);
});

test("enabledPatterns acts as allow-list", () => {
  const result = selectPatterns(
    { task: "any task" },
    "engineering",
    { enabledPatterns: ["delta-retry-scaffold"], maxPatterns: 6 }
  );

  assert.deepEqual(result.patternIds, ["delta-retry-scaffold"]);
});

test("selects tool description quality for agent tool tasks", () => {
  const result = selectPatterns(
    { task: "document MCP callable capabilities and tool descriptions for new agent tools" },
    "engineering",
    { maxPatterns: 7 }
  );

  assert.ok(result.patternIds.includes("tool-description-quality"));
});

test("does not select tool description quality on non-tool word fragments", () => {
  const result = selectPatterns(
    { task: "clean up stool descriptions in the office inventory" },
    "engineering",
    { maxPatterns: 7 }
  );

  assert.equal(result.patternIds.includes("tool-description-quality"), false);
});

test("renderPatternGuidance returns bullet list output", () => {
  const result = selectPatterns({ task: "analyze performance" }, "ops");
  const guidance = renderPatternGuidance(result);
  assert.match(guidance, /^- /m);
});

test("getPatternById returns full pattern object for valid id", () => {
  const pattern = getPatternById("constraint-first-framing");
  assert.ok(pattern);
  assert.equal(pattern.id, "constraint-first-framing");
  assert.equal(pattern.title, "Constraint-First Framing");
  assert.ok(pattern.guidance);
});

test("getPatternById is case-insensitive", () => {
  const pattern = getPatternById("Constraint-First-Framing");
  assert.ok(pattern);
  assert.equal(pattern.id, "constraint-first-framing");
});

test("getPatternById returns null for unknown id", () => {
  const pattern = getPatternById("nonexistent-pattern");
  assert.equal(pattern, null);
});
