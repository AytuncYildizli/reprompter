#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const PLUGIN_DIR = path.join(REPO_ROOT, "plugin");
const PLUGIN_MANIFEST_DIR = path.join(PLUGIN_DIR, ".claude-plugin");
const PLUGIN_MANIFEST_PATH = path.join(PLUGIN_MANIFEST_DIR, "plugin.json");
const MARKETPLACE_DIR = path.join(REPO_ROOT, ".claude-plugin");
const MARKETPLACE_PATH = path.join(MARKETPLACE_DIR, "marketplace.json");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${path.relative(REPO_ROOT, filePath)} as JSON: ${error.message}`);
  }
}

function ensureInside(baseDir, relativePath, label) {
  const root = path.resolve(baseDir);
  const resolved = path.resolve(root, relativePath);
  if (resolved === root || !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes ${label}: ${relativePath}`);
  }
  return resolved;
}

function ensureInsideRepo(relativePath) {
  return ensureInside(REPO_ROOT, relativePath, "repository root");
}

function ensureInsidePlugin(relativePath) {
  return ensureInside(PLUGIN_DIR, relativePath, "plugin output directory");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function copyFile(sourceRelativePath, targetRelativePath) {
  const source = ensureInsideRepo(sourceRelativePath);
  const target = ensureInsidePlugin(targetRelativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing package input: ${sourceRelativePath}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function listDirectory(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}

function copyTree(sourceRelativeDir, targetRelativeDir, shouldInclude = () => true) {
  const sourceDir = ensureInsideRepo(sourceRelativeDir);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing package input directory: ${sourceRelativeDir}`);
  }

  const walk = (currentSource, currentTargetRelative) => {
    for (const entry of listDirectory(currentSource)) {
      const sourcePath = path.join(currentSource, entry.name);
      const targetPath = path.join(currentTargetRelative, entry.name);
      const sourceRelativePath = path.relative(REPO_ROOT, sourcePath);
      if (!shouldInclude(sourceRelativePath, entry)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(sourcePath, targetPath);
      } else if (entry.isFile()) {
        const target = ensureInsidePlugin(targetPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(sourcePath, target);
      }
    }
  };

  walk(sourceDir, targetRelativeDir);
}

function isPluginScriptFile(sourceRelativePath, entry) {
  if (entry.isDirectory()) {
    return true;
  }
  if (!entry.isFile()) {
    return false;
  }

  const fileName = path.basename(sourceRelativePath);
  if (/\.test\.js$/.test(fileName)) {
    return false;
  }
  if (/^package-.*\.(?:sh|js)$/.test(fileName)) {
    return false;
  }
  if (/^check-.*\.sh$/.test(fileName)) {
    return false;
  }
  return true;
}

function main() {
  const packageJson = readJson(path.join(REPO_ROOT, "package.json"));
  if (!packageJson.version || !packageJson.description) {
    throw new Error("package.json must contain version and description");
  }

  fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
  fs.mkdirSync(PLUGIN_MANIFEST_DIR, { recursive: true });

  writeJson(PLUGIN_MANIFEST_PATH, {
    name: "reprompter",
    description: packageJson.description,
    version: packageJson.version,
    author: { name: "AytuncYildizli" },
  });

  writeJson(path.join(PLUGIN_DIR, "hooks", "hooks.json"), {
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

  copyFile("SKILL.md", path.join("skills", "reprompter", "SKILL.md"));
  copyTree("references", path.join("skills", "reprompter", "references"));
  copyTree("scripts", path.join("skills", "reprompter", "scripts"), isPluginScriptFile);

  writeJson(MARKETPLACE_PATH, {
    name: "reprompter",
    owner: { name: "AytuncYildizli" },
    plugins: [
      {
        name: "reprompter",
        source: "./plugin",
        description: packageJson.description,
        version: packageJson.version,
      },
    ],
  });

  console.log(`Generated ${path.relative(REPO_ROOT, PLUGIN_DIR)}`);
  console.log(`Generated ${path.relative(REPO_ROOT, MARKETPLACE_PATH)}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  ensureInsideRepo,
  ensureInsidePlugin,
  isPluginScriptFile,
};
