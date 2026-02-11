# Research/Analysis Template

Use this template for research tasks, complex analysis, or tasks requiring chain-of-thought reasoning.

## Template

```xml
<role>
{Research specialist with expertise in [domain], systematic analysis, and evidence-based conclusions}
</role>

<context>
- Domain: {area of research}
- Available sources: {docs, code, APIs, web, etc.}
- Prior knowledge: {what's already known}
- Time/depth constraints: {quick scan vs deep dive}
</context>

<research_questions>
1. {Primary question to answer}
2. {Secondary question}
3. {Tertiary question}
</research_questions>

<thinking>
Before researching, consider:
1. What do I already know about this topic?
2. What are the most reliable sources for this information?
3. What biases or assumptions might affect my analysis?
4. What would constitute strong vs weak evidence?

Think through each question systematically before forming conclusions.
</thinking>

<methodology>
1. {Step 1}: {approach}
2. {Step 2}: {approach}
3. {Step 3}: {approach}
</methodology>

<reference>
Relevant sources to consult:
- {Source 1}: {why it's relevant}
- {Source 2}: {why it's relevant}
- {Documentation}: {specific sections}
</reference>

<constraints>
- Cite sources for all claims
- Distinguish between facts and opinions
- Acknowledge uncertainty where it exists
- {Specific scope limitations}
</constraints>

<output_format>
1. Executive summary (key findings)
2. Detailed analysis per question
3. Evidence and sources
4. Recommendations (if applicable)
5. Confidence levels for each finding
</output_format>

<success_criteria>
- All research questions answered
- Claims supported by evidence
- Uncertainty clearly communicated
- Actionable conclusions where applicable
</success_criteria>
```

## When to Use

- Investigating unfamiliar codebases
- Evaluating technical approaches
- Comparing libraries or frameworks
- Understanding complex systems
- Due diligence on dependencies
- Architecture decision records

## Example

**Raw input:** "should we use drizzle or prisma for our new project"

**Generated:**
```xml
<role>
Technical research specialist with expertise in Node.js ORMs, database patterns, and developer experience evaluation.
</role>

<context>
- Domain: TypeScript ORM selection for production application
- Available sources: Official docs, GitHub repos, benchmarks, community feedback
- Prior knowledge: Project uses Next.js 14, PostgreSQL, TypeScript strict mode
- Depth: Comprehensive analysis for long-term decision
</context>

<research_questions>
1. Which ORM has better TypeScript integration and type safety?
2. What are the performance characteristics of each under our expected load?
3. Which has better migration tooling and schema management?
4. What is the learning curve and developer experience for each?
5. How do they compare for our specific use case (Next.js App Router + PostgreSQL)?
</research_questions>

<thinking>
Before researching, consider:
1. What do I already know?
   - Prisma: Mature, schema-first, generates client
   - Drizzle: Newer, TypeScript-first, SQL-like syntax

2. Most reliable sources:
   - Official documentation (both)
   - GitHub issues (real problems users face)
   - Benchmark repositories (performance data)
   - Migration guides (real-world experience)

3. Potential biases:
   - Recency bias (Drizzle is newer, might seem "better")
   - Popularity bias (Prisma has more users)
   - My own familiarity with either tool

4. Strong evidence would be:
   - Benchmark data with methodology
   - Production case studies
   - Specific feature comparisons with code examples
</thinking>

<methodology>
1. Feature Comparison: Document capabilities side-by-side
2. Performance Analysis: Find credible benchmarks, note methodology
3. DX Evaluation: Try basic operations in both, assess ergonomics
4. Community Assessment: GitHub stars, issues, release frequency
5. Integration Check: Verify Next.js App Router compatibility specifically
</methodology>

<reference>
Relevant sources to consult:
- Prisma Docs: Schema definition, migrations, client generation
- Drizzle Docs: Schema definition, query builder, migrations
- GitHub repos: Issue count, response time, release frequency
- Benchmarks: drizzle-benchmarks repo, community comparisons
- Next.js examples: Official examples using each ORM
</reference>

<constraints>
- Focus on PostgreSQL (ignore other database differences)
- Consider our team's TypeScript expertise level
- Prioritize long-term maintainability over short-term convenience
- Acknowledge that both are valid choices
</constraints>

<output_format>
1. **Executive Summary**: Clear recommendation with confidence level
2. **Comparison Table**: Feature-by-feature breakdown
3. **Performance Analysis**: Benchmarks with context
4. **Migration Path**: How to adopt each
5. **Risk Assessment**: Potential issues with each choice
6. **Recommendation**: Final verdict with reasoning
</output_format>

<success_criteria>
- Both ORMs evaluated fairly with evidence
- Recommendation is justified with specific reasons
- Edge cases and potential issues acknowledged
- Decision is actionable (clear next steps)
- Confidence level stated (high/medium/low)
</success_criteria>
```

## Chain-of-Thought Integration

The `<thinking>` section is crucial for research tasks. It:
1. Surfaces hidden assumptions
2. Identifies reliable sources
3. Acknowledges biases
4. Sets evidence standards

For complex analysis, expand thinking:

```xml
<thinking>
## Pre-Analysis
- What do I know? {existing knowledge}
- What don't I know? {gaps to fill}
- What might I be wrong about? {assumptions to test}

## Source Evaluation
- Primary sources: {docs, code}
- Secondary sources: {articles, tutorials}
- Tertiary sources: {opinions, forums}

## Analysis Framework
- For each option, evaluate: {criteria}
- Weight criteria by: {importance ranking}
- Final decision based on: {decision framework}

Think through each step. Show your reasoning.
</thinking>
```
