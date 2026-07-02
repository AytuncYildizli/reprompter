#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

function checksum(input) {
  let hash = 0;
  const text = String(input || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function createOpenClawAdapter(options = {}) {
  const spawnFn = options.spawnFn;
  const stopFn = options.stopFn;
  const waitFn = options.waitFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const fileSystem = options.fs || fs;
  let sequence = 0;

  async function spawnAgent(taskPrompt, modelSpec = {}, label = "agent") {
    if (!taskPrompt || String(taskPrompt).trim().length === 0) {
      throw new Error("taskPrompt is required.");
    }

    const payload = {
      task: String(taskPrompt),
      model: modelSpec.model || modelSpec.id || "default",
      provider: modelSpec.provider || "unknown",
      label,
    };

    if (typeof spawnFn === "function") {
      const raw = await spawnFn(payload);
      return {
        runId: raw && raw.runId ? raw.runId : `openclaw-${Date.now()}-${++sequence}`,
        payload,
        raw,
      };
    }

    return {
      runId: `openclaw-${Date.now()}-${++sequence}`,
      payload,
      simulated: true,
    };
  }

  async function pollArtifacts(taskName, expectedArtifacts = [], pollPolicy = {}) {
    const artifacts = Array.isArray(expectedArtifacts) ? expectedArtifacts : [];
    const maxPolls = Number(pollPolicy.maxPolls || 40);
    const stableThreshold = Number(pollPolicy.stableThreshold || 3);
    const intervalMs = Number(pollPolicy.intervalMs || 0);

    if (artifacts.length === 0) {
      return {
        taskName,
        status: "completed",
        polls: 0,
        existingArtifacts: [],
        missingArtifacts: [],
      };
    }

    let previousSignature = "";
    let stablePolls = 0;

    for (let poll = 1; poll <= maxPolls; poll += 1) {
      const existingArtifacts = [];
      const missingArtifacts = [];
      const signatureParts = [];

      for (const filePath of artifacts) {
        if (fileSystem.existsSync(filePath)) {
          const content = fileSystem.readFileSync(filePath, "utf8");
          existingArtifacts.push(filePath);
          signatureParts.push(`${filePath}:${content.length}:${checksum(content)}`);
        } else {
          missingArtifacts.push(filePath);
        }
      }

      if (missingArtifacts.length === 0) {
        return {
          taskName,
          status: "completed",
          polls: poll,
          existingArtifacts,
          missingArtifacts,
        };
      }

      const signature = signatureParts.join("|");
      if (signature === previousSignature) {
        stablePolls += 1;
      } else {
        stablePolls = 0;
      }

      if (stablePolls >= stableThreshold) {
        return {
          taskName,
          status: "stalled",
          polls: poll,
          existingArtifacts,
          missingArtifacts,
        };
      }

      previousSignature = signature;
      if (intervalMs > 0) {
        // Wait is injectable for tests.
        await waitFn(intervalMs);
      }
    }

    const existingArtifacts = artifacts.filter((filePath) => fileSystem.existsSync(filePath));
    const missingArtifacts = artifacts.filter((filePath) => !fileSystem.existsSync(filePath));

    return {
      taskName,
      status: "timeout",
      polls: maxPolls,
      existingArtifacts,
      missingArtifacts,
    };
  }

  async function stopRun(runId) {
    if (!runId) {
      return { stopped: false, reason: "missing-run-id" };
    }

    if (typeof stopFn === "function") {
      const raw = await stopFn(runId);
      return { stopped: true, runId, raw };
    }

    return { stopped: true, runId, simulated: true };
  }

  function supportsParallel() {
    return true;
  }

  return {
    name: "openclaw",
    spawnAgent,
    pollArtifacts,
    stopRun,
    supportsParallel,
  };
}

module.exports = {
  createOpenClawAdapter,
};

if (require.main === module) {
  process.stdout.write("OpenClaw runtime adapter loaded.\n");
}
