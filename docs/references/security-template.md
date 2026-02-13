# Security Template

Use this template for security audits, fixes, and hardening.

## Template

```xml
<role>
{Security engineer specializing in [detected framework/language] security, OWASP guidelines, and secure coding practices}
</role>

<context>
- Application: {framework and type}
- Scope: {what to audit/secure}
- Auth system: {authentication method}
- Data sensitivity: {type of data handled}
- Compliance: {GDPR, HIPAA, SOC2, etc. if applicable}
</context>

<threat_model>
Consider these threat vectors:
- {Threat 1}: {description}
- {Threat 2}: {description}
- {Threat 3}: {description}
</threat_model>

<task>
{Audit/implement/fix} security for {scope} focusing on {specific concerns}.
</task>

<motivation>
{Threat severity, compliance requirements, exposure window}
</motivation>

<requirements>
1. **Input validation**: {sanitization requirements}
2. **Authentication**: {auth requirements}
3. **Authorization**: {access control requirements}
4. **Data protection**: {encryption, masking, etc.}
</requirements>

<constraints>
- Follow OWASP Top 10 guidelines
- Do not log sensitive data
- Do not hardcode secrets, API keys, or credentials in source code
- Do not disable security controls (CORS/CSP/rate limiting) for convenience
- Do not trust client-side validation as the only security boundary
- Maintain existing functionality
- Document all security decisions
</constraints>

<output_format>
1. Security audit findings (if audit)
2. Code changes with security fixes
3. Security documentation/recommendations
</output_format>

<success_criteria>
- No critical/high vulnerabilities
- Passes security scanning tools
- Follows security best practices
- Audit trail for sensitive operations
</success_criteria>
```

## When to Use

- Security audits
- Fixing vulnerabilities
- Implementing authentication/authorization
- Data protection compliance
- Hardening applications

## Example

**Raw input:** "check if our api is secure"

**Generated:**
```xml
<role>
Security engineer specializing in Next.js API security, OWASP guidelines, authentication systems, and secure coding practices.
</role>

<context>
- Application: Next.js 14 API routes with Prisma
- Scope: All /api/* endpoints
- Auth system: NextAuth.js with JWT
- Data sensitivity: User PII, payment references
- Compliance: GDPR (EU users)
</context>

<threat_model>
Consider these threat vectors:
- **Injection**: SQL injection via Prisma, NoSQL injection, command injection
- **Broken Auth**: JWT manipulation, session fixation, weak passwords
- **Data Exposure**: Excessive data in responses, error message leakage
- **CSRF/CORS**: Cross-site request forgery, misconfigured CORS
- **Rate Limiting**: Brute force attacks, API abuse
</threat_model>

<task>
Conduct security audit of all API endpoints and implement necessary fixes for identified vulnerabilities.
</task>

<motivation>
API handles user PII and payment references under GDPR. No security audit has been done since launch. Exposure window is growing — any breach risks regulatory fines and user trust.
</motivation>

<requirements>
1. **Input validation**:
   - All inputs validated with Zod schemas
   - SQL injection prevention verified
   - File upload restrictions
2. **Authentication**:
   - JWT validation on protected routes
   - Token expiration properly enforced
   - Secure session configuration
3. **Authorization**:
   - Role-based access control
   - Resource ownership verification
   - Admin endpoints properly protected
4. **Data protection**:
   - Sensitive fields excluded from responses
   - Passwords properly hashed (bcrypt)
   - PII encrypted at rest
</requirements>

<constraints>
- Follow OWASP Top 10 2021 guidelines
- Do not log passwords, tokens, or PII
- Do not store plaintext passwords or reversible credential encryption
- Do not expose internal stack traces or implementation details in API responses
- Do not disable authentication/authorization checks to make tests pass
- Maintain API backward compatibility
- Document all security decisions in code comments
</constraints>

<output_format>
1. Security Audit Report:
   - Critical findings
   - High/Medium/Low issues
   - Remediation recommendations
2. Security fixes implemented
3. Security headers configuration
4. Rate limiting implementation
</output_format>

<success_criteria>
- No critical or high vulnerabilities
- All endpoints validate input
- Auth/authz properly implemented
- OWASP ZAP scan passes
- Security headers score A+ on securityheaders.com
</success_criteria>
```
