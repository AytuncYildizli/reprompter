#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateEvent } = require("./telemetry-schema");

function defaultTelemetryDir(rootDir = process.cwd()) {
  return path.join(rootDir, ".reprompter", "telemetry");
}

function createTelemetryStore(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const dirPath = options.dirPath || defaultTelemetryDir(rootDir);
  const filePath = options.filePath || path.join(dirPath, "events.ndjson");

  function ensureDir() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function writeEvent(input) {
    const result = validateEvent(input);
    if (!result.valid) {
      const error = new Error(`Invalid telemetry event: ${result.errors.join(" | ")}`);
      error.code = "TELEMETRY_VALIDATION_ERROR";
      error.details = result;
      throw error;
    }

    ensureDir();
    fs.appendFileSync(filePath, `${JSON.stringify(result.event)}\n`, "utf8");
    return result.event;
  }

  function readEvents(optionsRead = {}) {
    if (!fs.existsSync(filePath)) return [];

    const lines = fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let events = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const limit = Number(optionsRead.limit || 0);
    if (limit > 0 && events.length > limit) {
      events = events.slice(events.length - limit);
    }

    return events;
  }

  function clear() {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }

  return {
    rootDir,
    dirPath,
    filePath,
    writeEvent,
    readEvents,
    clear,
  };
}

module.exports = {
  createTelemetryStore,
  defaultTelemetryDir,
};

if (require.main === module) {
  const store = createTelemetryStore();
  process.stdout.write(`${JSON.stringify({ filePath: store.filePath }, null, 2)}\n`);
}
