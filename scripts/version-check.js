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

const DEFAULT_REPO = "AytuncYildizli/reprompter";

// REPROMPTER_REPO is interpolated into a request path AND into a copy-pasteable
// shell command, so constrain it to a strict owner/repo shape. Anything else
// (shell metacharacters, path-escaping, junk) falls back to the default — this
// is the security boundary for the printed upgrade command and the API URL.
function sanitizeRepo(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(value)
    ? value
    : DEFAULT_REPO;
}

const REPO = sanitizeRepo(process.env.REPROMPTER_REPO);
const SKILL_ROOT = path.join(__dirname, "..");
const SKILL_MD = path.join(SKILL_ROOT, "SKILL.md");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h for a successful lookup
const NEG_CACHE_TTL_MS = 60 * 60 * 1000; // 1h for a failed lookup (throttle retries without suppressing for a full day)
const NET_TIMEOUT_MS = 3000;

// POSIX single-quote escape: wrap in '...' and turn embedded ' into '\''.
// Single quotes neutralize $(), backticks, $VAR — so a copy-pasteable path
// can't trigger shell expansion no matter what it contains.
function shSingleQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

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

// Returns the fresh cache entry as { latest } (latest may be null for a
// negatively-cached failed lookup), or null when there's no usable entry.
// A null `latest` that is still fresh means "we recently failed — don't retry
// the network yet", which is how offline/restricted sessions avoid repeating
// the timeout. Positive and negative entries use different TTLs.
function readCache(now, file = cachePath()) {
  try {
    const c = JSON.parse(fs.readFileSync(file, "utf8"));
    // Cache must be repo-scoped: a fork / REPROMPTER_REPO override must not
    // reuse another repo's latest. Pre-repo cache entries (no `repo`) are
    // honored only for the default repo for backward compatibility.
    const repoMatches = c && (c.repo === REPO || (c.repo == null && REPO === DEFAULT_REPO));
    if (!repoMatches || typeof c.checkedAt !== "number") return null;
    const age = now - c.checkedAt;
    if (parseVersion(c.latest)) {
      if (age < CACHE_TTL_MS) return { latest: c.latest };
    } else if (c.latest === null && age < NEG_CACHE_TTL_MS) {
      return { latest: null }; // fresh negative entry -> skip the network
    }
  } catch {
    /* missing / corrupt cache -> treat as no cache */
  }
  return null;
}

function writeCache(latest, now, file = cachePath()) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Normalize to null so a failed lookup is recorded as a negative entry.
    fs.writeFileSync(file, JSON.stringify({ checkedAt: now, latest: latest ?? null, repo: REPO }), "utf8");
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
    `      | tar xz --strip-components=1 -C ${shSingleQuote(installDir)} \\`,
    `        --exclude='*/skills' --exclude='*/benchmarks' --exclude='*/assets'`,
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

  const cached = useCache ? readCache(now, opts.cacheFile) : null;
  const fromCache = cached !== null;
  let latest = cached ? cached.latest : null;
  if (!cached) {
    // fetchLatest can reject synchronously (e.g. an invalid request path);
    // keep the "never throws" contract by swallowing it into a null latest.
    try {
      latest = await fetchLatest();
    } catch {
      latest = null;
    }
    // Write even on failure: a negative entry throttles repeat network hits
    // (and the full ~3s timeout) for offline/restricted sessions.
    if (useCache) writeCache(latest, now, opts.cacheFile);
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
  // Honor the documented opt-out on every direct invocation (e.g. the README's
  // SessionStart hook), not just the skill-preflight path.
  if (process.env.REPROMPTER_VERSION_CHECK === "0") return 0;

  const json = argv.includes("--json");
  const result = await checkVersion({ useCache: !argv.includes("--no-cache") });

  if (json) {
    // --json is the explicit status mode: always emit the full result.
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.notice) {
    process.stdout.write(`${result.notice}\n`);
  }
  // Default (non-json) path prints ONLY when behind. Up-to-date and
  // can't-determine both stay silent, so a session hook adds no noise.
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
