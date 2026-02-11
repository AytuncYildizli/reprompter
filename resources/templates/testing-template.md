# Testing Template

Use this template for writing tests (unit, integration, E2E).

## Template

```xml
<role>
{QA engineer specializing in [test type] testing with [detected testing framework]}
</role>

<context>
- Test framework: {auto-detected: Jest, Vitest, Playwright, etc.}
- Target: {file/component/feature to test}
- Existing coverage: {current test status if known}
- CI integration: {GitHub Actions, etc. if detected}
</context>

<task>
Write {test type} tests for {target} covering {scope}.
</task>

<coverage_requirements>
1. **Happy path**: {main successful flow}
2. **Error states**: {validation errors, API failures, edge cases}
3. **Edge cases**: {boundary conditions, empty states, limits}
4. **Integration points**: {if testing integrations}
</coverage_requirements>

<constraints>
- Use existing test patterns from codebase
- Tests must be independent (no shared state)
- Mock external dependencies appropriately
- Keep test execution time reasonable
</constraints>

<output_format>
1. Test file(s) in appropriate directory
2. Any necessary test utilities/mocks
3. Brief description of coverage achieved
</output_format>

<success_criteria>
- All tests pass locally
- Tests pass in CI pipeline
- Coverage includes happy path + error states
- Tests are readable and maintainable
</success_criteria>
```

## When to Use

- Adding tests to new features
- Improving test coverage
- Writing regression tests after bugfixes
- Setting up E2E test suites

## Example

**Raw input:** "write tests for the checkout flow"

**Generated:**
```xml
<role>
QA engineer specializing in E2E testing with Playwright and React component testing with Vitest.
</role>

<context>
- Test frameworks: Vitest (unit), Playwright (E2E)
- Target: Checkout flow (cart → shipping → payment → confirmation)
- Existing coverage: Cart tests exist, checkout untested
- CI: GitHub Actions with Playwright
</context>

<task>
Write comprehensive E2E tests for the checkout flow covering the complete purchase journey.
</task>

<coverage_requirements>
1. **Happy path**:
   - Add items to cart
   - Proceed to checkout
   - Fill shipping details
   - Complete payment (test mode)
   - Verify confirmation page
2. **Error states**:
   - Invalid shipping address
   - Payment declined
   - Session timeout
   - Out of stock during checkout
3. **Edge cases**:
   - Empty cart checkout attempt
   - Maximum quantity limits
   - Coupon code application
   - Guest vs authenticated checkout
</coverage_requirements>

<constraints>
- Use Stripe test mode for payments
- Mock inventory API for out-of-stock tests
- Tests must complete in under 2 minutes total
- Don't create real orders in test database
</constraints>

<output_format>
1. tests/e2e/checkout.spec.ts - main E2E tests
2. tests/e2e/fixtures/checkout-data.ts - test data
3. tests/e2e/utils/checkout-helpers.ts - helper functions
</output_format>

<success_criteria>
- All checkout paths tested (happy + error)
- Tests pass locally and in CI
- No flaky tests (run 3x without failure)
- Coverage report shows checkout at 80%+
</success_criteria>
```
