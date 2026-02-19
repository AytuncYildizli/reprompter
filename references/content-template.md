# Content Template

Use this template for blog posts, articles, marketing copy, social media content, and other written content tasks.

## Template

```xml
<role>{Content specialist matching the domain — e.g., "Technical blog writer for developer audiences"}</role>

<context>
- Target audience: {who reads this}
- Platform/channel: {blog, social, newsletter, docs site}
- Brand voice: {formal/casual/technical/playful}
- Prior content: {links or descriptions of existing content for tone matching}
</context>

<task>{Clear content objective — e.g., "Write a 1500-word blog post about X targeting Y audience"}</task>

<motivation>{Why this content matters — launch, SEO, thought leadership, community}</motivation>

<requirements>
1. **Length**: {Word count or content scope}
2. **Key points**: {Topics that must be covered}
3. **Keywords**: {SEO terms or phrases to include naturally}
4. **Call to action**: {What the reader should do after reading}
5. **Tone**: {Specific style and voice requirements}
</requirements>

<constraints>
- {Topics or claims to avoid}
- {Brand guidelines to follow}
- {Factual accuracy — cite sources if needed}
- {No AI-sounding language: avoid "delve", "landscape", "leverage", "paradigm", "robust"}
- Do not use filler phrases or corporate buzzwords
- Do not make claims without supporting evidence
</constraints>

<output_format>
- {Markdown / HTML / plain text}
- {Include meta description, title tag, headers?}
- {Image suggestions or alt text needed?}
</output_format>

<success_criteria>
- {Reads naturally — no detectable AI patterns}
- {Covers all key points thoroughly}
- {Appropriate length for platform}
- {Clear, compelling call to action}
</success_criteria>
```

## When to Use

- Writing blog posts or long-form articles
- Creating marketing copy or landing-page content
- Drafting newsletters and campaign content
- Producing social media content strategy
- Writing technical content for developer audiences

## Example

```xml
<role>Technical content writer specializing in developer tools and AI infrastructure</role>

<context>
- Target audience: Full-stack developers evaluating AI coding tools
- Platform: Company blog (dev.example.com), syndicated to Hacker News
- Brand voice: Technical but accessible, opinionated, backed by data
- Prior content: Previous posts average 2000 words with code examples
</context>

<task>Write a 2000-word blog post comparing AI coding assistants (Copilot, Cursor, Claude Code) for production development workflows</task>

<motivation>Product launch next month — need thought leadership content establishing credibility in the AI tools space. Target: 5K organic views in first month via HN + SEO.</motivation>

<requirements>
1. **Length**: 1800-2200 words including code examples
2. **Key points**: Setup experience, code quality, context handling, pricing, team workflows
3. **Keywords**: "AI coding assistant", "AI pair programming", "code generation comparison"
4. **Call to action**: Try our tool's free tier with link to /signup
5. **Tone**: Honest comparison — acknowledge competitor strengths, don't be a shill
</requirements>

<constraints>
- No FUD about competitors — factual comparisons only
- Include real code examples (TypeScript preferred)
- Cite benchmarks or user surveys where available
- No AI-sounding language: avoid "delve", "landscape", "leverage", "paradigm"
- Do not claim "best" without quantifiable evidence
- Disclose any affiliate or business relationships
</constraints>

<output_format>
- Markdown with YAML frontmatter (title, date, author, tags, description)
- H2 headers for each comparison dimension
- Code blocks with syntax highlighting
- Summary comparison table at the end
- Meta description under 160 characters
</output_format>

<success_criteria>
- Reads like a genuine developer wrote it, not marketing
- Each tool gets fair treatment with specific pros AND cons
- At least 3 real code examples
- Would survive Hacker News comments without being called "AI slop"
- Clear CTA that flows naturally from the conclusion
</success_criteria>
```
