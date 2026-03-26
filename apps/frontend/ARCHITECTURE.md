# Frontend Architecture

## Core Stack
- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) for client state, [TanStack Query](https://tanstack.com/query/latest) for server state.
- **Internationalization**: [next-intl](https://next-intl-docs.vercel.app/) for multi-language support.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), [clsx](https://github.com/lukeed/clsx), [tailwind-merge](https://github.com/dcastil/tailwind-merge).
- **Icons**: [Lucide React](https://lucide.dev/).
- **Notifications**: [Sonner](https://emilkowalski.com/sonner).

## Project Structure
The frontend follows a **Feature-based organization** within the `src/` directory to maintain scalability:

- **`src/core/`**: Core providers, global configurations, and initialization logic.
- **`src/features/`**: Domain-specific logic, components, hooks, and stores (e.g., `auth`, `chat`).
- **`src/shared/`**: Reusable components, utilities, and hooks shared across features.
- **`messages/`**: Internationalization translation files (`en.json`, `es.json`, etc.).
- **`app/`**: Next.js App Router pages and layouts, acting as thin wrappers around feature components.

## Data Fetching & API
- **Client**: Axios with standardized interceptors.
- **Authentication**: JWT-based auth using HttpOnly cookies.
- **Silent Refresh**: Automatic token rotation via axios interceptors on 401 responses.
- **Contracts**: Uses shared types generated from the root OpenAPI specifications.

## Testing
Comprehensive testing strategy covering multiple levels:
- **Unit & Integration**: [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).
- **E2E**: [Playwright](https://playwright.dev/).
- **Simulation**: Custom `simulate` utility for consistent user action testing.

For detailed testing guidelines, see [./docs/TESTING_GUIDELINES.md](./docs/TESTING_GUIDELINES.md).

## Documentation Links
- [Authentication Implementation](./docs/auth-implementation.md)
- [Development Guidelines](./docs/DEVELOPMENT_GUIDELINES.md)
- [Testing Guidelines](./docs/TESTING_GUIDELINES.md)
- [Root Development Guide](../../DEVELOPMENT_GUIDE.md)
