#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { routeIntent } = require("./intent-router");
const { evaluateArtifact } = require("./artifact-evaluator");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "benchmarks", "fixtures");
const ROUTING_FIXTURES = path.join(FIXTURE_DIR, "realworld-routing-fixtures.json");
const ARTIFACT_FIXTURES = path.join(FIXTURE_DIR, "realworld-artifact-fixtures.json");
const OUTPUT_DIR = path.join(ROOT, "benchmarks");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "v8.3-realworld-benchmark.json");
const OUTPUT_MD = path.join(OUTPUT_DIR, "v8.3-realworld-benchmark.md");

function pct(part, whole) {
  if (!whole) return 0;
  return Number(((part / whole) * 100).toFixed(2));
}

function wilsonInterval(successes, n, z = 1.96) {
  if (n === 0) return { lower: 0, upper: 0 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) /
    denom;
  return {
    lower: Number((center - margin).toFixed(4)),
    upper: Number((center + margin).toFixed(4)),
  };
}

function toTable(rows, headers) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function evaluateRouting(fixtures) {
  const results = fixtures.map((fixture) => {
    const result = routeIntent(fixture.prompt, {
      forceMultiAgent: fixture.forceMultiAgent === true,
      forceSingle: fixture.forceSingle === true,
    });

    const profilePass = result.profile === fixture.expectedProfile;
    const modePass = fixture.expectedMode ? result.mode === fixture.expectedMode : true;
    const pass = profilePass && modePass;

    return {
      id: fixture.id,
      expectedProfile: fixture.expectedProfile,
      expectedMode: fixture.expectedMode || "any",
      detectedProfile: result.profile,
      detectedMode: result.mode,
      pass,
      reason: result.reason,
      score: result.score,
    };
  });

  const passCount = results.filter((x) => x.pass).length;
  const accuracy = pct(passCount, results.length);
  const ci = wilsonInterval(passCount, results.length);

  return {
    fixtureCount: results.length,
    passCount,
    accuracy,
    confidence95: ci,
    results,
  };
}

function evaluateArtifacts(fixtures) {
  const results = fixtures.map((fixture) => {
    const result = evaluateArtifact(fixture.artifact, fixture.contractSpec || {});

    const enforceScoreBounds = fixture.enforceScoreBounds === true;
    let pass = result.pass === fixture.expectedPass;
    if (typeof fixture.minScore === "number" && (fixture.expectedPass || enforceScoreBounds)) {
      pass = pass && result.overallScore >= fixture.minScore;
    }
    if (typeof fixture.maxScore === "number" && (fixture.expectedPass || enforceScoreBounds)) {
      pass = pass && result.overallScore <= fixture.maxScore;
    }

    return {
      id: fixture.id,
      type: fixture.type,
      expectedPass: fixture.expectedPass,
      detectedPass: result.pass,
      overallScore: result.overallScore,
      threshold: result.threshold,
      pass,
      gaps: result.gaps,
    };
  });

  const passCount = results.filter((x) => x.pass).length;
  const accuracy = pct(passCount, results.length);
  const ci = wilsonInterval(passCount, results.length);

  return {
    fixtureCount: results.length,
    passCount,
    accuracy,
    confidence95: ci,
    results,
  };
}

function run() {
  const routingFixtures = JSON.parse(fs.readFileSync(ROUTING_FIXTURES, "utf8"));
  const artifactFixtures = JSON.parse(fs.readFileSync(ARTIFACT_FIXTURES, "utf8"));

  const routing = evaluateRouting(routingFixtures);
  const artifacts = evaluateArtifacts(artifactFixtures);

  const routingFailures = routing.results.filter((x) => !x.pass);
  const artifactFailures = artifacts.results.filter((x) => !x.pass);

  const summary = {
    generatedAt: new Date().toISOString(),
    routing,
    artifacts,
    failures: {
      routing: routingFailures.slice(0, 20),
      artifacts: artifactFailures.slice(0, 20),
    },
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const routingRows = routing.results.slice(0, 20).map((result) => [
    result.id,
    result.expectedProfile,
    result.detectedProfile,
    result.expectedMode,
    result.detectedMode,
    result.pass ? "PASS" : "FAIL",
  ]);

  const artifactRows = artifacts.results.slice(0, 20).map((result) => [
    result.id,
    result.type,
    String(result.expectedPass),
    String(result.detectedPass),
    String(result.overallScore),
    result.pass ? "PASS" : "FAIL",
  ]);

  const md = [
    "# RePrompter v8.3 Real-World Benchmark",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Routing (Real-World Prompts)",
    "",
    `- Fixtures: **${routing.fixtureCount}**`,
    `- Pass: **${routing.passCount}**`,
    `- Accuracy: **${routing.accuracy}%**`,
    `- 95% CI (Wilson): **[${(routing.confidence95.lower * 100).toFixed(2)}%, ${(routing.confidence95.upper * 100).toFixed(2)}%]**`,
    "",
    toTable(routingRows, [
      "Case",
      "Expected Profile",
      "Detected Profile",
      "Expected Mode",
      "Detected Mode",
      "Result",
    ]),
    "",
    "## Artifact Evaluation (Real-World Outputs)",
    "",
    `- Fixtures: **${artifacts.fixtureCount}**`,
    `- Pass: **${artifacts.passCount}**`,
    `- Accuracy: **${artifacts.accuracy}%**`,
    `- 95% CI (Wilson): **[${(artifacts.confidence95.lower * 100).toFixed(2)}%, ${(artifacts.confidence95.upper * 100).toFixed(2)}%]**`,
    "",
    toTable(artifactRows, [
      "Case",
      "Type",
      "Expected Pass",
      "Detected Pass",
      "Score",
      "Result",
    ]),
    "",
    "## Failure Samples",
    "",
    `- Routing failures shown: ${summary.failures.routing.length}`,
    `- Artifact failures shown: ${summary.failures.artifacts.length}`,
    "",
    "## Notes",
    "",
    "- This benchmark is larger and noisier than fixture-smoke suites and is intended for release confidence.",
    "- Use together with provider/evaluator and observability reports before enabling stricter defaults.",
    "",
  ].join("\n");

  fs.writeFileSync(OUTPUT_MD, md, "utf8");

  process.stdout.write(`Wrote ${OUTPUT_MD}\n`);
  process.stdout.write(`Wrote ${OUTPUT_JSON}\n`);
  process.stdout.write(
    `Routing accuracy: ${routing.accuracy}% (${routing.passCount}/${routing.fixtureCount})\n`
  );
  process.stdout.write(
    `Artifact accuracy: ${artifacts.accuracy}% (${artifacts.passCount}/${artifacts.fixtureCount})\n`
  );
}

run();
