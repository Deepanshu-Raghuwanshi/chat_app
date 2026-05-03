# Frontend Development Guidelines

This document outlines the coding standards, patterns, and best practices for frontend development.

## 1. Core Philosophy

- **DRY (Don't Repeat Yourself)**: Abstract reusable logic into hooks, utilities, or shared components. However, avoid over-abstraction; two instances of similar code are often better than one "god" abstraction.
- **YAGNI (You Ain't Gonna Need It)**: Don't implement features or abstractions until they are actually needed. Build for today, but keep tomorrow in mind.
- **KISS (Keep It Simple, Stupid)**: Favor simple, readable code over clever, complex solutions.
- **Performance First**: Always consider the performance implications of your code (re-renders, bundle size, API calls).
- **Strict Typing**: Never use `any`. Always use proper TypeScript types or `unknown` with type narrowing. This ensures code reliability and catches errors early.

## 2. Component Patterns

### 2.1 Functional Components
- Use **Function Components (FC)** with explicit prop types.
- Favor **Composition** over inheritance or complex prop drilling.
- Use `children` for wrapper components.

```tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button = ({ label, onClick, variant = 'primary' }: ButtonProps) => {
  return (
    <button className={cn('btn', variant)} onClick={onClick}>
      {label}
    </button>
  );
};
```

### 2.2 Controlled vs. Uncontrolled
- Use **Controlled Components** for forms and inputs where state needs to be synchronized.
- Use **Uncontrolled Components** (refs) for performance-critical inputs or simple forms.

### 2.3 Separation of Concerns
- **Presentational Components**: Focus on UI/UX, accept props, and emit events.
- **Container/Feature Components**: Focus on logic, data fetching, and state management.

## 3. State Management

### 3.1 Global Client State (Zustand)
- Use Zustand for truly global state (e.g., Auth, Theme, User Settings).
- Keep stores small and focused on a single domain.

### 3.2 Server State (React Query)
- Use TanStack Query for **all** server-side data fetching.
- Use `useQuery` for fetching and `useMutation` for actions.
- Leverage caching and optimistic updates where appropriate.

### 3.3 Local State
- Default to `useState` or `useReducer` for component-specific state.
- Lift state up only when necessary for communication between siblings.

## 4. Performance Optimization

- **Memoization**: Use `useMemo` for expensive calculations and `useCallback` for functions passed to memoized children.
- **Dynamic Imports**: Use `next/dynamic` for heavy components or those not needed on initial load.
- **Image Optimization**: Always use `next/image` for automatic optimization and lazy loading.
- **Dependency Optimization**: Avoid importing entire libraries (e.g., `lodash`); import only the needed functions.

## 5. Naming Conventions

- **Files/Folders**: `kebab-case.tsx` or `kebab-case.ts`.
- **Components**: `PascalCase`.
- **Hooks**: `useCamelCase`.
- **Variables/Functions**: `camelCase`.
- **Constants**: `UPPER_SNAKE_CASE`.

## 6. Error Handling & Validation

- Use **Zod** for schema validation (API responses, forms).
- Use **Error Boundaries** to catch and handle UI crashes gracefully.
- Use the central `toast` utility for user-facing errors.

## 7. Styling (Tailwind CSS)

- Use the `cn()` utility for conditional class merging.
- Follow the **Mobile First** approach with responsive utilities (`sm:`, `md:`, `lg:`).
- Use CSS variables for theme-specific colors or values.

## 9. Internationalization (i18n)

We use **next-intl** for internationalization in the App Router.

- **Translation Files**: All user-facing strings must be defined in JSON files inside `apps/frontend/messages/` (e.g., `en.json`).
- **Keys**: Use a nested structure to organize keys by domain/feature (e.g., `"features": { "auth": { "login": { "title": "Login" } } }`).
- **Hooks**: Use the `useTranslations` hook from `next-intl` in client components and `getTranslations` in server components.
- **Common Strings**: Shared strings (e.g., "Submit", "Cancel", "Save") should be placed in a `common` namespace.
- **Avoid Hardcoding**: Never hardcode user-facing strings in components. Always use a translation key.

```tsx
import { useTranslations } from 'next-intl';

export const MyComponent = () => {
  const t = useTranslations('features.my-feature');
  return <h1>{t('title')}</h1>;
};
```
