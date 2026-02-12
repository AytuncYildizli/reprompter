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

<motivation>
{Severity, user impact, how long the bug has existed}
</motivation>

<requirements>
1. **Fix verification**: {Steps to verify the fix resolves the issue}
2. **Regression test**: {Test to prevent this bug from recurring}
3. **Root cause documented**: {Root cause analysis included in PR/commit}
</requirements>

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
- Do not suppress or silence the error without fixing the root cause
- Do not apply a workaround that masks the underlying issue
- Do not make unrelated changes while fixing the bug
</constraints>

<output_format>
1. {Fix description with exact code changes}
2. {Root cause analysis — why the bug existed}
3. {Regression test added or updated}
4. {Before/after behavior comparison}
</output_format>

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

<motivation>
High severity — users unable to log in intermittently. Reported by multiple production users since Privy SDK update last week. Directly impacts conversion and user retention.
</motivation>

<requirements>
1. **Fix verification**: Login button works reliably on throttled network (Slow 3G)
2. **Regression test**: Automated test covering Privy SDK initialization timing
3. **Root cause documented**: Root cause analysis in PR description
</requirements>

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
- Do not suppress or silence the error without fixing the root cause
- Do not apply a workaround that masks the underlying issue
- Do not make unrelated changes while fixing the bug
</constraints>

<output_format>
1. Fix description with code changes
2. Root cause analysis
3. Regression test file
4. Before/after behavior comparison
</output_format>

<success_criteria>
- Login modal opens reliably on every click
- Button shows loading state during initialization
- Works on throttled network (Slow 3G)
- No regression in logout functionality
</success_criteria>
```
