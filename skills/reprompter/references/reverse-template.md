# Reverse Template

Use this template when reverse-engineering a prompt from an exemplar output. The user provides a great output and reprompter extracts the optimal prompt that would reproduce it.

## Template

```xml
<role>
{Expert role inferred from the exemplar's domain, depth, and technical level}
</role>

<context>
- Domain: {inferred from exemplar content and terminology}
- Output type: {what kind of artifact the exemplar is — code review, architecture doc, PR description, etc.}
- Technical depth: {shallow/moderate/deep — inferred from terminology density and specificity}
- Style signals: {tone, formality level, sentence structure patterns}
</context>

<task>{Single-sentence task description inferred from what the exemplar accomplishes}</task>

<exemplar_analysis>
- Structure: {sections found, heading patterns, bullet density, code block count}
- Coverage: {topics/areas the exemplar addresses}
- Quality markers: {what makes this exemplar good — specificity, evidence, actionability}
- Patterns: {recurring structural or stylistic patterns worth reproducing}
</exemplar_analysis>

<motivation>
{Inferred purpose — why someone would produce this type of output. If unknown, state "Reproduce this quality level consistently."}
</motivation>

<requirements>
1. **Structure**: {Match the exemplar's section layout and organization}
2. **Depth**: {Match the exemplar's level of detail and specificity}
3. **Coverage**: {Address the same scope of topics/areas}
4. **Style**: {Match tone, formality, and communication patterns}
5. **Evidence**: {Match the exemplar's use of references, examples, data}
</requirements>

<constraints>
- Match the exemplar's scope — do not expand or contract coverage
- Preserve the exemplar's tone and formality level
- Include the same types of evidence/references the exemplar uses
- {Any domain-specific constraints inferred from the exemplar}
- Do not reproduce the exemplar's specific content — extract the pattern, not the data
</constraints>

<output_format>
{Exact format inferred from the exemplar — section headers, bullet style, table usage, code block format, length range}
</output_format>

<success_criteria>
- Output follows the same structural pattern as the exemplar
- Quality dimensions (clarity, specificity, coverage) match or exceed the exemplar
- Tone and style are consistent with the exemplar
- Content is original but structurally equivalent
</success_criteria>
```

## When to Use

- User provides a great output and wants to reproduce that quality
- Extracting prompt "DNA" from successful AI interactions
- Building reusable prompt recipes from one-off successes
- Bootstrapping the flywheel with known-good exemplar pairs

## Reverse Engineering Process

The reverse template is filled by analyzing the exemplar across three phases:

### Phase 1: EXTRACT (structural analysis)
Parse the exemplar for:
- Heading hierarchy (H1/H2/H3 distribution)
- Bullet density (bullets per section)
- Code block count and languages
- Table usage
- Average sentence length
- Section count and names

### Phase 2: ANALYZE (content classification)
Classify the exemplar by:
- Task type (code review, architecture doc, API spec, etc.)
- Domain (frontend, backend, security, ops, etc.)
- Technical depth (keyword density, jargon level)
- Tone (formal/neutral/casual, directive/descriptive)
- Quality markers (specificity, evidence usage, actionability)

### Phase 3: SYNTHESIZE (prompt generation)
Generate the reverse-engineered prompt by:
- Mapping task type to the best-fit reprompter template
- Extracting structural requirements from the exemplar's format
- Inferring constraints from what the exemplar does NOT do
- Deriving success criteria from the exemplar's quality markers

## Example

**Exemplar input:** (user pastes a great code review they wrote)

```markdown
## Summary
Auth middleware has a session fixation vulnerability. The fix is straightforward but touches 3 files.

## Critical Issues
- **Session fixation** (`src/middleware/auth.ts:47`): Session ID not regenerated after login. Attacker can set session cookie before auth, then hijack after user authenticates.
  - **Fix**: Call `req.session.regenerate()` after successful `verifyCredentials()`.

## Suggestions
- Consider adding `SameSite=Strict` to session cookie (`src/config/session.ts:12`)
- Rate limit on `/api/auth/login` would prevent brute-force attempts

## What's Good
- Clean separation between auth and authorization layers
- Good use of TypeScript discriminated unions for auth states
```

**Generated reverse prompt:**
```xml
<role>
Senior security-focused code reviewer with expertise in authentication patterns, session management, and web application security.
</role>

<context>
- Output type: Code review with security focus
- Technical depth: Deep — references specific vulnerabilities by name and file:line
- Style: Direct, structured, actionable — every finding has a fix suggestion
</context>

<task>Review the PR diff for security vulnerabilities, focusing on authentication and session management, with actionable fix suggestions for every finding.</task>

<requirements>
1. **Structure**: Summary, Critical Issues, Suggestions, What's Good (4 sections)
2. **Depth**: Reference specific file:line locations for every finding
3. **Coverage**: Security vulnerabilities, improvement suggestions, and positive feedback
4. **Style**: Direct but constructive tone, bullet points with bold labels
5. **Evidence**: Every finding includes vulnerability name, affected code location, and specific fix
</requirements>

<constraints>
- Stay focused on security — do not nitpick formatting or style
- Every critical issue MUST have a concrete fix suggestion
- Include positive feedback to balance critical findings
- Do not flag theoretical risks without evidence in the actual code
</constraints>

<output_format>
Markdown with 4 sections (## headers):
1. Summary (2-3 sentences)
2. Critical Issues (bold label + file:line + explanation + fix)
3. Suggestions (bullet points with file:line)
4. What's Good (2-3 positive observations)
</output_format>

<success_criteria>
- All security issues identified with file:line references
- Every critical finding has an actionable fix
- Review balances criticism with positive feedback
- Suggestions are practical and scoped
</success_criteria>
```
