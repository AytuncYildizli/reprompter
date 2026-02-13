# Refactor Template

Use this template for code refactoring and improvement.

## Template

```xml
<role>
{Senior developer specializing in [detected language/framework], code architecture, and refactoring patterns}
</role>

<context>
- Codebase: {framework and language}
- Target: {file(s)/module(s) to refactor}
- Current issues: {why refactoring is needed}
- Dependencies: {what depends on this code}
</context>

<current_state>
{Brief description of current implementation and its problems}
- Issue 1: {specific problem}
- Issue 2: {specific problem}
</current_state>

<target_state>
{What the code should look like after refactoring}
- Goal 1: {specific improvement}
- Goal 2: {specific improvement}
</target_state>

<task>
Refactor {target} to {achieve goals} while maintaining {preserved behavior}.
</task>

<motivation>
{Technical debt impact, maintenance burden, risk if not done}
</motivation>

<requirements>
1. **No behavior change**: {External behavior must remain identical}
2. **All tests pass**: {Existing test suite passes without modification}
3. **Measurable improvement**: {Quantifiable metric that improves — complexity, line count, performance}
</requirements>

<constraints>
- Maintain all existing functionality
- Keep public API/interfaces unchanged
- Preserve test coverage (update tests as needed)
- Make changes incrementally (reviewable commits)
- Do not combine refactoring with feature additions or bug fixes
- Do not change behavior — only structure and readability
- Do not refactor code that lacks test coverage without adding tests first
</constraints>

<output_format>
1. Refactored code files
2. Updated tests if needed
3. Brief explanation of changes made
</output_format>

<success_criteria>
- All existing tests pass
- No change in external behavior
- Code is more {readable/maintainable/performant}
- Changes are well-documented
</success_criteria>
```

## When to Use

- Improving code quality
- Reducing complexity
- Extracting reusable patterns
- Performance optimization
- Preparing for feature additions

## Example

**Raw input:** "this component is a mess, clean it up"

**Generated:**
```xml
<role>
Senior React developer specializing in component architecture, hooks patterns, and code maintainability.
</role>

<context>
- Codebase: Next.js 14 with TypeScript
- Target: src/components/Dashboard/DashboardPage.tsx (450 lines)
- Current issues: Monolithic component, mixed concerns, hard to test
- Dependencies: Used by 3 pages, has 5 child components
</context>

<current_state>
DashboardPage.tsx is a 450-line component with multiple issues:
- Issue 1: Data fetching, state management, and UI all in one file
- Issue 2: 8 useState hooks making state hard to track
- Issue 3: Inline styles mixed with Tailwind classes
- Issue 4: No separation between container and presentation
</current_state>

<target_state>
Clean, maintainable component architecture:
- Goal 1: Extract data fetching to custom hook (useDashboardData)
- Goal 2: Consolidate state with useReducer or context
- Goal 3: Separate container (logic) from presentational components
- Goal 4: Consistent styling approach (Tailwind only)
</target_state>

<task>
Refactor DashboardPage.tsx into a clean component architecture with separated concerns while maintaining all current functionality.
</task>

<motivation>
450-line monolithic component is the #1 source of merge conflicts. Adding new dashboard widgets takes 3x longer than it should. Technical debt is blocking the Q2 feature roadmap.
</motivation>

<requirements>
1. **No behavior change**: Dashboard renders identically before and after
2. **All tests pass**: Existing test suite passes without modification
3. **Measurable improvement**: Each file under 100 lines, single responsibility per file
</requirements>

<constraints>
- Maintain all existing functionality exactly
- Keep component props interface unchanged
- Don't change URL routes or data requirements
- Preserve existing test assertions
- Make each change a separate, reviewable commit
- Do not change route paths or response formats
- Do not combine this refactor with the planned auth migration
</constraints>

<output_format>
1. src/components/Dashboard/DashboardPage.tsx (container, ~50 lines)
2. src/components/Dashboard/DashboardView.tsx (presentation)
3. src/hooks/useDashboardData.ts (data fetching)
4. src/components/Dashboard/dashboardReducer.ts (state management)
5. Updated tests for new structure
</output_format>

<success_criteria>
- All existing tests pass without modification
- Component renders identically to before
- Each file is under 100 lines
- Single responsibility per file
- Easy to add new dashboard features
</success_criteria>
```
