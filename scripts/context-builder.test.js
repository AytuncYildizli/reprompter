"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAgentContext } = require("./context-builder");

test("buildAgentContext includes required contract details", () => {
  const result = buildAgentContext(
    { id: "agent-1", role: "Security Analyst", domain: "security" },
    {
      task: "Audit auth middleware",
      requirements: ["Provide findings", "Include severity"],
      constraints: ["Read-only"],
      successCriteria: ["At least 5 findings"],
      outputPath: "/tmp/rpt-task-security.md",
    },
    { codeFacts: ["src/auth.ts has middleware"] }
  );

  assert.match(result.promptContext, /Layer 1: Task Contract/);
  assert.match(result.promptContext, /Agent: agent-1/);
  assert.match(result.promptContext, /Required Output Path: \/tmp\/rpt-task-security\.md/);
});

test("buildAgentContext truncates lower-priority layers under tight budget", () => {
  const result = buildAgentContext(
    { id: "agent-2", role: "Researcher", domain: "research" },
    {
      task: "Compare memory strategies",
      requirements: ["Build tradeoff matrix"],
    },
    {
      codeFacts: Array.from({ length: 20 }, (_, i) => `Code fact ${i + 1}`),
      references: Array.from({ length: 20 }, (_, i) => `Reference ${i + 1}`),
      priorArtifacts: Array.from({ length: 20 }, (_, i) => `Artifact ${i + 1}`),
    },
    { totalTokens: 180 }
  );

  const repoLayer = result.manifest.layers.find((layer) => layer.name === "repo_facts");
  const refLayer = result.manifest.layers.find((layer) => layer.name === "references");

  assert.ok(repoLayer);
  assert.ok(refLayer);
  assert.equal(repoLayer.truncated || refLayer.truncated, true);
});

test("contract layer is preserved even when total budget is very small", () => {
  const result = buildAgentContext(
    { id: "agent-3", role: "Ops", domain: "ops" },
    {
      task: "Triage outage",
      requirements: ["Timeline"],
      constraints: ["No infra changes"],
    },
    {
      codeFacts: ["fact 1", "fact 2"],
      references: ["ref 1"],
      priorArtifacts: ["artifact 1"],
    },
    { totalTokens: 60 }
  );

  assert.match(result.promptContext, /Layer 1: Task Contract/);
  assert.ok(result.manifest.totalUsedTokens > 0);
});
