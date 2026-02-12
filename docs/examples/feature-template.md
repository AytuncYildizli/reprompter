# Feature Template

Use this template for building new features or functionality.

## Template

```xml
<role>
{Senior developer with expertise in [detected framework/language] and [relevant domain]}
</role>

<context>
- Framework: {auto-detected or user-provided}
- Current state: {what exists}
- Related files: {relevant files mentioned or detected}
- Dependencies: {relevant packages/libraries}
</context>

<task>
{Single clear sentence describing the feature to build}
</task>

<motivation>
{Why this feature matters — user impact, business value, priority}
</motivation>

<requirements>
1. **Core functionality**: {Primary requirement — the main feature behavior}
2. **Supporting features**: {Secondary requirement — complementary functionality}
3. **Edge cases**: {Tertiary requirement — error states, empty states, UX considerations}
</requirements>

<constraints>
- Do not modify {protected files/systems}
- Use existing {patterns/libraries/styles}
- Keep changes isolated to {scope}
- Maintain backward compatibility with {existing features}
- Do not add unrelated refactoring or "improvements" outside the feature scope
- Do not introduce new dependencies when existing libraries suffice
- Do not skip edge case handling for the sake of quick delivery
</constraints>

<output_format>
1. Implementation files (components, services, etc.)
2. Any necessary configuration changes
3. Brief explanation of key decisions
</output_format>

<success_criteria>
- {Primary functionality works as described}
- {Edge cases handled appropriately}
- {No regression in existing functionality}
- {Code follows project conventions}
</success_criteria>
```

## When to Use

- Adding new functionality to existing codebase
- Implementing user stories or feature requests
- Extending existing features with new capabilities

## Example

**Raw input:** "add search to the products page"

**Generated:**
```xml
<role>
Senior frontend developer with expertise in React, search UX, and performance optimization.
</role>

<context>
- Framework: Next.js 14 with App Router
- Current state: Products page displays list, no search
- Related files: src/app/products/page.tsx, src/components/ProductList.tsx
- Data source: Prisma with PostgreSQL
</context>

<task>
Add a search functionality to the products page that filters products by name and description in real-time.
</task>

<motivation>
Users frequently request search on the products page. Current browsing-only experience leads to high bounce rates. Search is the #2 most requested feature in user feedback.
</motivation>

<requirements>
1. Search input field at top of products page
2. Real-time filtering as user types (debounced)
3. Highlight matching text in results
4. Show "no results" state when nothing matches
</requirements>

<constraints>
- Use existing UI components from design system
- Keep filtering client-side for small datasets
- Do not modify ProductCard component
- Preserve existing URL structure
- Do not add unrelated refactoring or "improvements" outside the feature scope
- Do not introduce new dependencies when existing libraries suffice
- Do not skip edge case handling for the sake of quick delivery
</constraints>

<output_format>
1. SearchInput component
2. Updated ProductsPage with search integration
3. useProductSearch hook for filter logic
</output_format>

<success_criteria>
- Search filters products as user types
- Results update within 300ms of typing
- Empty state shows helpful message
- Search clears properly
</success_criteria>
```
