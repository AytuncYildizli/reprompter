#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const DEFAULT_RUBRIC = {
  clarity: 0.25,
  coverage: 0.3,
  verifiability: 0.25,
  boundaryRespect: 0.2,
};

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function extractHeadings(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(#{1,6}\s+|\d+\.\s+)/.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/^\d+\.\s+/, "").toLowerCase());
}

function hasSection(text, sectionName) {
  const normalized = normalizeText(sectionName);
  const headings = extractHeadings(text);
  if (headings.some((heading) => heading.includes(normalized))) return true;

  const sectionPattern = new RegExp(`<${normalized.replace(/\s+/g, "_")}>`, "i");
  if (sectionPattern.test(text)) return true;

  return normalizeText(text).includes(normalized);
}

function countLineRefs(text) {
  const matches = String(text || "").match(/\b[^\s:]+:\d+(?::\d+)?\b/g);
  return matches ? matches.length : 0;
}

function scoreClarity(text) {
  const length = String(text || "").trim().length;
  const headings = extractHeadings(text).length;
  const bulletCount = (String(text || "").match(/^\s*[-*]\s+/gm) || []).length;

  let score = 2;
  if (length > 120) score += 2;
  if (length > 400) score += 1;
  if (headings >= 2) score += 3;
  if (bulletCount >= 3) score += 2;

  return clamp(score, 0, 10);
}

function scoreCoverage(requiredSections, presentCount) {
  if (requiredSections.length === 0) return 10;
  return clamp((presentCount / requiredSections.length) * 10, 0, 10);
}

function scoreVerifiability(lineRefs, requiresLineRefs) {
  if (!requiresLineRefs) {
    return lineRefs > 0 ? 10 : 7;
  }

  if (lineRefs === 0) return 1;
  if (lineRefs < 2) return 4;
  if (lineRefs < 4) return 7;
  if (lineRefs < 7) return 9;
  return 10;
}

function scoreBoundaryRespect(forbiddenHits) {
  if (forbiddenHits === 0) return 10;
  if (forbiddenHits === 1) return 5;
  return 1;
}

function weightedScore(dimensions, rubric) {
  return Number(
    (
      dimensions.clarity * rubric.clarity +
      dimensions.coverage * rubric.coverage +
      dimensions.verifiability * rubric.verifiability +
      dimensions.boundaryRespect * rubric.boundaryRespect
    ).toFixed(2)
  );
}

function evaluateArtifact(artifactText, contractSpec = {}, rubricOverrides = {}) {
  const text = String(artifactText || "");
  const rubric = { ...DEFAULT_RUBRIC, ...rubricOverrides };
  const threshold = Number(contractSpec.threshold ?? 8);
  const requiredSections = Array.isArray(contractSpec.requiredSections)
    ? contractSpec.requiredSections
    : ["findings", "decisions", "risks", "next actions"];
  const forbiddenPatterns = Array.isArray(contractSpec.forbiddenPatterns)
    ? contractSpec.forbiddenPatterns
    : [];
  const requiresLineRefs = contractSpec.requiresLineRefs !== false;
  const strictBoundaries = contractSpec.strictBoundaries !== false;

  const missingSections = requiredSections.filter((section) => !hasSection(text, section));
  const lineRefCount = countLineRefs(text);
  const forbiddenHits = forbiddenPatterns.filter((pattern) =>
    new RegExp(pattern, "i").test(text)
  );

  const dimensions = {
    clarity: scoreClarity(text),
    coverage: scoreCoverage(requiredSections, requiredSections.length - missingSections.length),
    verifiability: scoreVerifiability(lineRefCount, requiresLineRefs),
    boundaryRespect: scoreBoundaryRespect(forbiddenHits.length),
  };

  const overallScore = weightedScore(dimensions, rubric);

  const gaps = [];
  if (missingSections.length > 0) {
    gaps.push(`Missing sections: ${missingSections.join(", ")}`);
  }
  if (requiresLineRefs && lineRefCount === 0) {
    gaps.push("Missing file:line references.");
  }
  if (forbiddenHits.length > 0) {
    gaps.push(`Boundary violations matched: ${forbiddenHits.join(", ")}`);
  }

  const pass =
    overallScore >= threshold &&
    missingSections.length === 0 &&
    (!requiresLineRefs || lineRefCount > 0) &&
    (!strictBoundaries || forbiddenHits.length === 0);

  return {
    pass,
    overallScore,
    threshold,
    dimensions,
    gaps,
    stats: {
      requiredSections,
      missingSections,
      lineRefCount,
      forbiddenHits,
    },
  };
}

function evaluateArtifactFile(filePath, contractSpec = {}, rubricOverrides = {}) {
  const content = fs.readFileSync(filePath, "utf8");
  return evaluateArtifact(content, contractSpec, rubricOverrides);
}

module.exports = {
  evaluateArtifact,
  evaluateArtifactFile,
};

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stderr.write("Usage: node scripts/artifact-evaluator.js <artifact-file>\n");
    process.exit(1);
  }
  const result = evaluateArtifactFile(filePath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
