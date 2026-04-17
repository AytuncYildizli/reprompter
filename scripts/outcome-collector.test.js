#!/usr/bin/env node
"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {
  createOutcomeStore,
  validateOutcome,
  sanitizeSignals,
  computeEffectiveness,
  collectGitSignals,
  injectExemplar,
  v1RecordToFlywheelOutcome,
  ingestOutcomeRecord,
  ingestDirectory,
} = require("./outcome-collector");
const { fingerprint } = require("./recipe-fingerprint");

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-outcome-test-"));
  return createOutcomeStore({ rootDir: dir, dirPath: dir });
}

function sampleOutcome(overrides = {}) {
  const recipe = fingerprint({
    templateId: "security-template",
    patterns: ["constraint-first-framing"],
    capabilityTier: "reasoning_high",
    domain: "security",
    contextLayers: 4,
    qualityScore: 8.5,
  });
  return {
    runId: "rpt-test-1",
    taskId: "audit-auth",
    recipe,
    signals: {
      artifactScore: 8.5,
      artifactPass: true,
      retryCount: 0,
      filesChanged: 3,
      insertions: 120,
      deletions: 15,
    },
    ...overrides,
  };
}

describe("outcome-collector", () => {
  const stores = [];
  afterEach(() => {
    for (const store of stores) {
      try { fs.rmSync(store.dirPath, { recursive: true, force: true }); } catch {}
    }
    stores.length = 0;
  });

  describe("createOutcomeStore()", () => {
    it("creates store with correct file path", () => {
      const store = tmpStore();
      stores.push(store);
      assert.ok(store.filePath.endsWith("outcomes.ndjson"));
    });

    it("writes and reads outcomes", () => {
      const store = tmpStore();
      stores.push(store);
      store.writeOutcome(sampleOutcome());
      store.writeOutcome(sampleOutcome({ runId: "rpt-test-2" }));
      const outcomes = store.readOutcomes();
      assert.strictEqual(outcomes.length, 2);
    });

    it("filters by domain", () => {
      const store = tmpStore();
      stores.push(store);
      store.writeOutcome(sampleOutcome());
      const securityOutcomes = store.readOutcomes({ domain: "security" });
      const marketingOutcomes = store.readOutcomes({ domain: "marketing" });
      assert.strictEqual(securityOutcomes.length, 1);
      assert.strictEqual(marketingOutcomes.length, 0);
    });

    it("respects limit", () => {
      const store = tmpStore();
      stores.push(store);
      for (let i = 0; i < 5; i++) {
        store.writeOutcome(sampleOutcome({ runId: `rpt-test-${i}` }));
      }
      const outcomes = store.readOutcomes({ limit: 3 });
      assert.strictEqual(outcomes.length, 3);
    });

    it("clears all outcomes", () => {
      const store = tmpStore();
      stores.push(store);
      store.writeOutcome(sampleOutcome());
      assert.strictEqual(store.readOutcomes().length, 1);
      store.clear();
      assert.strictEqual(store.readOutcomes().length, 0);
    });

    it("returns empty array for missing file", () => {
      const store = tmpStore();
      stores.push(store);
      assert.deepStrictEqual(store.readOutcomes(), []);
    });
  });

  describe("validateOutcome()", () => {
    it("accepts valid outcome", () => {
      const result = validateOutcome(sampleOutcome());
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("rejects missing runId", () => {
      const result = validateOutcome(sampleOutcome({ runId: "" }));
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("runId")));
    });

    it("rejects missing recipe", () => {
      const result = validateOutcome({ runId: "x", taskId: "y", signals: {} });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("recipe")));
    });

    it("auto-computes effectiveness when not provided", () => {
      const result = validateOutcome(sampleOutcome());
      assert.ok(Number.isFinite(result.outcome.effectivenessScore));
    });
  });

  describe("sanitizeSignals()", () => {
    it("keeps valid signals", () => {
      const signals = sanitizeSignals({
        artifactScore: 9.0,
        artifactPass: true,
        retryCount: 1,
        filesChanged: 5,
        userVerdict: "accept",
      });
      assert.strictEqual(signals.artifactScore, 9.0);
      assert.strictEqual(signals.artifactPass, true);
      assert.strictEqual(signals.retryCount, 1);
      assert.strictEqual(signals.filesChanged, 5);
      assert.strictEqual(signals.userVerdict, "accept");
    });

    it("strips invalid signals", () => {
      const signals = sanitizeSignals({
        artifactScore: "not-a-number",
        userVerdict: "maybe",
        extraField: "ignored",
      });
      assert.strictEqual(signals.artifactScore, undefined);
      assert.strictEqual(signals.userVerdict, undefined);
      assert.strictEqual(signals.extraField, undefined);
    });

    it("clamps negative values to zero", () => {
      const signals = sanitizeSignals({
        retryCount: -2,
        filesChanged: -1,
        executionMs: -100,
      });
      assert.strictEqual(signals.retryCount, 0);
      assert.strictEqual(signals.filesChanged, 0);
      assert.strictEqual(signals.executionMs, 0);
    });
  });

  describe("computeEffectiveness()", () => {
    it("uses artifact score as base", () => {
      const score = computeEffectiveness({ artifactScore: 9.0 });
      assert.ok(score >= 9.0, `Expected >= 9.0, got ${score}`);
    });

    it("penalizes retries", () => {
      const noRetry = computeEffectiveness({ artifactScore: 8.0, retryCount: 0 });
      const withRetry = computeEffectiveness({ artifactScore: 8.0, retryCount: 2 });
      assert.ok(noRetry > withRetry, "retries should lower score");
    });

    it("bonus for first-attempt pass", () => {
      const firstAttempt = computeEffectiveness({
        artifactScore: 8.0,
        artifactPass: true,
        retryCount: 0,
      });
      const secondAttempt = computeEffectiveness({
        artifactScore: 8.0,
        artifactPass: true,
        retryCount: 1,
      });
      assert.ok(firstAttempt > secondAttempt);
    });

    it("reject verdict caps score", () => {
      const score = computeEffectiveness({
        artifactScore: 9.0,
        userVerdict: "reject",
      });
      assert.ok(score <= 3.0, `Expected <= 3.0, got ${score}`);
    });

    it("accept verdict floors score", () => {
      const score = computeEffectiveness({
        artifactScore: 4.0,
        userVerdict: "accept",
      });
      assert.ok(score >= 7.0, `Expected >= 7.0, got ${score}`);
    });

    it("clamps to 0-10 range", () => {
      const low = computeEffectiveness({ artifactScore: 0, retryCount: 5, postCorrectionEdits: 10 });
      const high = computeEffectiveness({ artifactScore: 10, artifactPass: true, retryCount: 0 });
      assert.ok(low >= 0);
      assert.ok(high <= 10);
    });
  });

  describe("collectGitSignals()", () => {
    it("returns an object with postCorrectionEdits key", () => {
      // Run in current repo — should at least return a signals object
      const signals = collectGitSignals(process.cwd());
      assert.strictEqual(typeof signals, "object");
      // postCorrectionEdits should be a number (0 or more) when in a git repo
      if (signals.postCorrectionEdits !== undefined) {
        assert.strictEqual(typeof signals.postCorrectionEdits, "number");
        assert.ok(signals.postCorrectionEdits >= 0);
      }
    });

    it("returns empty signals for non-git directory", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-nogit-"));
      try {
        const signals = collectGitSignals(tmpDir);
        assert.strictEqual(typeof signals, "object");
        // Should not have git signals in a non-git dir
        assert.strictEqual(signals.filesChanged, undefined);
        assert.strictEqual(signals.postCorrectionEdits, undefined);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("trimOutcomes()", () => {
    it("trims ledger to maxEntries keeping most recent", () => {
      const store = tmpStore();
      stores.push(store);
      for (let i = 0; i < 20; i++) {
        store.writeOutcome(sampleOutcome({ runId: `rpt-trim-${i}` }));
      }
      // Force trim to 10
      store.trimOutcomes(10);
      const outcomes = store.readOutcomes();
      assert.strictEqual(outcomes.length, 10);
      // Should keep the last 10 (rpt-trim-10 through rpt-trim-19)
      assert.strictEqual(outcomes[0].runId, "rpt-trim-10");
      assert.strictEqual(outcomes[9].runId, "rpt-trim-19");
    });

    it("no-ops when entries are within limit", () => {
      const store = tmpStore();
      stores.push(store);
      for (let i = 0; i < 3; i++) {
        store.writeOutcome(sampleOutcome({ runId: `rpt-small-${i}` }));
      }
      store.trimOutcomes(500);
      assert.strictEqual(store.readOutcomes().length, 3);
    });

    it("auto-trims on writeOutcome when ledger exceeds default max", () => {
      const store = tmpStore();
      stores.push(store);
      // Write 505 outcomes (exceeds default 500)
      const lines = [];
      for (let i = 0; i < 505; i++) {
        const o = sampleOutcome({ runId: `rpt-auto-${i}` });
        const validated = validateOutcome(o);
        lines.push(JSON.stringify(validated.outcome));
      }
      // Write all at once, then one more via writeOutcome to trigger trim
      fs.mkdirSync(path.dirname(store.filePath), { recursive: true });
      fs.writeFileSync(store.filePath, lines.join("\n") + "\n", "utf8");
      // Now write one more to trigger auto-trim
      store.writeOutcome(sampleOutcome({ runId: "rpt-auto-final" }));
      const outcomes = store.readOutcomes();
      assert.ok(outcomes.length <= 500, `Expected <= 500, got ${outcomes.length}`);
      assert.strictEqual(outcomes[outcomes.length - 1].runId, "rpt-auto-final");
    });

    it("uses atomic write (temp file does not linger)", () => {
      const store = tmpStore();
      stores.push(store);
      for (let i = 0; i < 10; i++) {
        store.writeOutcome(sampleOutcome({ runId: `rpt-atomic-${i}` }));
      }
      store.trimOutcomes(5);
      // Temp file should not exist after trim
      assert.strictEqual(fs.existsSync(`${store.filePath}.tmp`), false);
    });
  });

  describe("injectExemplar()", () => {
    it("writes exemplar outcome with source field preserved", () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-inject-test-"));
      stores.push({ dirPath: dir, clear() { fs.rmSync(dir, { recursive: true, force: true }); } });

      const exemplar = {
        runId: "rpt-reverse-test-1",
        taskId: "reverse-code-review-test",
        recipe: fingerprint({
          templateId: "bugfix-template",
          patterns: ["reverse-extraction"],
          capabilityTier: "reasoning_high",
          domain: "security",
          contextLayers: 1,
          qualityScore: 8.5,
        }),
        signals: {
          artifactScore: 8.5,
          artifactPass: true,
          retryCount: 0,
          userVerdict: "accept",
          source: "reverse-exemplar",
        },
        effectivenessScore: 9.0,
      };

      const result = injectExemplar(exemplar, { dirPath: dir });
      assert.ok(result);
      assert.equal(result.signals.source, "reverse-exemplar");
      assert.equal(result.signals.userVerdict, "accept");
      assert.equal(result.runId, "rpt-reverse-test-1");
    });

    it("defaults source to reverse-exemplar when not set", () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-inject-default-"));
      stores.push({ dirPath: dir, clear() { fs.rmSync(dir, { recursive: true, force: true }); } });

      const exemplar = {
        runId: "rpt-reverse-test-2",
        taskId: "reverse-default-source",
        recipe: fingerprint({
          templateId: "feature-template",
          patterns: ["reverse-extraction"],
          capabilityTier: "reasoning_high",
          domain: "general",
          contextLayers: 1,
          qualityScore: 7.0,
        }),
        signals: { artifactScore: 7.0, artifactPass: true, retryCount: 0 },
        effectivenessScore: 7.5,
      };

      const result = injectExemplar(exemplar, { dirPath: dir });
      assert.equal(result.signals.source, "reverse-exemplar");
    });

    it("throws for null exemplar", () => {
      assert.throws(
        () => injectExemplar(null),
        (err) => err.code === "EXEMPLAR_VALIDATION_ERROR"
      );
    });

    it("throws for non-object exemplar", () => {
      assert.throws(
        () => injectExemplar("not an object"),
        (err) => err.code === "EXEMPLAR_VALIDATION_ERROR"
      );
    });

    it("returns null when REPROMPTER_FLYWHEEL is disabled", () => {
      const original = process.env.REPROMPTER_FLYWHEEL;
      try {
        process.env.REPROMPTER_FLYWHEEL = "0";
        const result = injectExemplar({ runId: "test", taskId: "test", recipe: {}, signals: {} });
        assert.equal(result, null);
      } finally {
        if (original === undefined) {
          delete process.env.REPROMPTER_FLYWHEEL;
        } else {
          process.env.REPROMPTER_FLYWHEEL = original;
        }
      }
    });
  });

  describe("v1 record bridge", () => {
    function sampleV1(overrides = {}) {
      return {
        schema_version: 1,
        timestamp: "2026-04-17T00:00:00Z",
        prompt_fingerprint: "sha256:deadbeef",
        prompt_text: "<role>x</role>\n<context>ctx</context>\n<task>fix</task>",
        task_type: "fix_bug",
        mode: "single",
        success_criteria: [],
        output_text: "patched",
        verification_results: { a: "pass", b: "fail", c: "skipped" },
        score: 5,
        notes: "",
        ...overrides,
      };
    }

    it("v1RecordToFlywheelOutcome maps fields to the flywheel shape", () => {
      const out = v1RecordToFlywheelOutcome(sampleV1());
      assert.equal(out.runId, "sha256:deadbeef");
      assert.equal(out.taskId, "fix_bug");
      assert.equal(out.recipe.vector.templateId, "fix_bug");
      assert.equal(out.recipe.vector.contextLayers, 1);
      assert.equal(out.signals.artifactScore, 5);
      assert.equal(out.signals.artifactPass, false);
      assert.equal(out.signals.source, "flywheel-ingest-v1");
      assert.ok(out.recipe.hash, "recipe.hash must be set by fingerprint()");
    });

    it("v1RecordToFlywheelOutcome marks artifactPass true for score >= 7", () => {
      const out = v1RecordToFlywheelOutcome(sampleV1({ score: 8 }));
      assert.equal(out.signals.artifactPass, true);
      assert.equal(out.signals.artifactScore, 8);
    });

    it("v1RecordToFlywheelOutcome throws on missing prompt_fingerprint", () => {
      assert.throws(
        () => v1RecordToFlywheelOutcome({ ...sampleV1(), prompt_fingerprint: undefined }),
        /missing prompt_fingerprint/
      );
    });

    it("ingestOutcomeRecord writes a valid outcome to the store", () => {
      const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-ingest-test-"));
      try {
        const stored = ingestOutcomeRecord(sampleV1(), { rootDir });
        assert.equal(stored.runId, "sha256:deadbeef");
        assert.equal(stored.taskId, "fix_bug");
        assert.ok(Number.isFinite(stored.effectivenessScore));
      } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    });

    it("ingestDirectory processes every v1 record and reports errors", () => {
      const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-ingest-dir-test-"));
      const sourceDir = path.join(rootDir, ".reprompter", "outcomes");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "good.json"), JSON.stringify(sampleV1()));
      fs.writeFileSync(path.join(sourceDir, "bad.json"), "{not json");
      fs.writeFileSync(
        path.join(sourceDir, "unknown-schema.json"),
        JSON.stringify({ schema_version: 99, prompt_fingerprint: "sha256:x" })
      );

      try {
        const result = ingestDirectory(sourceDir, { rootDir });
        assert.equal(result.ingested, 1);
        assert.equal(result.skipped, 2);
        assert.equal(result.errors.length, 2);
        assert.ok(result.errors.some((e) => /unsupported schema_version/.test(e.reason)));
      } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    });

    it("ingestDirectory returns empty result when directory doesn't exist", () => {
      const result = ingestDirectory("/nonexistent/dir/nope", { rootDir: "/tmp" });
      assert.equal(result.ingested, 0);
      assert.equal(result.skipped, 0);
      assert.deepEqual(result.errors, []);
    });
  });
});
