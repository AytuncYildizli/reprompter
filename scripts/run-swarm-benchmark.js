#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { routeIntent } = require("./intent-router");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.join(ROOT, "benchmarks", "fixtures", "swarm-benchmark-fixtures.json");
const OUTPUT_DIR = path.join(ROOT, "benchmarks");
const OUTPUT_MD = path.join(OUTPUT_DIR, "v8.2-swarm-benchmark.md");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "v8.2-swarm-benchmark.json");

const TEMPLATE_MAP = {
  "marketing-swarm": "references/marketing-swarm-template.md",
  "engineering-swarm": "references/engineering-swarm-template.md",
  "ops-swarm": "references/ops-swarm-template.md",
  "research-swarm": "references/research-swarm-template.md",
  repromptverse: "references/repromptverse-template.md",
};

const CONTRACT_TAGS = [
  "routing_policy",
  "termination_policy",
  "artifact_contract",
  "evaluation_loop",
];

function approxTokens(text) {
  return Math.ceil(text.length / 4);
}

function hasTag(content, tag) {
  return new RegExp(`<${tag}>`, "i").test(content);
}

function coveragePercent(present, total) {
  return Math.round((present / total) * 100);
}

function templateMetrics(profile) {
  const rel = TEMPLATE_MAP[profile];
  if (!rel) {
    return {
      profile,
      template: "n/a",
      approxTokens: 0,
      contractCoverage: 0,
      proxyQuality: 0,
    };
  }

  const abs = path.join(ROOT, rel);
  const content = fs.readFileSync(abs, "utf8");
  const presentTags = CONTRACT_TAGS.filter((tag) => hasTag(content, tag)).length;
  const contractCoverage = coveragePercent(presentTags, CONTRACT_TAGS.length);

  let proxyQuality = 0;
  if (hasTag(content, "requirements")) proxyQuality += 2;
  if (hasTag(content, "constraints")) proxyQuality += 2;
  if (hasTag(content, "agents")) proxyQuality += 1;
  if (hasTag(content, "coordination")) proxyQuality += 1;
  if (hasTag(content, "routing_policy")) proxyQuality += 1;
  if (hasTag(content, "termination_policy")) proxyQuality += 1;
  if (hasTag(content, "artifact_contract")) proxyQuality += 1;
  if (hasTag(content, "evaluation_loop")) proxyQuality += 1;

  return {
    profile,
    template: rel,
    approxTokens: approxTokens(content),
    contractCoverage,
    proxyQuality,
  };
}

function toTable(rows, headers) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function run() {
  const fixtures = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));

  const routed = fixtures.map((fixture) => {
    const result = routeIntent(fixture.prompt, {
      forceMultiAgent: fixture.forceMultiAgent === true,
    });
    const pass = result.profile === fixture.expectedProfile;
    return {
      id: fixture.id,
      expectedProfile: fixture.expectedProfile,
      detectedProfile: result.profile,
      mode: result.mode,
      pass,
      score: result.score,
      reason: result.reason,
      hits: result.hits,
    };
  });

  const passCount = routed.filter((x) => x.pass).length;
  const accuracy = coveragePercent(passCount, routed.length);

  const uniqueProfiles = Array.from(
    new Set(
      routed
        .map((r) => r.detectedProfile)
        .filter((p) => Object.prototype.hasOwnProperty.call(TEMPLATE_MAP, p))
    )
  );
  const metrics = uniqueProfiles.map((profile) => templateMetrics(profile));

  const summary = {
    generatedAt: new Date().toISOString(),
    fixtureCount: routed.length,
    passCount,
    accuracy,
    routing: routed,
    templates: metrics,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const routingRows = routed.map((r) => [
    r.id,
    r.expectedProfile,
    r.detectedProfile,
    r.mode,
    r.pass ? "PASS" : "FAIL",
    String(r.score),
    r.reason,
  ]);
  const templateRows = metrics.map((m) => [
    m.profile,
    `\`${m.template}\``,
    String(m.approxTokens),
    `${m.contractCoverage}%`,
    `${m.proxyQuality}/10`,
  ]);

  const md = [
    "# RePrompter v8.2 Swarm Benchmark",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Routing Accuracy",
    "",
    `- Fixtures: **${summary.fixtureCount}**`,
    `- Pass: **${summary.passCount}**`,
    `- Accuracy: **${summary.accuracy}%**`,
    "",
    toTable(routingRows, [
      "Case",
      "Expected",
      "Detected",
      "Mode",
      "Result",
      "Score",
      "Reason",
    ]),
    "",
    "## Template Contract Snapshot",
    "",
    toTable(templateRows, [
      "Profile",
      "Template",
      "Approx Tokens",
      "Contract Coverage",
      "Proxy Quality",
    ]),
    "",
    "## Notes",
    "",
    "- This benchmark validates deterministic routing and template contract completeness.",
    "- Runtime latency/cost depends on selected model and execution surface (Claude/Codex/OpenClaw).",
    "- Use this as a repeatable pre-release smoke benchmark before public launches.",
    "",
  ].join("\n");

  fs.writeFileSync(OUTPUT_MD, md, "utf8");

  process.stdout.write(`Wrote ${OUTPUT_MD}\n`);
  process.stdout.write(`Wrote ${OUTPUT_JSON}\n`);
  process.stdout.write(`Routing accuracy: ${accuracy}% (${passCount}/${routed.length})\n`);
}

run();
