#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./recipe-fingerprint");
const { computeEffectiveness, createOutcomeStore } = require("./outcome-collector");
const { recommendStrategy } = require("./strategy-learner");
const os = require("node:os");

const FIXTURES_PATH = path.join(__dirname, "..", "benchmarks", "fixtures", "flywheel-benchmark-fixtures.json");
const REPORT_DIR = path.join(__dirname, "..", "benchmarks");

function loadFixtures() {
  return JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf8"));
}

function runFingerprintBenchmarks(fixtures) {
  const results = [];
  for (const fixture of fixtures) {
    const fpA = fingerprint(fixture.recipeA);
    const fpB = fingerprint(fixture.recipeB);
    const sameHash = fpA.hash === fpB.hash;
    const pass = sameHash === fixture.expectSameHash;
    results.push({
      id: fixture.id,
      pass,
      expected: fixture.expectSameHash ? "same" : "different",
      actual: sameHash ? "same" : "different",
      hashA: fpA.hash,
      hashB: fpB.hash,
    });
  }
  return results;
}

function runEffectivenessBenchmarks(fixtures) {
  const results = [];
  for (const fixture of fixtures) {
    const score = computeEffectiveness(fixture.signals);
    const pass = score >= fixture.expectedMin && score <= fixture.expectedMax;
    results.push({
      id: fixture.id,
      pass,
      score,
      expectedRange: `[${fixture.expectedMin}, ${fixture.expectedMax}]`,
    });
  }
  return results;
}

function runStrategyBenchmarks(fixtures) {
  const results = [];
  for (const fixture of fixtures) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-flywheel-bench-"));
    const store = createOutcomeStore({ rootDir: tmpDir, dirPath: tmpDir });

    try {
      // Populate store with fixture outcomes
      for (const outcomeSpec of fixture.outcomes) {
        const recipe = fingerprint(outcomeSpec.recipe || {
          templateId: "security-template",
          domain: "security",
          capabilityTier: "reasoning_high",
          patterns: ["constraint-first-framing"],
          contextLayers: 4,
          qualityScore: 8.5,
        });
        store.writeOutcome({
          runId: `bench-${Math.random().toString(36).slice(2, 8)}`,
          taskId: "bench-task",
          recipe,
          signals: { artifactScore: outcomeSpec.effectivenessScore || 5, artifactPass: true },
          effectivenessScore: outcomeSpec.effectivenessScore || 5,
        });
      }

      const target = fingerprint({
        templateId: "security-template",
        domain: "security",
        capabilityTier: "reasoning_high",
        patterns: ["constraint-first-framing"],
        contextLayers: 4,
        qualityScore: 8.5,
      }).vector;

      const result = recommendStrategy(target, { store, domain: "security", similarityThreshold: 0.3 });

      let pass;
      if (fixture.expectRecommendation) {
        pass = result.recommendation !== null &&
          (!fixture.expectedScoreMin || result.recommendation.score >= fixture.expectedScoreMin);
      } else {
        pass = result.recommendation === null;
      }

      results.push({
        id: fixture.id,
        pass,
        hasRecommendation: result.recommendation !== null,
        score: result.recommendation ? result.recommendation.score : null,
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
  return results;
}

function wilsonCI(successes, total, z = 1.96) {
  if (total === 0) return { lower: 0, upper: 0 };
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return {
    lower: Number(((center - spread) / denominator * 100).toFixed(2)),
    upper: Number(((center + spread) / denominator * 100).toFixed(2)),
  };
}

function run() {
  const fixtures = loadFixtures();
  const timestamp = new Date().toISOString();

  const fpResults = runFingerprintBenchmarks(fixtures.fingerprint_determinism);
  const effResults = runEffectivenessBenchmarks(fixtures.effectiveness_scoring);
  const stratResults = runStrategyBenchmarks(fixtures.strategy_learning);

  const fpPass = fpResults.filter((r) => r.pass).length;
  const effPass = effResults.filter((r) => r.pass).length;
  const stratPass = stratResults.filter((r) => r.pass).length;
  const totalPass = fpPass + effPass + stratPass;
  const totalCount = fpResults.length + effResults.length + stratResults.length;
  const ci = wilsonCI(totalPass, totalCount);

  const report = {
    timestamp,
    version: "9.0.0",
    summary: {
      total: totalCount,
      passed: totalPass,
      failed: totalCount - totalPass,
      accuracy: `${((totalPass / totalCount) * 100).toFixed(1)}%`,
      wilsonCI95: `[${ci.lower}%, ${ci.upper}%]`,
    },
    fingerprint: { total: fpResults.length, passed: fpPass, results: fpResults },
    effectiveness: { total: effResults.length, passed: effPass, results: effResults },
    strategy: { total: stratResults.length, passed: stratPass, results: stratResults },
  };

  // Write JSON report
  const jsonPath = path.join(REPORT_DIR, "v9.0-flywheel-benchmark.json");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  // Write Markdown report
  const md = [
    "# RePrompter v9.0 Flywheel Benchmark Report",
    "",
    `Generated: ${timestamp}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `|---|---|`,
    `| Total fixtures | ${totalCount} |`,
    `| Passed | ${totalPass} |`,
    `| Failed | ${totalCount - totalPass} |`,
    `| Accuracy | ${report.summary.accuracy} |`,
    `| Wilson 95% CI | ${report.summary.wilsonCI95} |`,
    "",
    "## Fingerprint Determinism",
    "",
    `Pass: ${fpPass}/${fpResults.length}`,
    "",
    ...fpResults.map((r) => `- ${r.pass ? "PASS" : "FAIL"} ${r.id}: expected ${r.expected}, got ${r.actual}`),
    "",
    "## Effectiveness Scoring",
    "",
    `Pass: ${effPass}/${effResults.length}`,
    "",
    ...effResults.map((r) => `- ${r.pass ? "PASS" : "FAIL"} ${r.id}: score ${r.score} in ${r.expectedRange}`),
    "",
    "## Strategy Learning",
    "",
    `Pass: ${stratPass}/${stratResults.length}`,
    "",
    ...stratResults.map((r) =>
      `- ${r.pass ? "PASS" : "FAIL"} ${r.id}: recommendation=${r.hasRecommendation}${r.score !== null ? ` score=${r.score}` : ""}`
    ),
    "",
  ];

  const mdPath = path.join(REPORT_DIR, "v9.0-flywheel-benchmark.md");
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");

  // Console output
  process.stdout.write(`\nFlywheel Benchmark: ${totalPass}/${totalCount} passed ${report.summary.wilsonCI95}\n`);
  process.stdout.write(`  Fingerprint: ${fpPass}/${fpResults.length}\n`);
  process.stdout.write(`  Effectiveness: ${effPass}/${effResults.length}\n`);
  process.stdout.write(`  Strategy: ${stratPass}/${stratResults.length}\n\n`);

  if (totalPass < totalCount) {
    const failures = [
      ...fpResults.filter((r) => !r.pass),
      ...effResults.filter((r) => !r.pass),
      ...stratResults.filter((r) => !r.pass),
    ];
    process.stderr.write(`FAILURES:\n`);
    for (const f of failures) {
      process.stderr.write(`  ${f.id}: ${JSON.stringify(f)}\n`);
    }
    process.exit(1);
  }
}

run();
