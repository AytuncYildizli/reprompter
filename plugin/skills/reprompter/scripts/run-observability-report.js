#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createTelemetryStore } = require("./telemetry-store");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "benchmarks", "observability");
const OUTPUT_JSON = path.join(DEFAULT_OUTPUT_DIR, "v8.3-observability-report.json");
const OUTPUT_MD = path.join(DEFAULT_OUTPUT_DIR, "v8.3-observability-report.md");

function avg(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function pct(part, whole) {
  if (!whole) return 0;
  return Number(((part / whole) * 100).toFixed(2));
}

function toTable(rows, headers) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function summarizeEvents(events = []) {
  const runs = new Map();
  const stageLatency = new Map();
  const providerCounts = new Map();
  let retryEvents = 0;
  let stallEvents = 0;
  let timeoutEvents = 0;

  for (const event of events) {
    const runId = String(event.runId || "unknown");
    if (!runs.has(runId)) {
      runs.set(runId, {
        runId,
        statuses: [],
        finalized: false,
        success: false,
      });
    }

    const run = runs.get(runId);
    run.statuses.push(event.status || "ok");

    if (event.stage === "finalize_run") {
      run.finalized = true;
      run.success = event.pass === true || event.status === "ok";
    }

    if (event.stage === "retry_artifact") retryEvents += 1;
    if (event.status === "stalled") stallEvents += 1;
    if (event.status === "timeout") timeoutEvents += 1;

    if (typeof event.latencyMs === "number") {
      if (!stageLatency.has(event.stage)) stageLatency.set(event.stage, []);
      stageLatency.get(event.stage).push(event.latencyMs);
    }

    if (event.provider) {
      providerCounts.set(event.provider, (providerCounts.get(event.provider) || 0) + 1);
    }
  }

  const runEntries = Array.from(runs.values());
  const totalRuns = runEntries.length;
  const finalizedRuns = runEntries.filter((run) => run.finalized).length;
  const successfulRuns = runEntries.filter((run) => run.success).length;
  const failedRuns = Math.max(0, finalizedRuns - successfulRuns);

  const stageLatencySummary = Array.from(stageLatency.entries()).map(([stage, values]) => ({
    stage,
    samples: values.length,
    avgLatencyMs: avg(values),
  }));

  const providerSummary = Array.from(providerCounts.entries()).map(([provider, count]) => ({
    provider,
    count,
    sharePercent: pct(count, events.length),
  }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      events: events.length,
      runs: totalRuns,
      finalizedRuns,
      successfulRuns,
      failedRuns,
      retryEvents,
      stalledEvents: stallEvents,
      timeoutEvents,
      stallRatePercent: pct(stallEvents, Math.max(events.length, 1)),
      timeoutRatePercent: pct(timeoutEvents, Math.max(events.length, 1)),
    },
    stageLatency: stageLatencySummary,
    providers: providerSummary,
  };
}

function writeReport(summary, outputDir = DEFAULT_OUTPUT_DIR) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, path.basename(OUTPUT_JSON));
  const mdPath = path.join(outputDir, path.basename(OUTPUT_MD));

  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const stageRows = summary.stageLatency.map((row) => [
    row.stage,
    String(row.samples),
    String(row.avgLatencyMs),
  ]);

  const providerRows = summary.providers.map((row) => [
    row.provider,
    String(row.count),
    `${row.sharePercent}%`,
  ]);

  const md = [
    "# RePrompter v8.3 Observability Report",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Run Summary",
    "",
    `- Events: **${summary.totals.events}**`,
    `- Runs: **${summary.totals.runs}**`,
    `- Finalized Runs: **${summary.totals.finalizedRuns}**`,
    `- Successful Runs: **${summary.totals.successfulRuns}**`,
    `- Failed Runs: **${summary.totals.failedRuns}**`,
    `- Retry Events: **${summary.totals.retryEvents}**`,
    `- Stall Rate: **${summary.totals.stallRatePercent}%**`,
    `- Timeout Rate: **${summary.totals.timeoutRatePercent}%**`,
    "",
    "## Stage Latency",
    "",
    stageRows.length > 0
      ? toTable(stageRows, ["Stage", "Samples", "Avg Latency (ms)"])
      : "No stage latency data.",
    "",
    "## Provider Distribution",
    "",
    providerRows.length > 0
      ? toTable(providerRows, ["Provider", "Events", "Share"])
      : "No provider data.",
    "",
  ].join("\n");

  fs.writeFileSync(mdPath, md, "utf8");

  return { jsonPath, mdPath };
}

function run() {
  const store = createTelemetryStore({ rootDir: ROOT });
  const events = store.readEvents();
  const summary = summarizeEvents(events);
  const paths = writeReport(summary);

  process.stdout.write(`Wrote ${paths.mdPath}\n`);
  process.stdout.write(`Wrote ${paths.jsonPath}\n`);
  process.stdout.write(`Runs: ${summary.totals.runs}, events: ${summary.totals.events}\n`);
}

module.exports = {
  summarizeEvents,
  writeReport,
};

if (require.main === module) {
  run();
}
