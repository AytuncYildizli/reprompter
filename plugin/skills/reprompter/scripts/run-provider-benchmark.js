#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { resolveModelForAgent } = require("./capability-policy");
const { evaluateArtifact } = require("./artifact-evaluator");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "benchmarks");
const ROUTING_FIXTURES = path.join(OUTPUT_DIR, "fixtures", "provider-routing-fixtures.json");
const EVALUATOR_FIXTURES = path.join(OUTPUT_DIR, "fixtures", "evaluator-quality-fixtures.json");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "v8.3-provider-benchmark.json");
const OUTPUT_MD = path.join(OUTPUT_DIR, "v8.3-provider-benchmark.md");

function coveragePercent(present, total) {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
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

function runRoutingFixtures(fixtures) {
  return fixtures.map((fixture) => {
    const result = resolveModelForAgent(fixture.agentSpec, fixture.taskSpec);
    const pass = result.selected.capabilityTier === fixture.expectedTier;
    return {
      id: fixture.id,
      expectedTier: fixture.expectedTier,
      detectedTier: result.selected.capabilityTier,
      selectedModel: result.selected.model,
      selectedProvider: result.selected.provider,
      pass,
      reason: result.reason,
    };
  });
}

function runEvaluatorFixtures(fixtures) {
  return fixtures.map((fixture) => {
    const result = evaluateArtifact(fixture.artifact, fixture.contractSpec);

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
      expectedPass: fixture.expectedPass,
      detectedPass: result.pass,
      overallScore: result.overallScore,
      threshold: result.threshold,
      pass,
      gaps: result.gaps,
    };
  });
}

function run() {
  const routingFixtures = JSON.parse(fs.readFileSync(ROUTING_FIXTURES, "utf8"));
  const evaluatorFixtures = JSON.parse(fs.readFileSync(EVALUATOR_FIXTURES, "utf8"));

  const routingResults = runRoutingFixtures(routingFixtures);
  const evaluatorResults = runEvaluatorFixtures(evaluatorFixtures);

  const routingPass = routingResults.filter((x) => x.pass).length;
  const evaluatorPass = evaluatorResults.filter((x) => x.pass).length;

  const summary = {
    generatedAt: new Date().toISOString(),
    routing: {
      fixtureCount: routingResults.length,
      passCount: routingPass,
      accuracy: coveragePercent(routingPass, routingResults.length),
      confidence95: wilsonInterval(routingPass, routingResults.length),
      results: routingResults,
    },
    evaluator: {
      fixtureCount: evaluatorResults.length,
      passCount: evaluatorPass,
      accuracy: coveragePercent(evaluatorPass, evaluatorResults.length),
      confidence95: wilsonInterval(evaluatorPass, evaluatorResults.length),
      results: evaluatorResults,
    },
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const routingRows = routingResults.map((result) => [
    result.id,
    result.expectedTier,
    result.detectedTier,
    result.selectedProvider,
    `\`${result.selectedModel}\``,
    result.pass ? "PASS" : "FAIL",
  ]);

  const evaluatorRows = evaluatorResults.map((result) => [
    result.id,
    String(result.expectedPass),
    String(result.detectedPass),
    String(result.overallScore),
    result.pass ? "PASS" : "FAIL",
  ]);

  const markdown = [
    "# RePrompter v8.3 Provider + Evaluator Benchmark",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Capability Policy Routing",
    "",
    `- Fixtures: **${summary.routing.fixtureCount}**`,
    `- Pass: **${summary.routing.passCount}**`,
    `- Accuracy: **${summary.routing.accuracy}%**`,
    `- 95% CI (Wilson): **[${(summary.routing.confidence95.lower * 100).toFixed(2)}%, ${(summary.routing.confidence95.upper * 100).toFixed(2)}%]**`,
    "",
    toTable(routingRows, ["Case", "Expected Tier", "Detected Tier", "Provider", "Model", "Result"]),
    "",
    "## Artifact Evaluator",
    "",
    `- Fixtures: **${summary.evaluator.fixtureCount}**`,
    `- Pass: **${summary.evaluator.passCount}**`,
    `- Accuracy: **${summary.evaluator.accuracy}%**`,
    `- 95% CI (Wilson): **[${(summary.evaluator.confidence95.lower * 100).toFixed(2)}%, ${(summary.evaluator.confidence95.upper * 100).toFixed(2)}%]**`,
    "",
    toTable(evaluatorRows, ["Case", "Expected Pass", "Detected Pass", "Score", "Result"]),
    "",
    "## Notes",
    "",
    "- Routing validates capability-tier assignment and model/provider selection outputs.",
    "- Evaluator validates strict gating, missing section detection, and boundary checks.",
    "",
  ].join("\n");

  fs.writeFileSync(OUTPUT_MD, markdown, "utf8");

  process.stdout.write(`Wrote ${OUTPUT_MD}\n`);
  process.stdout.write(`Wrote ${OUTPUT_JSON}\n`);
  process.stdout.write(
    `Routing accuracy: ${summary.routing.accuracy}% (${summary.routing.passCount}/${summary.routing.fixtureCount})\n`
  );
  process.stdout.write(
    `Evaluator accuracy: ${summary.evaluator.accuracy}% (${summary.evaluator.passCount}/${summary.evaluator.fixtureCount})\n`
  );
}

run();
