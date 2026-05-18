const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const test = require("node:test");
const packager = require("./package-hermes-skill.js");

const repoRoot = path.resolve(__dirname, "..");
const sanitizerPath = "scripts/hermes-sanitizer.json";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function sha256(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(repoRoot, relativePath)))
    .digest("hex");
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

test("Hermes sanitizer pins the tested Guard version", () => {
  const sanitizer = readJson(sanitizerPath);

  assert.equal(sanitizer.schema_version, 1);
  assert.equal(sanitizer.tested_hermes.version, "v0.14.0 (2026.5.16)");
  assert.equal(sanitizer.tested_hermes.commit, "1345dda0c");
  assert.ok(Array.isArray(sanitizer.replacements));
  assert.ok(sanitizer.replacements.length > 0);
});

test("generated Hermes package manifest matches source inputs", () => {
  const manifest = readJson("skills/reprompter/manifest.json");

  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.generated_by, "scripts/package-hermes-skill.js");
  assert.equal(manifest.tested_hermes.commit, "1345dda0c");
  assert.equal(manifest.source.root_skill_sha256, sha256("SKILL.md"));
  assert.equal(manifest.source.sanitizer, sanitizerPath);
  assert.equal(manifest.source.sanitizer_sha256, sha256(sanitizerPath));
  assert.ok(manifest.files.some((file) => file.path === "SKILL.md"));
  assert.ok(fs.existsSync(path.join(repoRoot, "skills/reprompter/SKILL.md")));
});

test("generated Hermes package does not contain sanitizer source patterns", () => {
  const sanitizer = readJson(sanitizerPath);
  const generatedFiles = listFiles(path.join(repoRoot, "skills/reprompter"));

  const generatedText = generatedFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const rule of sanitizer.replacements) {
    if (rule.kind === "literal") {
      assert.equal(generatedText.includes(rule.pattern), false, `generated package still contains ${rule.pattern}`);
    }
  }
});

test("generated Hermes package keeps shell snippets syntactically recognizable", () => {
  const generatedSkill = fs.readFileSync(path.join(repoRoot, "skills/reprompter/SKILL.md"), "utf8");
  const hermesRuntime = fs.readFileSync(
    path.join(repoRoot, "skills/reprompter/references/runtime/hermes-agent-runtime.md"),
    "utf8",
  );
  const generatedText = `${generatedSkill}\n${hermesRuntime}`;

  assert.equal(generatedText.includes("subshell("), false);
  assert.match(generatedText, /claude --version 2>\/dev\/null \\\| awk .* \\\| grep -Eq/);
  assert.match(generatedText, /done=`expr "\$done" \+ 1`/);
  assert.match(generatedText, /prompt_text=`cat "\$prompt_file"`/);
});

test("generated Hermes package has no broken package-local path references", () => {
  const packageRoot = path.join(repoRoot, "skills/reprompter");
  const markdownFiles = listFiles(packageRoot).filter((file) => file.endsWith(".md"));
  const localPathPattern = /`((?:references|scripts)\/[^`\s]+)`/g;
  const localMarkdownLinkPattern = /\[[^\]]+\]\(([^)#]+(?:\.md)?(?:#[^)]+)?)\)/g;

  for (const file of markdownFiles) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(localPathPattern)) {
      const referencedPath = match[1];
      if (referencedPath.includes("{") || referencedPath.includes("}")) {
        continue;
      }

      assert.equal(
        referencedPath.startsWith("scripts/"),
        false,
        `${path.relative(repoRoot, file)} references root-only script ${referencedPath}`,
      );
      assert.ok(
        fs.existsSync(path.join(packageRoot, referencedPath)),
        `${path.relative(repoRoot, file)} references missing package file ${referencedPath}`,
      );
    }

    for (const match of text.matchAll(localMarkdownLinkPattern)) {
      const target = match[1];
      if (/^[a-z]+:\/\//i.test(target) || target.startsWith("#")) {
        continue;
      }

      const targetPath = target.split("#")[0];
      if (!targetPath.endsWith(".md")) {
        continue;
      }

      assert.ok(
        fs.existsSync(path.join(path.dirname(file), targetPath)),
        `${path.relative(repoRoot, file)} links to missing package file ${target}`,
      );
    }
  }
});

test("packager rejects output path traversal", () => {
  assert.throws(() => packager.ensureInsideOutDir("../escape.md"), /Hermes package output directory/);
  assert.throws(() => packager.ensureInsideOutDir("/tmp/escape.md"), /Hermes package output directory/);
  assert.match(packager.ensureInsideOutDir("references/example.md"), /skills\/reprompter\/references\/example\.md$/);
});

test("Hermes Guard check never deletes a custom HERMES_AGENT_DIR", () => {
  const script = fs.readFileSync(path.join(repoRoot, "scripts/check-hermes-guard.sh"), "utf8");

  assert.match(script, /\[\[ -z "\$\{HERMES_AGENT_DIR:-\}" && ! -f "\$HERMES_DIR\/tools\/skills_guard\.py" \]\]/);
  assert.equal(script.includes('rm -rf "$HERMES_DIR"'), false);
});

test("Hermes Guard check rejects unpinned custom HERMES_AGENT_DIR", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-hermes-"));
  const hermesDir = path.join(tempRoot, "hermes-agent");

  try {
    fs.mkdirSync(path.join(hermesDir, "tools"), { recursive: true });
    fs.writeFileSync(path.join(hermesDir, "tools/skills_guard.py"), "# fake guard\n");

    execFileSync("git", ["init"], { cwd: hermesDir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: hermesDir, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: hermesDir, stdio: "ignore" });
    execFileSync("git", ["add", "tools/skills_guard.py"], { cwd: hermesDir, stdio: "ignore" });
    execFileSync("git", ["commit", "--no-gpg-sign", "-m", "fake guard"], { cwd: hermesDir, stdio: "ignore" });

    const result = spawnSync("bash", [path.join(repoRoot, "scripts/check-hermes-guard.sh")], {
      cwd: repoRoot,
      env: { ...process.env, HERMES_AGENT_DIR: hermesDir },
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected 1345dda0c/);
    assert.ok(fs.existsSync(path.join(hermesDir, "tools/skills_guard.py")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
