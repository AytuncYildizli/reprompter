"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { isPluginScriptFile } = require("./package-plugin");

const repoRoot = path.resolve(__dirname, "..");
const pluginRoot = path.join(repoRoot, "plugin");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function gateEnv(cacheDir, overrides = {}) {
  return {
    ...process.env,
    REPROMPTER_AMBIENT: "1",
    REPROMPTER_TELEMETRY: "1",
    REPROMPTER_AMBIENT_THRESHOLD: "5",
    REPROMPTER_AMBIENT_COOLDOWN_MIN: "15",
    XDG_CACHE_HOME: cacheDir,
    ...overrides,
  };
}

test("plugin manifest matches package metadata and marketplace version", () => {
  const packageJson = readJson("package.json");
  const pluginJson = readJson("plugin/.claude-plugin/plugin.json");
  const marketplace = readJson(".claude-plugin/marketplace.json");

  assert.equal(pluginJson.name, "reprompter");
  assert.equal(pluginJson.description, packageJson.description);
  assert.equal(pluginJson.version, packageJson.version);
  assert.deepEqual(pluginJson.author, { name: "AytuncYildizli" });
  assert.equal(marketplace.name, "reprompter");
  assert.equal(marketplace.plugins[0].name, "reprompter");
  assert.equal(marketplace.plugins[0].source, "./plugin");
  assert.equal(marketplace.plugins[0].description, pluginJson.description);
  assert.equal(marketplace.plugins[0].version, pluginJson.version);
});

test("plugin ships with ambient hooks disabled by default", () => {
  const hooksJson = readJson("plugin/hooks/hooks.json");
  assert.deepEqual(hooksJson, { hooks: {} });
});

test("plugin skill is byte-identical to root SKILL.md", () => {
  const rootSkill = fs.readFileSync(path.join(repoRoot, "SKILL.md"));
  const pluginSkill = fs.readFileSync(path.join(pluginRoot, "skills/reprompter/SKILL.md"));

  assert.deepEqual(pluginSkill, rootSkill);
});

test("explicit /reprompter skill remains packaged when ambient hooks are off", () => {
  const pluginJson = readJson("plugin/.claude-plugin/plugin.json");
  const skillPath = path.join(pluginRoot, "skills/reprompter/SKILL.md");

  assert.equal(pluginJson.name, "reprompter");
  assert.ok(fs.existsSync(skillPath));
  assert.match(fs.readFileSync(skillPath, "utf8"), /^name:\s*reprompter$/m);
});

test("plugin package includes references and prompt-gate runtime dependencies", () => {
  assert.ok(fs.existsSync(path.join(pluginRoot, "skills/reprompter/references/runtime/codex-runtime.md")));
  assert.ok(fs.existsSync(path.join(pluginRoot, "skills/reprompter/scripts/prompt-gate.js")));
  assert.ok(fs.existsSync(path.join(pluginRoot, "skills/reprompter/scripts/stop-gate.js")));
  assert.ok(fs.existsSync(path.join(pluginRoot, "skills/reprompter/scripts/telemetry-store.js")));
});

test("plugin package excludes tests and packaging scripts", () => {
  const files = listFiles(pluginRoot).map((file) => path.relative(pluginRoot, file));

  assert.equal(files.some((file) => /\.test\.js$/.test(file)), false, "plugin contains test files");
  assert.equal(files.some((file) => /(^|\/)package-.*\.(?:sh|js)$/.test(file)), false, "plugin contains package scripts");
  assert.equal(files.some((file) => /(^|\/)check-.*\.sh$/.test(file)), false, "plugin contains check scripts");
});

test("plugin scripts exactly match the generator filter and exclude benchmark runners", () => {
  const rootScriptsDir = path.join(repoRoot, "scripts");
  const pluginScriptsDir = path.join(pluginRoot, "skills/reprompter/scripts");
  const expected = fs
    .readdirSync(rootScriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isPluginScriptFile(path.join("scripts", entry.name), entry))
    .map((entry) => entry.name)
    .sort();
  const actual = fs
    .readdirSync(pluginScriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(actual, expected);
  assert.equal(actual.filter((file) => /^run-.*-benchmark\.js$/.test(file)).length, 0);
});

test("generated plugin manifest directory contains only plugin.json", () => {
  const entries = fs.readdirSync(path.join(pluginRoot, ".claude-plugin")).sort();
  assert.deepEqual(entries, ["plugin.json"]);
});

test("generated prompt gate runs from the plugin package", () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-plugin-gate-"));
  const result = spawnSync(process.execPath, [path.join(pluginRoot, "skills/reprompter/scripts/prompt-gate.js")], {
    input: JSON.stringify({
      session_id: "plugin-test",
      prompt: "uhh build a crypto dashboard, maybe coingecko data, add caching, test it too",
    }),
    encoding: "utf8",
    env: gateEnv(cacheDir),
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /<reprompter-ambient-gate>/);
});

test("generated prompt gate stays off unless REPROMPTER_AMBIENT=1", () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-plugin-gate-off-"));
  const result = spawnSync(process.execPath, [path.join(pluginRoot, "skills/reprompter/scripts/prompt-gate.js")], {
    input: JSON.stringify({
      session_id: "plugin-test-off",
      prompt: "uhh build a crypto dashboard, maybe coingecko data, add caching, test it too",
    }),
    encoding: "utf8",
    env: gateEnv(cacheDir, { REPROMPTER_AMBIENT: "" }),
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});
