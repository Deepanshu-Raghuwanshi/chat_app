# Internationalization (i18n) Implementation Plan

This document outlines the steps to implement internationalization in the frontend using `next-intl`.

## 1. Setup & Dependencies

- **Install `next-intl`**:
  ```bash
  pnpm add next-intl
  ```

## 2. Configuration

### 2.1 translation files
- Create `apps/frontend/messages/` directory.
- Create `en.json` as the base translation file.
- Structure:
  ```json
  {
    "common": {
      "buttons": {
        "save": "Save",
        "cancel": "Cancel",
        "delete": "Delete"
      },
      "errors": {
        "generic": "Something went wrong"
      }
    },
    "features": {
      "auth": {
        "login": {
          "title": "Login to Chat App",
          "email_label": "Email Address",
          "password_label": "Password"
        }
      }
    }
  }
  ```

### 2.2 Next.js Configuration
- Wrap `next.config.js` with `withNextIntl`.
  ```javascript
  const withNextIntl = require('next-intl/plugin')();
  module.exports = withNextIntl({
    // ...existing config
  });
  ```

### 2.3 i18n middleware & config
- Create `apps/frontend/src/i18n/request.ts` to handle loading messages.
- Update `apps/frontend/middleware.ts` to include locale routing.

## 3. Integration in Layout

- Update `apps/frontend/app/layout.tsx` to include `NextIntlClientProvider`.
- Fetch messages for the current locale on the server side.

## 4. Component Implementation

- **Identify Hardcoded Strings**: Audit components in `src/shared/components` and `src/features`.
- **Replace with `useTranslations`**:
  ```tsx
  const t = useTranslations('common.buttons');
  return <button>{t('save')}</button>;
  ```

## 5. Migration Strategy

1.  **Phase 1: Core Layout & Shared Components**: Implement i18n in Navbar, Sidebar, and common UI elements.
2.  **Phase 2: Authentication Feature**: Migrate login, signup, and profile pages.
3.  **Phase 3: Chat Feature**: Migrate message lists, chat inputs, and settings.
4.  **Phase 4: Cleanup**: Remove any remaining hardcoded strings.

## 7. Testing Requirements

All tests for components using i18n must be updated to avoid errors related to missing `NextIntlClientProvider`.

- **Custom Render Utility**: Create `apps/frontend/tests/utils/render.tsx` that wraps `@testing-library/react`'s `render` with `NextIntlClientProvider`.
- **Mock Messages**: Use the `en.json` file as the source for messages in the test provider to maintain the ability to search for text in tests.
- **Update Existing Tests**: Migrate all existing tests in `apps/frontend/tests/unit/` to use the custom `render` utility.
- **E2E Tests**: Ensure Playwright tests use the default locale or are updated to handle multiple locales if needed. Use `data-testid` where possible to avoid brittle text-based selectors.

```tsx
// Example test-render.tsx
import { render as rtlRender } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';

function render(ui: React.ReactElement, { locale = 'en', ...options } = {}) {
  return rtlRender(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
    options
  );
}
```
