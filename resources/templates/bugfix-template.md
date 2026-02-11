# Bugfix Template

Use this template for debugging and fixing issues.

## Template

```xml
<role>
{Debugging specialist with expertise in [detected framework/language] and systematic problem-solving}
</role>

<context>
- Framework: {auto-detected or user-provided}
- Error location: {file/component where issue occurs}
- Environment: {dev/staging/production}
- Recent changes: {if known, what changed before the bug appeared}
</context>

<symptoms>
- {What the user sees/experiences}
- {Error messages if any}
- {When it happens (always, sometimes, specific conditions)}
</symptoms>

<task>
Investigate and fix: {brief description of the bug}
</task>

<investigation_steps>
1. Reproduce the issue
2. Identify root cause
3. Implement fix
4. Verify fix doesn't introduce regressions
</investigation_steps>

<constraints>
- Do not modify unrelated code
- Preserve existing test coverage
- Keep fix minimal and focused
- Document the root cause
</constraints>

<success_criteria>
- Bug no longer reproduces
- Related functionality still works
- No new errors introduced
- Root cause documented in commit/PR
</success_criteria>
```

## When to Use

- Fixing reported bugs
- Investigating unexpected behavior
- Resolving error messages
- Debugging performance issues

## Example

**Raw input:** "the login button doesn't work sometimes"

**Generated:**
```xml
<role>
Debugging specialist with expertise in React, authentication flows, and intermittent issue diagnosis.
</role>

<context>
- Framework: Next.js 14 with Privy authentication
- Error location: src/components/Header.tsx, LoginButton component
- Environment: Production (reported by users)
- Recent changes: Updated Privy SDK last week
</context>

<symptoms>
- Login button click does nothing (no modal appears)
- Happens intermittently, not every time
- No console errors visible
- More frequent on slow connections
</symptoms>

<task>
Investigate and fix the intermittent login button failure.
</task>

<investigation_steps>
1. Reproduce issue locally (throttle network)
2. Check Privy SDK initialization timing
3. Verify button click handler is attached
4. Check for race conditions in auth state
5. Implement fix with proper loading state
</investigation_steps>

<constraints>
- Do not change authentication provider
- Keep existing button styling
- Ensure fix works on slow connections
- Add loading state to prevent double-clicks
</constraints>

<success_criteria>
- Login modal opens reliably on every click
- Button shows loading state during initialization
- Works on throttled network (Slow 3G)
- No regression in logout functionality
</success_criteria>
```
