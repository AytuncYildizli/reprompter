# API Template

Use this template for API endpoint work (REST, GraphQL, etc.).

## Template

```xml
<role>
{Backend/API developer specializing in [detected framework] and [API style: REST/GraphQL]}
</role>

<context>
- Framework: {Next.js API routes, Express, FastAPI, etc.}
- Database: {Prisma, Drizzle, raw SQL, etc.}
- Auth: {authentication method if relevant}
- Existing patterns: {current API conventions in codebase}
</context>

<task>
{Create/modify} API endpoint(s) for {functionality}.
</task>

<motivation>
{API consumer needs, integration requirements, deadline}
</motivation>

<endpoints>
| Method | Path | Description |
|--------|------|-------------|
| {GET/POST/etc.} | {/api/path} | {What it does} |
</endpoints>

<requirements>
1. **Request validation**: {input validation requirements}
2. **Business logic**: {core functionality}
3. **Error handling**: {error response format}
4. **Response format**: {success response structure}
</requirements>

<constraints>
- Follow existing API conventions
- Use consistent error response format
- Implement proper authentication checks
- Add rate limiting if public endpoint
- Do not expose internal error details or stack traces in API responses
- Do not skip input validation for "trusted" internal endpoints
- Do not create inconsistent response formats across endpoints
</constraints>

<output_format>
1. API route file(s)
2. Request/response type definitions
3. Validation schemas
4. Brief API documentation
</output_format>

<success_criteria>
- Endpoints work as specified
- Validation rejects invalid input
- Errors return proper status codes
- Authenticated endpoints require valid session
</success_criteria>
```

## When to Use

- Creating new API endpoints
- Modifying existing endpoints
- Adding validation to APIs
- Implementing CRUD operations

## Example

**Raw input:** "need an api for user profile crud"

**Generated:**
```xml
<role>
Backend developer specializing in Next.js API routes, Prisma ORM, and RESTful API design.
</role>

<context>
- Framework: Next.js 14 App Router API routes
- Database: Prisma with PostgreSQL
- Auth: NextAuth.js session-based
- Existing patterns: /api/v1/* prefix, Zod validation, consistent error format
</context>

<task>
Create CRUD API endpoints for user profile management.
</task>

<motivation>
User profile management is a core feature needed by the frontend team for the v2 launch. API consumers include the dashboard, mobile app, and third-party integrators with a Q2 deadline.
</motivation>

<endpoints>
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/profile | Get current user's profile |
| PUT | /api/v1/profile | Update current user's profile |
| DELETE | /api/v1/profile | Delete current user's account |
| GET | /api/v1/profile/:id | Get public profile by user ID |
</endpoints>

<requirements>
1. **Request validation**:
   - PUT: Validate name (string, 1-100 chars), bio (string, max 500 chars), avatar URL
   - Reject unknown fields
2. **Business logic**:
   - GET own profile: Include private fields (email, settings)
   - GET public profile: Only public fields (name, bio, avatar)
   - DELETE: Soft delete with 30-day recovery window
3. **Error handling**:
   - 400: Validation errors with field-specific messages
   - 401: Not authenticated
   - 404: Profile not found
   - 500: Database errors (logged, generic message to client)
4. **Response format**:
   ```json
   { "data": { ... }, "meta": { "timestamp": "..." } }
   ```
</requirements>

<constraints>
- Require authentication for all except public profile GET
- Follow existing /api/v1/* pattern
- Use Zod schemas for validation
- Log all profile deletions
- Do not expose internal error details or stack traces in API responses
- Do not skip input validation for "trusted" internal endpoints
- Do not create inconsistent response formats across endpoints
</constraints>

<output_format>
1. src/app/api/v1/profile/route.ts (GET, PUT, DELETE own profile)
2. src/app/api/v1/profile/[id]/route.ts (GET public profile)
3. src/lib/validations/profile.ts (Zod schemas)
4. src/types/profile.ts (TypeScript types)
</output_format>

<success_criteria>
- All CRUD operations work correctly
- Validation rejects malformed requests
- Auth required where specified
- Soft delete preserves data for recovery
- Follows existing API conventions
</success_criteria>
```
