"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { routeIntent } = require("./intent-router");

test("routes explicit campaign swarm trigger to marketing", () => {
  const result = routeIntent("repromptverse campaign swarm for launch plan");
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "marketing-swarm");
  assert.equal(result.reason, "explicit-profile-trigger");
});

test("routes engineering intent with multi-agent trigger", () => {
  const result = routeIntent(
    "repromptverse: refactor auth module, migrate api contract, improve test coverage"
  );
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "engineering-swarm");
  assert.ok(result.score > 0);
});

test("routes ops incident intent", () => {
  const result = routeIntent(
    "reprompter teams gateway timeout incident with uptime drop and cron errors"
  );
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "ops-swarm");
});

test("routes research benchmark intent", () => {
  const result = routeIntent(
    "run with quality benchmark memory architectures and compare tradeoff matrix"
  );
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "research-swarm");
});

test("falls back to generic repromptverse on weak multi-agent signal", () => {
  const result = routeIntent("repromptverse help me with this");
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "repromptverse");
  assert.equal(result.reason, "generic-multi-agent-fallback");
});

test("uses single mode without multi-agent trigger", () => {
  const result = routeIntent("fix typo in header title");
  assert.equal(result.mode, "single");
  assert.equal(result.profile, "single");
});

test("forceMultiAgent allows domain routing even without explicit trigger phrase", () => {
  const result = routeIntent("launch growth seo content calendar", {
    forceMultiAgent: true,
  });
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "marketing-swarm");
});

test("explicit profile trigger wins over conflicting keywords", () => {
  const result = routeIntent(
    "ops swarm: benchmark options and compare analysis for outage plan"
  );
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "ops-swarm");
  assert.equal(result.reason, "explicit-profile-trigger");
});

test("auto-detects audit prompts as multi-agent without explicit trigger", () => {
  const result = routeIntent("audit auth, config, and memory handling for quality gaps");
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "repromptverse");
  assert.equal(result.reason, "generic-multi-agent-fallback");
});

test("auto-detects parallel prompts as multi-agent without explicit trigger", () => {
  const result = routeIntent("run frontend and backend investigations in parallel");
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "engineering-swarm");
});

test("auto-detects multi-domain prompts as multi-agent without explicit trigger", () => {
  const result = routeIntent("coordinate frontend, api, and database workstreams");
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "engineering-swarm");
});

test("keeps single mode for simple prompts that mention api and auth", () => {
  const result = routeIntent("improve api auth flow");
  assert.equal(result.mode, "single");
  assert.equal(result.profile, "single");
  assert.equal(result.reason, "single-mode-intent");
});

test("falls back to repromptverse when only one routing keyword matches", () => {
  const result = routeIntent("repromptverse backend");
  assert.equal(result.mode, "multi-agent");
  assert.equal(result.profile, "repromptverse");
  assert.equal(result.reason, "generic-multi-agent-fallback");
});

test("forceSingle overrides explicit profile triggers", () => {
  const result = routeIntent("ops swarm incident response", { forceSingle: true });
  assert.equal(result.mode, "single");
  assert.equal(result.profile, "single");
  assert.equal(result.reason, "forced-single-mode");
});

// --- Reverse mode tests ---

test("routes reverse reprompt trigger to reverse mode", () => {
  const result = routeIntent("reverse reprompt this code review output");
  assert.equal(result.mode, "reverse");
  assert.equal(result.profile, "reverse");
  assert.equal(result.reason, "reverse-mode-trigger");
});

test("routes reprompt from example trigger to reverse mode", () => {
  const result = routeIntent("reprompt from example: here is my great architecture doc");
  assert.equal(result.mode, "reverse");
  assert.equal(result.profile, "reverse");
});

test("routes learn from this trigger to reverse mode", () => {
  const result = routeIntent("learn from this output and create a reusable prompt");
  assert.equal(result.mode, "reverse");
  assert.equal(result.profile, "reverse");
});

test("routes prompt dna trigger to reverse mode", () => {
  const result = routeIntent("extract the prompt dna from this security audit");
  assert.equal(result.mode, "reverse");
  assert.equal(result.profile, "reverse");
});

test("forceReverse enables reverse mode", () => {
  const result = routeIntent("some generic text", { forceReverse: true });
  assert.equal(result.mode, "reverse");
  assert.equal(result.reason, "forced-reverse-mode");
});

test("forceSingle overrides reverse triggers", () => {
  const result = routeIntent("reverse reprompt this output", { forceSingle: true });
  assert.equal(result.mode, "single");
  assert.equal(result.profile, "single");
  assert.equal(result.reason, "forced-single-mode");
});

test("reverse triggers take priority over multi-agent triggers", () => {
  const result = routeIntent("reverse reprompt this repromptverse audit output");
  assert.equal(result.mode, "reverse");
  assert.equal(result.profile, "reverse");
});
