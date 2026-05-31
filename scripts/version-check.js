#!/usr/bin/env node
// Tell a reprompter user when their installed copy is behind the latest release.
//
// reprompter is distributed copy-based (curl|tar, cp -R, `hermes skills install`)
// with no package manager tracking the installed version, so this is a PULL check:
// it reads the LOCAL version from the loaded SKILL.md frontmatter and asks GitHub
// for the LATEST published release, then compares.
//
// Design rules:
//   - FAIL-SOFT: any failure (offline, rate-limited, parse error, missing file)
//     resolves to "no notice" and exit 0. A version check must never block work
//     or add latency to a normal reprompter invocation.
//   - CACHED: the latest-release lookup is cached ~24h under XDG_CACHE_HOME so the
//     network is hit at most once per day per machine.
//   - INJECTABLE: now / local / fetchLatest / cacheFile are all overridable so the
//     tests never touch the network or the real cache.
//
// CLI:  node scripts/version-check.js [--json] [--no-cache]
// Env:  REPROMPTER_REPO            override owner/repo (default AytuncYildizli/reprompter)
//       REPROMPTER_VERSION_LATEST  short-circuit the network lookup with a fixed
//                                  version (manual override; also used by tests)

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");

const REPO = process.env.REPROMPTER_REPO || "AytuncYildizli/reprompter";
const SKILL_ROOT = path.join(__dirname, "..");
const SKILL_MD = path.join(SKILL_ROOT, "SKILL.md");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const NET_TIMEOUT_MS = 3000;

// Parse the first semver-looking triple out of a string. Returns [maj, min, pat]
// or null. Tolerates a leading "v" and surrounding text.
function parseVersion(str) {
  if (typeof str !== "string") return null;
  const m = str.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// -1 if a < b, 0 if equal, 1 if a > b. null if either side is unparseable
// (so callers can treat "unknown" as "do not warn").
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

// Read the version the running skill actually loaded: the metadata.version line
// in SKILL.md frontmatter (canonical for every runtime).
function readLocalVersion(skillPath = SKILL_MD) {
  try {
    const text = fs.readFileSync(skillPath, "utf8");
    const m = text.match(/^\s*version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function cachePath() {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "reprompter", "version-check.json");
}

function readCache(now, file = cachePath()) {
  try {
    const c = JSON.parse(fs.readFileSync(file, "utf8"));
    if (
      c &&
      typeof c.checkedAt === "number" &&
      now - c.checkedAt < CACHE_TTL_MS &&
      parseVersion(c.latest)
    ) {
      return c.latest;
    }
  } catch {
    /* missing / corrupt cache -> treat as no cache */
  }
  return null;
}

function writeCache(latest, now, file = cachePath()) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ checkedAt: now, latest }), "utf8");
  } catch {
    /* cache is best-effort; never fail the check on a write error */
  }
}

// Resolve the latest published release version (string, no leading "v") or null.
// Honors REPROMPTER_VERSION_LATEST as a manual/offline override before any network.
function fetchLatestFromGitHub() {
  const inject = process.env.REPROMPTER_VERSION_LATEST;
  if (inject) {
    return Promise.resolve(parseVersion(inject) ? inject.replace(/^v/, "") : null);
  }
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path: `/repos/${REPO}/releases/latest`,
        method: "GET",
        headers: {
          "User-Agent": "reprompter-version-check",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (d) => {
          body += d;
        });
        res.on("end", () => {
          try {
            const tag = JSON.parse(body).tag_name;
            resolve(parseVersion(tag) ? tag.replace(/^v/, "") : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(NET_TIMEOUT_MS, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

// Build the upgrade notice. `installDir` is where this skill copy actually
// lives (derived from __dirname), so the re-fetch command targets the right
// folder regardless of runtime — Claude Code, Codex, OpenClaw, Grok CLI, or a
// project-local `skills/reprompter/`. Hermes installs ship no `scripts/`, so
// this script never runs there; the `hermes skills install` line is the note
// for that one case.
function formatNotice(local, latest, installDir = SKILL_ROOT) {
  return [
    `⚠ reprompter ${local} is behind the latest release ${latest}.`,
    `  Upgrade in place (re-fetch into this install):`,
    `    curl -sL https://github.com/${REPO}/archive/main.tar.gz \\`,
    `      | tar xz --strip-components=1 -C ${JSON.stringify(installDir)}`,
    `  (Hermes installs: hermes skills install ${REPO}/skills/reprompter)`,
    `  Then start a NEW session — the skill is cached per session, so an in-place update won't apply until you do.`,
    `  Release notes: https://github.com/${REPO}/releases/latest`,
  ].join("\n");
}

// Orchestrator. Returns { local, latest, behind, fromCache, notice }.
// Never throws.
async function checkVersion(opts = {}) {
  const now = typeof opts.now === "number" ? opts.now : Date.now();
  const local = opts.local != null ? opts.local : readLocalVersion(opts.skillPath);
  const fetchLatest = opts.fetchLatest || fetchLatestFromGitHub;
  const useCache = opts.useCache !== false;

  let latest = useCache ? readCache(now, opts.cacheFile) : null;
  const fromCache = latest !== null;
  if (!latest) {
    latest = await fetchLatest();
    if (latest && useCache) writeCache(latest, now, opts.cacheFile);
  }

  const behind = compareVersions(local, latest) === -1;
  return {
    local: local || null,
    latest: latest || null,
    behind,
    fromCache,
    notice: behind ? formatNotice(local, latest, opts.installDir) : null,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const result = await checkVersion({ useCache: !argv.includes("--no-cache") });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.notice) {
    process.stdout.write(`${result.notice}\n`);
  } else if (result.latest && result.local) {
    process.stdout.write(`reprompter ${result.local} is up to date (latest ${result.latest}).\n`);
  }
  // else: couldn't determine -> stay silent (fail-soft)
  return 0; // a version check never fails a gate
}

module.exports = {
  parseVersion,
  compareVersions,
  readLocalVersion,
  formatNotice,
  checkVersion,
};

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}
