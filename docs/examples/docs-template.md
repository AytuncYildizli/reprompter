# Documentation Template

Use this template for writing documentation.

## Template

```xml
<role>
{Technical writer specializing in [domain] documentation, developer experience, and clear communication}
</role>

<context>
- Subject: {what to document}
- Audience: {who will read this}
- Format: {README, API docs, tutorial, etc.}
- Existing docs: {current documentation state}
</context>

<task>
Write {documentation type} for {subject} targeting {audience}.
</task>

<motivation>
{Knowledge gaps, onboarding friction, support ticket reduction}
</motivation>

<structure>
1. {Section 1}: {purpose}
2. {Section 2}: {purpose}
3. {Section 3}: {purpose}
</structure>

<reference>
- {Source 1}: {why it's relevant}
- {Source 2}: {why it's relevant}
- {Documentation}: {specific sections}
</reference>

<requirements>
1. **Clarity**: {readability requirements}
2. **Completeness**: {coverage requirements}
3. **Examples**: {code example requirements}
4. **Maintenance**: {how to keep docs updated}
</requirements>

<constraints>
- Use clear, simple language
- Include working code examples
- Keep sections focused and scannable
- Follow existing documentation style
- Do not assume reader's expertise level without stating target audience
- Do not include outdated API signatures or deprecated methods
- Do not skip error handling in code examples
</constraints>

<output_format>
1. Documentation file(s)
2. Code examples (tested)
3. Diagrams if helpful
</output_format>

<success_criteria>
- New developers can follow without confusion
- All features/APIs documented
- Examples work when copy-pasted
- Follows documentation standards
</success_criteria>
```

## When to Use

- Writing README files
- API documentation
- Tutorial creation
- Architecture documentation
- User guides

## Example

**Raw input:** "document the payment api"

**Generated:**
```xml
<role>
Technical writer specializing in API documentation, developer experience, and payment system integration guides.
</role>

<context>
- Subject: Payment API endpoints (/api/v1/payments/*)
- Audience: Frontend developers integrating payments, third-party integrators
- Format: API reference documentation with examples
- Existing docs: Basic README exists, no API docs
</context>

<task>
Write comprehensive API documentation for the payment endpoints targeting developers who need to integrate payment processing.
</task>

<motivation>
No API docs exist — developers spend 2+ hours reverse-engineering endpoints. Support tickets about payment integration are the #1 category. New integrator onboarding blocked without docs.
</motivation>

<structure>
1. **Overview**: Payment flow explanation, prerequisites
2. **Authentication**: How to authenticate API requests
3. **Endpoints Reference**: Each endpoint with request/response
4. **Webhooks**: Payment event notifications
5. **Error Handling**: Error codes and troubleshooting
6. **Examples**: Common integration patterns
7. **Testing**: Test mode and test card numbers
</structure>

<reference>
- OpenAPI spec (if available): canonical endpoint and schema source
- Existing API route files: `/app/api/v1/payments/*` for implementation truth
- Product requirements doc: expected business behavior and edge cases
</reference>

<requirements>
1. **Clarity**:
   - Each endpoint on its own section
   - Request/response examples for every endpoint
   - Clear parameter descriptions
2. **Completeness**:
   - All endpoints documented
   - All parameters explained
   - All error codes listed
3. **Examples**:
   - cURL examples for each endpoint
   - JavaScript/TypeScript SDK examples
   - Complete integration flow example
4. **Maintenance**:
   - Version number in docs
   - Changelog section
   - Last updated date
</requirements>

<constraints>
- Use OpenAPI/Swagger format where appropriate
- Include both success and error response examples
- Keep sensitive data (API keys) as placeholders
- Test all code examples before including
- Do not reference deprecated getServerSession API
- Do not assume reader has TypeScript experience without stating prerequisite
</constraints>

<output_format>
1. docs/api/payments.md - Main API documentation
2. docs/api/webhooks.md - Webhook documentation
3. docs/api/examples/ - Code examples directory
4. openapi/payments.yaml - OpenAPI spec (optional)
</output_format>

<success_criteria>
- Developer can integrate payments using only docs
- All endpoints have working examples
- Error handling is clearly explained
- Test mode instructions are clear
- Docs pass technical review
</success_criteria>
```
