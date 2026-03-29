#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  analyzeStructure,
  detectTone,
  detectDomain,
  classifyTaskType,
  analyzeQuality,
  inferOutputFormat,
  inferConstraints,
  reverseEngineer,
  scoreReversePrompt,
  buildExemplarOutcome,
} = require("./reverse-engineer");

// --- Test fixtures ---

const CODE_REVIEW_EXEMPLAR = `## Summary
Auth middleware has a session fixation vulnerability. The fix is straightforward but touches 3 files.

## Critical Issues
- **Session fixation** (\`src/middleware/auth.ts:47\`): Session ID not regenerated after login.
  - **Fix**: Call \`req.session.regenerate()\` after successful \`verifyCredentials()\`.
- **Missing CSRF token** (\`src/routes/api.ts:23\`): POST endpoints lack CSRF validation.
  - **Fix**: Add \`csrfProtection\` middleware to router.

## Suggestions
- Consider adding \`SameSite=Strict\` to session cookie (\`src/config/session.ts:12\`)
- Rate limit on \`/api/auth/login\` would prevent brute-force attempts

## What's Good
- Clean separation between auth and authorization layers
- Good use of TypeScript discriminated unions for auth states
`;

const ARCHITECTURE_DOC_EXEMPLAR = `# System Architecture Overview

## Components
The system consists of three main services:
- **API Gateway**: Routes requests, handles authentication
- **Worker Service**: Processes background jobs
- **Data Pipeline**: ETL from external sources

## Data Flow
1. Client sends request to API Gateway
2. Gateway validates token and routes to appropriate service
3. Worker processes async tasks via message queue
4. Pipeline runs on schedule, writes to shared database

## Tradeoffs
- Chose message queue over direct calls for reliability
- Accepted eventual consistency for better throughput
- Monorepo for shared types despite deployment coupling

## Decision
We chose RabbitMQ over Kafka because our volume is <10K msg/day and we need message acknowledgment patterns.
`;

const SIMPLE_CONTENT = `This is a blog post about JavaScript.

JavaScript is great for building web applications. It runs in the browser and on the server with Node.js.

Key takeaways:
- Learn the fundamentals first
- Practice building projects
- Read other people's code
`;

const EMPTY_TEXT = "";

// --- analyzeStructure ---

describe("analyzeStructure", () => {
  it("extracts headings from markdown", () => {
    const result = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    assert.ok(result.headingCount >= 3, `Expected >= 3 headings, got ${result.headingCount}`);
    assert.ok(result.sectionNames.includes("summary"));
    assert.ok(result.sectionNames.includes("critical issues"));
  });

  it("counts bullets", () => {
    const result = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    assert.ok(result.bulletCount >= 4, `Expected >= 4 bullets, got ${result.bulletCount}`);
  });

  it("counts line references", () => {
    const result = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    assert.ok(result.lineRefCount >= 2, `Expected >= 2 line refs, got ${result.lineRefCount}`);
  });

  it("handles empty text", () => {
    const result = analyzeStructure(EMPTY_TEXT);
    assert.equal(result.headingCount, 0);
    assert.equal(result.bulletCount, 0);
    assert.equal(result.lineRefCount, 0);
  });

  it("detects code blocks", () => {
    const withCode = "# Title\n```js\nconst x = 1;\n```\nSome text\n```bash\nnpm test\n```\n";
    const result = analyzeStructure(withCode);
    assert.equal(result.codeBlockCount, 2);
  });
});

// --- detectTone ---

describe("detectTone", () => {
  it("detects formal tone", () => {
    const text = "Therefore, we must consequently ensure that furthermore the system shall operate accordingly.";
    const result = detectTone(text);
    assert.equal(result.formality, "formal");
  });

  it("detects casual tone", () => {
    const text = "Basically this is pretty much gonna be awesome stuff, tbh it's cool.";
    const result = detectTone(text);
    assert.equal(result.formality, "casual");
  });

  it("detects directive language", () => {
    const text = "You must ensure all endpoints verify tokens. Never skip validation. Always check permissions. Do not expose internal errors.";
    const result = detectTone(text);
    assert.ok(result.isDirective);
  });

  it("defaults to neutral", () => {
    const text = "The system processes requests and returns responses.";
    const result = detectTone(text);
    assert.equal(result.formality, "neutral");
  });
});

// --- detectDomain ---

describe("detectDomain", () => {
  it("detects security domain", () => {
    const result = detectDomain(CODE_REVIEW_EXEMPLAR);
    assert.equal(result.primary, "security");
  });

  it("detects infrastructure domain", () => {
    const text = "Deploy the Docker container to Kubernetes using Terraform. Set up CI/CD pipeline with AWS.";
    const result = detectDomain(text);
    assert.equal(result.primary, "infrastructure");
  });

  it("returns general for generic text", () => {
    const result = detectDomain("This is a simple note about the weather.");
    assert.equal(result.primary, "general");
  });

  it("detects secondary domain", () => {
    const result = detectDomain("The React component calls the API endpoint and stores in the database.");
    assert.ok(result.secondary !== null, "Expected secondary domain");
  });
});

// --- classifyTaskType ---

describe("classifyTaskType", () => {
  it("classifies code review", () => {
    const structure = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    const result = classifyTaskType(CODE_REVIEW_EXEMPLAR, structure);
    assert.equal(result.type, "code-review");
    assert.equal(result.template, "bugfix-template");
  });

  it("classifies architecture doc", () => {
    const structure = analyzeStructure(ARCHITECTURE_DOC_EXEMPLAR);
    const result = classifyTaskType(ARCHITECTURE_DOC_EXEMPLAR, structure);
    assert.equal(result.type, "architecture-doc");
  });

  it("classifies content", () => {
    const structure = analyzeStructure(SIMPLE_CONTENT);
    const result = classifyTaskType(SIMPLE_CONTENT, structure);
    // May classify as content or general depending on signals
    assert.ok(["content", "general"].includes(result.type));
  });

  it("returns general for unclassifiable text", () => {
    const text = "Hello world.";
    const structure = analyzeStructure(text);
    const result = classifyTaskType(text, structure);
    assert.equal(result.type, "general");
    assert.equal(result.confidence, "low");
  });

  it("assigns confidence levels", () => {
    const structure = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    const result = classifyTaskType(CODE_REVIEW_EXEMPLAR, structure);
    assert.ok(["high", "medium", "low"].includes(result.confidence));
  });
});

// --- analyzeQuality ---

describe("analyzeQuality", () => {
  it("scores high-quality exemplar higher", () => {
    const highStructure = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    const highQuality = analyzeQuality(CODE_REVIEW_EXEMPLAR, highStructure);

    const lowStructure = analyzeStructure("Fix the bug.");
    const lowQuality = analyzeQuality("Fix the bug.", lowStructure);

    assert.ok(highQuality.specificity > lowQuality.specificity);
    assert.ok(highQuality.coverage > lowQuality.coverage);
  });

  it("gives points for line references", () => {
    const structure = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    const quality = analyzeQuality(CODE_REVIEW_EXEMPLAR, structure);
    assert.ok(quality.specificity >= 5);
  });

  it("scores between 0 and 10", () => {
    const structure = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    const quality = analyzeQuality(CODE_REVIEW_EXEMPLAR, structure);
    for (const dim of ["specificity", "coverage", "clarity"]) {
      assert.ok(quality[dim] >= 0 && quality[dim] <= 10, `${dim} out of range: ${quality[dim]}`);
    }
  });
});

// --- inferOutputFormat ---

describe("inferOutputFormat", () => {
  it("detects markdown headers", () => {
    const structure = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    const format = inferOutputFormat(structure);
    assert.ok(format.includes("Markdown"), `Expected markdown: ${format}`);
  });

  it("includes bullet info when present", () => {
    const structure = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    const format = inferOutputFormat(structure);
    assert.ok(format.includes("bullet"), `Expected bullets: ${format}`);
  });

  it("detects file:line references", () => {
    const structure = analyzeStructure(CODE_REVIEW_EXEMPLAR);
    const format = inferOutputFormat(structure);
    assert.ok(format.includes("file:line"), `Expected file:line: ${format}`);
  });
});

// --- reverseEngineer (full pipeline) ---

describe("reverseEngineer", () => {
  it("handles empty input", () => {
    const result = reverseEngineer("");
    assert.ok(result.error);
    assert.equal(result.prompt, null);
  });

  it("produces complete prompt for code review", () => {
    const result = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    assert.ok(!result.error, `Unexpected error: ${result.error}`);
    assert.ok(result.prompt);
    assert.ok(result.prompt.role);
    assert.ok(result.prompt.task);
    assert.ok(result.prompt.requirements.length >= 3);
    assert.ok(result.prompt.constraints.length >= 2);
    assert.ok(result.prompt.successCriteria.length >= 2);
    assert.ok(result.prompt.outputFormat);
  });

  it("produces complete prompt for architecture doc", () => {
    const result = reverseEngineer(ARCHITECTURE_DOC_EXEMPLAR);
    assert.ok(result.prompt);
    assert.ok(result.prompt.role.toLowerCase().includes("architect"));
  });

  it("detects correct task type", () => {
    const result = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    assert.equal(result.analysis.taskType.type, "code-review");
  });

  it("generates recipe fingerprint", () => {
    const result = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    assert.ok(result.recipe);
    assert.ok(result.recipe.hash);
    assert.equal(result.recipe.hash.length, 16);
  });

  it("scores the reverse-engineered prompt", () => {
    const result = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    assert.ok(result.score);
    assert.ok(result.score.overall >= 5);
    assert.ok(result.score.overall <= 10);
  });

  it("returns template ID", () => {
    const result = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    assert.ok(result.templateId);
    assert.ok(result.templateId.endsWith("-template"));
  });

  it("accepts custom motivation", () => {
    const result = reverseEngineer(CODE_REVIEW_EXEMPLAR, {
      motivation: "Need consistent security reviews for SOC2 compliance",
    });
    assert.equal(result.prompt.motivation, "Need consistent security reviews for SOC2 compliance");
  });

  it("produces deterministic results", () => {
    const result1 = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    const result2 = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    assert.equal(result1.recipe.hash, result2.recipe.hash);
    assert.deepEqual(result1.prompt.requirements, result2.prompt.requirements);
  });
});

// --- scoreReversePrompt ---

describe("scoreReversePrompt", () => {
  it("scores well-formed prompts higher", () => {
    const good = scoreReversePrompt({
      role: "Senior security-focused code reviewer with expertise in auth",
      task: "Review the PR diff for security vulnerabilities with actionable fix suggestions",
      context: ["Output type: code review", "Domain: security", "Depth: deep"],
      requirements: ["Structure: 4 sections", "Traceability: file:line refs", "Coverage: comprehensive"],
      constraints: ["Stay focused", "Include fixes", "Balance feedback"],
      outputFormat: "Markdown with ## headers, bullet points, 30-50 lines",
      successCriteria: ["All issues identified", "Actionable fixes", "Balanced feedback"],
    });

    const bad = scoreReversePrompt({
      role: "Reviewer",
      task: "Review code",
      context: [],
      requirements: [],
      constraints: [],
      outputFormat: "",
      successCriteria: [],
    });

    assert.ok(good.overall > bad.overall, `Good ${good.overall} should be > bad ${bad.overall}`);
  });

  it("all dimensions between 0 and 10", () => {
    const result = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    for (const dim of ["clarity", "specificity", "structure", "constraints", "verifiability"]) {
      assert.ok(result.score[dim] >= 0 && result.score[dim] <= 10, `${dim}: ${result.score[dim]}`);
    }
  });
});

// --- buildExemplarOutcome ---

describe("buildExemplarOutcome", () => {
  it("builds outcome from reverse result", () => {
    const reverseResult = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    const outcome = buildExemplarOutcome(reverseResult);
    assert.ok(outcome);
    assert.ok(outcome.runId.startsWith("rpt-reverse-"));
    assert.ok(outcome.taskId.startsWith("reverse-"));
    assert.ok(outcome.recipe);
    assert.equal(outcome.signals.source, "reverse-exemplar");
    assert.equal(outcome.signals.userVerdict, "accept");
    assert.equal(outcome.signals.retryCount, 0);
  });

  it("returns null for invalid input", () => {
    const outcome = buildExemplarOutcome(null);
    assert.equal(outcome, null);
  });

  it("applies exemplar bonus to effectiveness score", () => {
    const reverseResult = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    const outcome = buildExemplarOutcome(reverseResult);
    assert.ok(outcome.effectivenessScore >= reverseResult.score.overall);
  });

  it("accepts custom user verdict", () => {
    const reverseResult = reverseEngineer(CODE_REVIEW_EXEMPLAR);
    const outcome = buildExemplarOutcome(reverseResult, { userVerdict: "reject" });
    assert.equal(outcome.signals.userVerdict, "reject");
  });
});

// --- Edge cases ---

describe("edge cases", () => {
  it("handles text with only code blocks", () => {
    const text = "```js\nconst x = 1;\nconsole.log(x);\n```\n```bash\nnpm test\n```\n";
    const result = reverseEngineer(text);
    assert.ok(result.prompt);
    assert.ok(result.analysis.structure.codeBlockCount >= 2);
  });

  it("handles text with only bullets", () => {
    const text = "- Item one\n- Item two\n- Item three\n- Item four\n- Item five\n";
    const result = reverseEngineer(text);
    assert.ok(result.prompt);
    assert.ok(result.analysis.structure.bulletCount >= 5);
  });

  it("handles very long text", () => {
    const text = ("## Section\n" + "This is a line with details.\n".repeat(200));
    const result = reverseEngineer(text);
    assert.ok(result.prompt);
    assert.ok(result.analysis.structure.totalLines > 100);
  });

  it("handles non-English text gracefully", () => {
    const text = "# Sistem Mimarisi\n\n## Bilesenler\n- API Gateway\n- Veritabani\n\n## Kararlar\nRabbitMQ secildi.\n";
    const result = reverseEngineer(text);
    assert.ok(result.prompt);
    assert.ok(result.analysis.structure.headingCount >= 2);
  });
});
