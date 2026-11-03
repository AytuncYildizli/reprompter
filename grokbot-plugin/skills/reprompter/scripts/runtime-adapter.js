#!/usr/bin/env node
"use strict";

const { createOpenClawAdapter } = require("./runtime-adapter-openclaw");

function createSequentialAdapter(options = {}) {
  const base = createOpenClawAdapter(options);

  return {
    ...base,
    name: "sequential",
    supportsParallel() {
      return false;
    },
  };
}

function createRuntimeAdapter(runtime = "openclaw", options = {}) {
  const normalized = String(runtime || "openclaw").toLowerCase();
  if (normalized === "openclaw") {
    return createOpenClawAdapter(options);
  }
  if (normalized === "sequential") {
    return createSequentialAdapter(options);
  }

  return createSequentialAdapter(options);
}

module.exports = {
  createRuntimeAdapter,
  createSequentialAdapter,
};

if (require.main === module) {
  const runtime = process.argv[2] || "openclaw";
  const adapter = createRuntimeAdapter(runtime);
  process.stdout.write(
    `${JSON.stringify({ runtime: adapter.name, supportsParallel: adapter.supportsParallel() }, null, 2)}\n`
  );
}
