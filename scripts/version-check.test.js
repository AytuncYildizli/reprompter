"use strict";

// Pin the repo to the default BEFORE requiring the module: REPO (and thus the
// repo-scoped cache check) is resolved at module load, so an externally-set
// REPROMPTER_REPO would otherwise make the repo-less cache fixtures be ignored
// and break the cache-hit assertions. Subprocess tests set their own env.
process.env.REPROMPTER_REPO = "AytuncYildizli/reprompter";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  parseVersion,
  compareVersions,
  readLocalVersion,
  formatNotice,
  checkVersion,
  isPluginInstall,
} = require("./version-check");

const PLUGIN_MIGRATION_TIP =
  "Claude Code users: RePrompter is now installable as a plugin (auto-updates + automatic ambient-gate setup): /plugin marketplace add AytuncYildizli/reprompter, then /plugin install reprompter@reprompter - and remove this copy afterwards so it does not shadow the plugin skill.";

function tmpFile(name, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-vc-"));
  const file = path.join(dir, name);
  if (contents != null) fs.writeFileSync(file, contents, "utf8");
  return file;
}

test("parseVersion tolerates leading v and trailing text, rejects junk", () => {
  assert.deepEqual(parseVersion("v12.6.0"), [12, 6, 0]);
  assert.deepEqual(parseVersion("12.6.0 — title"), [12, 6, 0]);
  assert.equal(parseVersion("not-a-version"), null);
  assert.equal(parseVersion(undefined), null);
});

test("compareVersions orders by major.minor.patch and returns null on bad input", () => {
  assert.equal(compareVersions("12.5.1", "12.6.0"), -1);
  assert.equal(compareVersions("12.6.0", "12.6.0"), 0);
  assert.equal(compareVersions("12.7.0", "12.6.0"), 1);
  assert.equal(compareVersions("12.6.0", "12.10.0"), -1); // numeric, not lexical
  assert.equal(compareVersions("x", "12.6.0"), null);
});

test("readLocalVersion extracts metadata.version from SKILL.md frontmatter", () => {
  const file = tmpFile(
    "SKILL.md",
    "---\nname: reprompter\nmetadata:\n  author: x\n  version: 12.6.0\n---\n# body\n"
  );
  assert.equal(readLocalVersion(file), "12.6.0");
  assert.equal(readLocalVersion(path.join(os.tmpdir(), "does-not-exist-xyz.md")), null);
});

test("checkVersion: local behind latest -> behind + path-aware actionable notice", async () => {
  const r = await checkVersion({
    local: "12.5.1",
    fetchLatest: async () => "12.6.0",
    useCache: false,
    installDir: "/home/u/.codex/skills/reprompter",
  });
  assert.equal(r.behind, true);
  assert.equal(r.latest, "12.6.0");
  assert.ok(r.notice.includes("12.5.1"));
  assert.ok(r.notice.includes("12.6.0"));
  assert.ok(/new session/i.test(r.notice)); // the per-session cache caveat
  assert.ok(r.notice.includes("tar xz")); // concrete upgrade command
  assert.ok(r.notice.includes("/home/u/.codex/skills/reprompter")); // targets the real install dir, any runtime
  assert.ok(r.notice.includes(PLUGIN_MIGRATION_TIP), "behind notice includes Claude Code plugin migration tip");
});

test("checkVersion: equal version -> not behind, no notice", async () => {
  const r = await checkVersion({
    local: "12.6.0",
    fetchLatest: async () => "12.6.0",
    useCache: false,
  });
  assert.equal(r.behind, false);
  assert.equal(r.notice, null);
  assert.equal(String(r.notice).includes(PLUGIN_MIGRATION_TIP), false);
});

test("checkVersion: local ahead of latest -> not behind", async () => {
  const r = await checkVersion({
    local: "12.7.0",
    fetchLatest: async () => "12.6.0",
    useCache: false,
  });
  assert.equal(r.behind, false);
  assert.equal(r.notice, null);
});

test("checkVersion: network failure (null latest) is fail-soft, never throws", async () => {
  const r = await checkVersion({
    local: "12.5.1",
    fetchLatest: async () => null,
    useCache: false,
  });
  assert.equal(r.behind, false);
  assert.equal(r.latest, null);
  assert.equal(r.notice, null);
});

test("checkVersion: fresh cache short-circuits the network", async () => {
  const cacheFile = tmpFile("vc.json", JSON.stringify({ checkedAt: 1000, latest: "12.6.0" }));
  let fetched = false;
  const r = await checkVersion({
    local: "12.5.1",
    now: 1000 + 60 * 1000, // 1 min later, well within TTL
    cacheFile,
    fetchLatest: async () => {
      fetched = true;
      return "99.0.0";
    },
  });
  assert.equal(fetched, false, "should not hit network on a fresh cache");
  assert.equal(r.fromCache, true);
  assert.equal(r.latest, "12.6.0");
  assert.equal(r.behind, true);
});

test("checkVersion: stale cache falls through to the network and rewrites cache", async () => {
  const cacheFile = tmpFile("vc.json", JSON.stringify({ checkedAt: 1000, latest: "12.5.0" }));
  const now = 1000 + 25 * 60 * 60 * 1000; // 25h later -> past TTL
  const r = await checkVersion({
    local: "12.5.1",
    now,
    cacheFile,
    fetchLatest: async () => "12.6.0",
  });
  assert.equal(r.fromCache, false);
  assert.equal(r.latest, "12.6.0");
  const written = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  assert.equal(written.latest, "12.6.0");
  assert.equal(written.checkedAt, now);
});

test("checkVersion: a failed lookup is negatively cached, then throttles repeat network hits", async () => {
  const cacheFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rpt-vc-")), "neg.json");
  let calls = 0;
  const fetchLatest = async () => {
    calls += 1;
    return null; // network unavailable
  };
  const r1 = await checkVersion({ local: "12.5.1", now: 1000, cacheFile, fetchLatest });
  assert.equal(r1.latest, null);
  assert.equal(calls, 1);
  const written = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  assert.equal(written.latest, null, "failure recorded as a negative cache entry");
  assert.equal(written.checkedAt, 1000);

  // A new session 5 min later must not repeat the network hit.
  const r2 = await checkVersion({ local: "12.5.1", now: 1000 + 5 * 60 * 1000, cacheFile, fetchLatest });
  assert.equal(calls, 1, "negative cache throttles retries within the neg-TTL");
  assert.equal(r2.fromCache, true);
  assert.equal(r2.behind, false);
});

test("checkVersion: negative cache expires after the shorter neg-TTL and retries", async () => {
  const cacheFile = tmpFile(
    "neg.json",
    JSON.stringify({ checkedAt: 1000, latest: null, repo: "AytuncYildizli/reprompter" })
  );
  let calls = 0;
  const r = await checkVersion({
    local: "12.5.1",
    now: 1000 + 2 * 60 * 60 * 1000, // 2h later -> past the 1h neg-TTL
    cacheFile,
    fetchLatest: async () => {
      calls += 1;
      return "12.6.0";
    },
  });
  assert.equal(calls, 1, "expired negative cache retries the network");
  assert.equal(r.latest, "12.6.0");
  assert.equal(r.behind, true);
});

test("CLI --json with injected latest reports behind without touching the network", () => {
  const res = spawnSync(process.execPath, [path.join(__dirname, "version-check.js"), "--json", "--no-cache"], {
    encoding: "utf8",
    // Force the opt-out off so the test is hermetic even if CI sets it to "0".
    env: { ...process.env, REPROMPTER_VERSION_CHECK: "1", REPROMPTER_VERSION_LATEST: "99.0.0" },
  });
  assert.equal(res.status, 0, "version check must exit 0 (never fail a gate)");
  const out = JSON.parse(res.stdout);
  assert.equal(out.behind, true);
  assert.equal(out.latest, "99.0.0");
  assert.ok(parseVersion(out.local), "reads the real local SKILL.md version");
});

test("CLI is silent (no output) when up to date — default path prints only if behind", () => {
  const local = readLocalVersion();
  const res = spawnSync(process.execPath, [path.join(__dirname, "version-check.js"), "--no-cache"], {
    encoding: "utf8",
    // Force the opt-out off so this exercises the up-to-date path, not the opt-out.
    env: { ...process.env, REPROMPTER_VERSION_CHECK: "1", REPROMPTER_VERSION_LATEST: local },
  });
  assert.equal(res.status, 0);
  assert.equal(res.stdout.trim(), "", "an up-to-date install must produce no stdout noise");
});

test("CLI honors REPROMPTER_VERSION_CHECK=0 (silent no-op even when behind)", () => {
  const res = spawnSync(process.execPath, [path.join(__dirname, "version-check.js"), "--no-cache"], {
    encoding: "utf8",
    env: { ...process.env, REPROMPTER_VERSION_LATEST: "99.0.0", REPROMPTER_VERSION_CHECK: "0" },
  });
  assert.equal(res.status, 0);
  assert.equal(res.stdout.trim(), "", "opt-out must suppress all output on direct invocation");
});

test("CLI is silent inside a Claude Code plugin layout", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-vc-plugin-"));
  const skillRoot = path.join(tempRoot, "skills", "reprompter");
  fs.mkdirSync(path.join(tempRoot, ".claude-plugin"), { recursive: true });
  fs.mkdirSync(path.join(skillRoot, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, ".claude-plugin", "plugin.json"), '{"name":"reprompter"}\n', "utf8");
  fs.copyFileSync(path.join(__dirname, "version-check.js"), path.join(skillRoot, "scripts", "version-check.js"));

  assert.equal(isPluginInstall(skillRoot), true);

  const res = spawnSync(process.execPath, [path.join(skillRoot, "scripts", "version-check.js"), "--no-cache"], {
    encoding: "utf8",
    env: { ...process.env, REPROMPTER_VERSION_CHECK: "1", REPROMPTER_VERSION_LATEST: "99.0.0" },
  });
  assert.equal(res.status, 0);
  assert.equal(res.stdout.trim(), "", "plugin installs rely on native plugin updates, not curl|tar notices");
  assert.equal(res.stdout.includes(PLUGIN_MIGRATION_TIP), false, "plugin installs must not print migration tip");
});

test("CLI still prints stale notices near an unrelated Claude Code plugin layout", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-vc-plugin-false-positive-"));
  const skillRoot = path.join(tempRoot, "skills", "reprompter");
  fs.mkdirSync(path.join(tempRoot, ".claude-plugin"), { recursive: true });
  fs.mkdirSync(path.join(skillRoot, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, ".claude-plugin", "plugin.json"), '{"name":"other-plugin"}\n', "utf8");
  fs.writeFileSync(
    path.join(skillRoot, "SKILL.md"),
    "---\nname: reprompter\nmetadata:\n  version: 12.8.0\n---\n",
    "utf8"
  );
  fs.copyFileSync(path.join(__dirname, "version-check.js"), path.join(skillRoot, "scripts", "version-check.js"));

  assert.equal(isPluginInstall(skillRoot), false);

  const res = spawnSync(process.execPath, [path.join(skillRoot, "scripts", "version-check.js"), "--no-cache"], {
    encoding: "utf8",
    env: { ...process.env, REPROMPTER_VERSION_CHECK: "1", REPROMPTER_VERSION_LATEST: "99.0.0" },
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /reprompter 12\.8\.0 is behind the latest release 99\.0\.0/);
  assert.ok(res.stdout.includes(PLUGIN_MIGRATION_TIP), "copy installs still get the plugin migration tip");
});

test("CLI sanitizes a junk REPROMPTER_REPO back to the default in the printed command", () => {
  const res = spawnSync(process.execPath, [path.join(__dirname, "version-check.js"), "--json", "--no-cache"], {
    encoding: "utf8",
    env: { ...process.env, REPROMPTER_VERSION_CHECK: "1", REPROMPTER_VERSION_LATEST: "99.0.0", REPROMPTER_REPO: "evil$(touch x)/repo" },
  });
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.ok(out.notice.includes("github.com/AytuncYildizli/reprompter"), "falls back to default repo");
  assert.ok(!out.notice.includes("evil$(touch x)"), "never echoes an unsafe repo");
});

test("checkVersion: cache from a different repo is ignored (repo-scoped)", async () => {
  const cacheFile = tmpFile("vc.json", JSON.stringify({ checkedAt: 1000, latest: "99.0.0", repo: "other/fork" }));
  let fetched = false;
  const r = await checkVersion({
    local: "12.5.1",
    now: 1000 + 60 * 1000,
    cacheFile,
    fetchLatest: async () => {
      fetched = true;
      return "12.6.0";
    },
  });
  assert.equal(fetched, true, "must not reuse another repo's cached latest");
  assert.equal(r.latest, "12.6.0");
});

test("checkVersion: fetchLatest that throws stays fail-soft (never rejects)", async () => {
  const r = await checkVersion({
    local: "12.5.1",
    useCache: false,
    fetchLatest: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(r.behind, false);
  assert.equal(r.latest, null);
  assert.equal(r.notice, null);
});

test("formatNotice single-quotes the install dir so shell metacharacters can't expand", () => {
  const n = formatNotice("12.5.1", "12.6.0", "/tmp/$(touch pwned)/reprompter");
  assert.ok(n.includes("-C '/tmp/$(touch pwned)/reprompter'"), "path is single-quoted verbatim");
  assert.ok(!/-C\s+\/tmp\/\$\(/.test(n), "never emits an unquoted $(...) path");
});

test("formatNotice is a single actionable block with a path-aware upgrade command", () => {
  const n = formatNotice("12.5.1", "12.6.0", "/ws/skills/reprompter");
  assert.ok(n.startsWith("⚠ reprompter 12.5.1 is behind"));
  assert.ok(n.includes("releases/latest"));
  assert.ok(n.includes("curl -sL"));
  assert.ok(n.includes("-C '/ws/skills/reprompter'")); // re-fetch targets the detected dir (shell-safe quoted)
  assert.ok(/hermes skills install/.test(n)); // the no-scripts/ runtime fallback
});
