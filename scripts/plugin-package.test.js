"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

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

test("plugin hook uses CLAUDE_PLUGIN_ROOT and resolves to a generated script", () => {
  const hooksJson = readJson("plugin/hooks/hooks.json");
  const command = hooksJson.hooks.UserPromptSubmit[0].hooks[0].command;

  assert.equal(hooksJson.hooks.UserPromptSubmit[0].hooks[0].type, "command");
  assert.ok(command.includes("${CLAUDE_PLUGIN_ROOT}"));
  const resolved = command
    .replace(/^node\s+/, "")
    .replace(/^"|"$/g, "")
    .replace("${CLAUDE_PLUGIN_ROOT}", pluginRoot);
  assert.ok(fs.existsSync(resolved), `missing generated hook script: ${resolved}`);
});

test("plugin hook manifest matches the documented shape exactly", () => {
  const hooksJson = readJson("plugin/hooks/hooks.json");

  assert.deepEqual(hooksJson, {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: 'node "${CLAUDE_PLUGIN_ROOT}/skills/reprompter/scripts/prompt-gate.js"',
            },
          ],
        },
      ],
    },
  });
});

test("plugin skill is byte-identical to root SKILL.md", () => {
  const rootSkill = fs.readFileSync(path.join(repoRoot, "SKILL.md"));
  const pluginSkill = fs.readFileSync(path.join(pluginRoot, "skills/reprompter/SKILL.md"));

  assert.deepEqual(pluginSkill, rootSkill);
});

test("plugin package includes references and prompt-gate runtime dependencies", () => {
  assert.ok(fs.existsSync(path.join(pluginRoot, "skills/reprompter/references/runtime/codex-runtime.md")));
  assert.ok(fs.existsSync(path.join(pluginRoot, "skills/reprompter/scripts/prompt-gate.js")));
  assert.ok(fs.existsSync(path.join(pluginRoot, "skills/reprompter/scripts/telemetry-store.js")));
});

test("plugin package excludes tests and packaging scripts", () => {
  const files = listFiles(pluginRoot).map((file) => path.relative(pluginRoot, file));

  assert.equal(files.some((file) => /\.test\.js$/.test(file)), false, "plugin contains test files");
  assert.equal(files.some((file) => /(^|\/)package-.*\.(?:sh|js)$/.test(file)), false, "plugin contains package scripts");
  assert.equal(files.some((file) => /(^|\/)check-.*\.sh$/.test(file)), false, "plugin contains check scripts");
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
    env: { ...process.env, XDG_CACHE_HOME: cacheDir },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /<reprompter-ambient-gate>/);
});

test("generated prompt gate honors REPROMPTER_AMBIENT=0", () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-plugin-gate-off-"));
  const result = spawnSync(process.execPath, [path.join(pluginRoot, "skills/reprompter/scripts/prompt-gate.js")], {
    input: JSON.stringify({
      session_id: "plugin-test-off",
      prompt: "uhh build a crypto dashboard, maybe coingecko data, add caching, test it too",
    }),
    encoding: "utf8",
    env: { ...process.env, REPROMPTER_AMBIENT: "0", XDG_CACHE_HOME: cacheDir },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});
