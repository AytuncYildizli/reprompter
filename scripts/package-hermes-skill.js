#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const REPO_ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(REPO_ROOT, "scripts", "hermes-sanitizer.json");
const OUT_DIR = path.join(REPO_ROOT, "skills", "reprompter");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureInsideRepo(relativePath) {
  const resolved = path.resolve(REPO_ROOT, relativePath);
  if (!resolved.startsWith(REPO_ROOT + path.sep)) {
    throw new Error(`Path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(relativePath, content) {
  const target = path.join(OUT_DIR, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function loadConfig() {
  const raw = readUtf8(CONFIG_PATH);
  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${path.relative(REPO_ROOT, CONFIG_PATH)} as JSON: ${error.message}`);
  }

  if (!Array.isArray(config.replacements)) {
    throw new Error("hermes-sanitizer.json must contain a replacements array");
  }
  if (!Array.isArray(config.references)) {
    throw new Error("hermes-sanitizer.json must contain a references array");
  }
  if (!config.tested_hermes?.commit || !config.tested_hermes?.version) {
    throw new Error("hermes-sanitizer.json must pin tested_hermes.version and tested_hermes.commit");
  }
  return { config, raw };
}

function applyReplacements(content, replacements) {
  let result = content;
  for (const rule of replacements) {
    if (!rule || typeof rule.pattern !== "string" || typeof rule.replacement !== "string") {
      throw new Error(`Invalid sanitizer rule: ${JSON.stringify(rule)}`);
    }

    if (rule.kind === "regex") {
      result = result.replace(new RegExp(rule.pattern, rule.flags || "g"), rule.replacement);
    } else if (rule.kind === "literal") {
      result = result.split(rule.pattern).join(rule.replacement);
    } else {
      throw new Error(`Unsupported sanitizer rule kind: ${rule.kind}`);
    }
  }
  return result;
}

function copySanitizedFile(relativePath, replacements) {
  const source = ensureInsideRepo(relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing package input: ${relativePath}`);
  }
  const sanitized = applyReplacements(readUtf8(source), replacements);
  writeFile(relativePath, sanitized);
  return {
    path: relativePath,
    source_sha256: sha256(readUtf8(source)),
    generated_sha256: sha256(sanitized),
  };
}

function main() {
  const { config, raw: configRaw } = loadConfig();
  const rootSkill = readUtf8(path.join(REPO_ROOT, "SKILL.md"));
  const sanitizedSkill = applyReplacements(rootSkill, config.replacements);

  removeDir(OUT_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeFile("SKILL.md", sanitizedSkill);

  const packagedFiles = [
    {
      path: "SKILL.md",
      source_sha256: sha256(rootSkill),
      generated_sha256: sha256(sanitizedSkill),
    },
  ];

  for (const reference of config.references) {
    packagedFiles.push(copySanitizedFile(reference, config.replacements));
  }

  const manifest = {
    schema_version: 1,
    generated_by: "scripts/package-hermes-skill.js",
    packager_version: config.packager_version,
    package: "skills/reprompter",
    generated_at: new Date(0).toISOString(),
    tested_hermes: config.tested_hermes,
    source: {
      root_skill: "SKILL.md",
      root_skill_sha256: sha256(rootSkill),
      sanitizer: "scripts/hermes-sanitizer.json",
      sanitizer_sha256: sha256(configRaw),
    },
    files: packagedFiles,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Generated ${path.relative(REPO_ROOT, OUT_DIR)}`);
  console.log(`Packaged files: ${packagedFiles.length + 1}`);
  console.log(`Pinned Hermes Guard: ${config.tested_hermes.version} (${config.tested_hermes.commit})`);
}

main();
