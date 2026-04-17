#!/usr/bin/env node
// Validate SKILL.md and reference templates for obsolete tool signatures.
//
// Supersedes scripts/validate-tool-refs.sh (which was line-based and
// missed tool calls formatted across multiple lines). This version reads
// each target file whole, so patterns can span newlines — matching the
// way Agent(...), SendMessage(...), etc. are actually formatted in
// SKILL.md today.
//
// Exit 0 = clean, exit 1 = drift detected. Slots next to
// scripts/validate-templates.sh in the validation toolchain.
//
// Adding a new check:
//   1. Append a { name, pattern, files } entry to CHECKS below.
//   2. Write the pattern as a regex literal with the /s flag so `.` and
//      negated character classes cross newlines without ceremony.
//   3. Cross-reference the PR or issue that introduced or fixed the
//      pattern so the rationale doesn't rot.
//   4. Run against a known-bad fixture to confirm the regex catches only
//      what you intend (including the multi-line formatting variants).

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");

const CHECKS = [
  {
    name: "Obsolete Task(subagent_type=...) spawn — use Agent(...) instead (PR #23)",
    // Task( ... subagent_type ... ) — may span lines.
    pattern: /Task\s*\([^)]*?\bsubagent_type\s*=/s,
    files: ["SKILL.md", "references"],
  },
  {
    name: "Pre-2.1 SendMessage(type=/recipient=) keyword arguments (PR #25)",
    // SendMessage( ... type= or recipient= as kwargs ) — may span lines.
    pattern: /SendMessage\s*\([^)]*?(?:\btype\s*=|\brecipient\s*=)/s,
    files: ["SKILL.md", "references"],
  },
  {
    name: "Broadcast SendMessage with structured payload (rejected at runtime; PR #27)",
    // SendMessage( to="*" ... message={ ... } ) — may span lines.
    pattern: /SendMessage\s*\(\s*to\s*=\s*"\*"[^)]*?message\s*=\s*\{/s,
    files: ["SKILL.md", "references"],
  },
  {
    name: "Claude Flow / mcp__claude-flow__ references (foreign MCP, PR #26)",
    pattern: /Claude[ -]Flow|mcp__claude-flow__/,
    files: ["SKILL.md", "references"],
  },
  {
    name: "Hardcoded model version strings (use 'opus'/'sonnet'/'haiku' aliases instead)",
    // Any claude-<family>-<major>-<minor> is a hardcoded pin. The CLI
    // resolves the bare alias to whatever is current, so hardcoded forms
    // freeze in time. Unconditionally banned in skill-side files.
    pattern: /\bclaude-(?:opus|sonnet|haiku)-\d+-\d+\b/,
    files: ["SKILL.md", "references", "scripts"],
  },
];

const SCANNABLE_EXT = new Set([".md", ".js", ".sh"]);

function walk(spec) {
  const full = path.join(REPO_ROOT, spec);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];

  const out = [];
  const stack = [full];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(p);
      } else if (SCANNABLE_EXT.has(path.extname(entry.name))) {
        out.push(p);
      }
    }
  }
  return out;
}

function excludeSelf(files) {
  // The linter references the obsolete patterns in its own documentation
  // comments, which would otherwise self-trigger every check. Keep the
  // linter source out of its own scan set.
  const self = path.resolve(__filename);
  return files.filter((f) => path.resolve(f) !== self);
}

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function snippet(matchText) {
  return matchText.replace(/\s+/g, " ").trim().slice(0, 80);
}

function findAll(content, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const re = new RegExp(pattern.source, flags);
  const hits = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    hits.push({ line: lineOf(content, m.index), text: snippet(m[0]) });
    if (m[0].length === 0) re.lastIndex++;
  }
  return hits;
}

function main() {
  console.log("Validating tool references in SKILL.md + references/ + scripts/ ...\n");

  let failCount = 0;

  for (const check of CHECKS) {
    const targets = excludeSelf(check.files.flatMap(walk));
    const allHits = [];
    for (const file of targets) {
      const content = fs.readFileSync(file, "utf8");
      for (const hit of findAll(content, check.pattern)) {
        allHits.push({
          file: path.relative(REPO_ROOT, file),
          line: hit.line,
          text: hit.text,
        });
      }
    }
    if (allHits.length > 0) {
      console.log(`FAIL: ${check.name}`);
      for (const hit of allHits) {
        console.log(`  ${hit.file}:${hit.line}: ${hit.text}`);
      }
      console.log("");
      failCount += allHits.length;
    }
  }

  if (failCount === 0) {
    console.log("OK: no tool-reference drift detected.");
    process.exit(0);
  }
  console.log(`FAIL: ${failCount} drift match(es). Fix the matches above.`);
  process.exit(1);
}

main();
