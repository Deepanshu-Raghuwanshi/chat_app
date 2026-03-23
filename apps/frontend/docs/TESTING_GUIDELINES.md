# Frontend Testing Guidelines

This document provides guidelines and best practices for writing tests in the frontend application.

## Testing Stack
- **Framework**: [Vitest](https://vitest.dev/)
- **Environment**: [jsdom](https://github.com/jsdom/jsdom)
- **Library**: [React Testing Library (RTL)](https://testing-library.com/docs/react-testing-library/intro/)
- **Simulation**: [user-event](https://testing-library.com/docs/user-event/intro/)

## Test Organization
- **Unit Tests**: `apps/frontend/tests/unit/` (Component-level, hook-level, or utility-level tests)
- **Integration Tests**: `apps/frontend/tests/integration/` (Complex flows, multiple components interacting)
- **E2E Tests**: `apps/frontend/tests/e2e/` (Managed by Playwright)

## Best Practices
1. **Test User Behavior**: Focus on what the user sees and does, rather than implementation details.
2. **Use `simulate` Utility**: For all user interactions (clicks, typing, selection), use the central `simulate` utility.
3. **Prefer `getByRole`**: Always try to find elements by their accessibility roles first.
4. **Mock API Calls**: Use MSW (Mock Service Worker) if available, or manual Vitest mocks for data fetching.
5. **Snapshot Testing**: Use sparingly for stable UI components.
6. **Strict Typing in Tests**: Avoid using `any` in tests. Use `vi.mocked()` for typed mocks and `ReturnType<typeof hook>` for mocked hook values to ensure tests are type-safe.

## Simulating User Actions
To ensure consistency across tests, always use the `simulate` utility located at `apps/frontend/tests/utils/simulate.ts`.

Example:
```typescript
import { render, screen } from '@testing-library/react';
import { simulate } from '../utils/simulate';
import { MyComponent } from './MyComponent';

test('should handle user login', async () => {
  render(<MyComponent />);
  
  await simulate.type(screen.getByLabelText(/username/i), 'johndoe');
  await simulate.type(screen.getByLabelText(/password/i), 'password123');
  await simulate.click(screen.getByRole('button', { name: /login/i }));
  
  expect(await screen.findByText(/welcome/i)).toBeInTheDocument();
});
```
