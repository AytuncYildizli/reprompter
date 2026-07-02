# UI Component Template

Use this template for frontend component development.

## Template

```xml
<role>
{Frontend developer specializing in [React/Vue/etc.], [styling approach], and accessible UI development}
</role>

<context>
- Framework: {React, Vue, Svelte, etc.}
- Styling: {Tailwind, CSS Modules, styled-components, etc.}
- Design system: {if exists}
- Component library: {shadcn, Radix, MUI, etc.}
</context>

<component_spec>
- Name: {ComponentName}
- Purpose: {what the component does}
- Variants: {different states/variations}
- Props: {expected props interface}
</component_spec>

<task>
Create {ComponentName} component that {does what}.
</task>

<motivation>
{User experience impact, design system alignment, accessibility}
</motivation>

<requirements>
1. **Functionality**: {core behavior}
2. **Styling**: {visual requirements}
3. **Accessibility**: {a11y requirements}
4. **Responsiveness**: {mobile/desktop behavior}
</requirements>

<constraints>
- Follow existing component patterns
- Use design system tokens/variables
- Ensure keyboard navigation
- Support screen readers
- Do not use inline styles — use design tokens or CSS modules
- Do not break existing component API without migration path
- Do not add animations without respecting prefers-reduced-motion
</constraints>

<output_format>
1. Component file(s)
2. Types/interfaces
3. Storybook story (if using Storybook)
4. Basic unit tests
</output_format>

<success_criteria>
- Component renders correctly
- All variants work as expected
- Passes accessibility audit
- Works on mobile and desktop
</success_criteria>
```

## When to Use

- Creating new UI components
- Building design system components
- Implementing UI features
- Creating reusable patterns

## Example

**Raw input:** "make a notification toast component"

**Generated:**
```xml
<role>
Frontend developer specializing in React, Tailwind CSS, accessible UI patterns, and animation.
</role>

<context>
- Framework: Next.js 14 with React 18
- Styling: Tailwind CSS with custom design tokens
- Design system: Custom components in src/components/ui/
- Component library: Radix UI primitives
</context>

<component_spec>
- Name: Toast / ToastProvider
- Purpose: Display temporary notification messages
- Variants: success, error, warning, info
- Props:
  - message: string
  - variant: 'success' | 'error' | 'warning' | 'info'
  - duration?: number (default 5000ms)
  - action?: { label: string, onClick: () => void }
</component_spec>

<task>
Create a Toast notification system with provider, hook, and toast component that supports multiple simultaneous toasts with animations.
</task>

<motivation>
App currently has no notification system — errors and confirmations go unnoticed. Aligns with the design system's feedback component roadmap. Accessibility audit flagged missing status announcements.
</motivation>

<requirements>
1. **Functionality**:
   - Show toast with message and variant
   - Auto-dismiss after duration
   - Manual dismiss on click
   - Queue multiple toasts (max 3 visible)
   - Optional action button
2. **Styling**:
   - Variant colors (green/red/yellow/blue)
   - Slide-in animation from top-right
   - Fade-out on dismiss
   - Icon per variant
3. **Accessibility**:
   - role="alert" for important messages
   - aria-live="polite" for info
   - Focusable dismiss button
   - Keyboard dismissible (Escape)
4. **Responsiveness**:
   - Full-width on mobile
   - Fixed width on desktop
   - Stack vertically
</requirements>

<constraints>
- Use Radix Toast primitive as base
- Follow existing design system colors
- No external toast libraries
- Support both light and dark mode
- Do not use setTimeout for debounce — use a proper debounce utility
- Do not break existing ProductCard component API
</constraints>

<output_format>
1. src/components/ui/Toast/Toast.tsx - Toast component
2. src/components/ui/Toast/ToastProvider.tsx - Context provider
3. src/components/ui/Toast/useToast.ts - Hook for triggering toasts
4. src/components/ui/Toast/index.ts - Exports
5. src/components/ui/Toast/Toast.stories.tsx - Storybook stories
</output_format>

<success_criteria>
- Toasts appear with correct styling per variant
- Auto-dismiss works with configurable duration
- Multiple toasts stack properly
- Animations are smooth (60fps)
- Accessible (passes axe audit)
- Works in light and dark mode
</success_criteria>
```
