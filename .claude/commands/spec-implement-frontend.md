Read the following files before doing anything else:

- apps/frontend/src/features/auth/components/LoginForm.tsx (component pattern reference)
- apps/frontend/src/features/auth/hooks/useAuth.ts (hook pattern reference)
- apps/frontend/src/features/auth/services/auth.service.ts (service pattern reference)
- apps/frontend/src/features/friends/components/FriendList.tsx (data component pattern reference)
- apps/frontend/src/shared/components/ui/Avatar.tsx (shared UI component pattern reference)
- apps/frontend/src/shared/utils/cn.ts (class utility)
- apps/frontend/src/shared/utils/toast.ts (toast utility)
- apps/frontend/messages/en.json (i18n keys structure)
- libs/shared-types/src/index.ts (shared types)

You are implementing the frontend spec for: **$ARGUMENTS**

---

## Your Task

Implement the full frontend feature for **$ARGUMENTS** following the project's Next.js App Router + feature-based architecture and established conventions.

First, identify:

1. Which feature folder owns this? (`src/features/auth`, `src/features/chat`, `src/features/friends`, `src/features/profile`, or new?)
2. Which API endpoints does it call? (check the OpenAPI spec in `libs/openapi-specs/src/v1/`)
3. Does it need client state (Zustand) or only server state (TanStack Query)?
4. Does it need new i18n keys?

---

## Implementation Order (follow this exactly)

### Step 0 — Check for Existing Reusables (ALWAYS do this before creating anything)

Before writing a single new file, scan the frontend for what already exists:

1. **Shared UI components** — check `src/shared/components/ui/` (Avatar, Spinner) and `src/shared/components/` (Navbar, AnimatedBackground). Reuse before creating.
2. **Feature components** — check `src/features/<feature>/components/` for a similar component. Extend it rather than duplicating.
3. **Custom hooks** — check `src/features/<feature>/hooks/` for existing TanStack Query hooks that already fetch or mutate the same resource. Add new query/mutation to the existing hook file if related.
4. **Services** — check `src/features/<feature>/services/` for an existing Axios service for this feature. Add new API calls to it — do NOT create a new service file for the same feature.
5. **Zustand store** — check `src/features/auth/store/useAuthStore.ts`. Only extend state if the feature truly requires global client state.
6. **Shared utilities** — `src/shared/utils/cn.ts` and `src/shared/utils/toast.ts` are always available. Never reimplement these.
7. **i18n keys** — check `messages/en.json` for existing keys before adding new ones. Nest new keys under the correct feature namespace.
8. **Shared types** — check `libs/shared-types/src/index.ts` before defining local types.

**Rule:** Only create a new file if nothing reusable exists. When in doubt, grep the component name or hook name before creating.

---

### Step 1 — Service (`src/features/<feature>/services/<feature>.service.ts`)

Add the API call to the existing service file for the feature. If none exists, create one:

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const <feature>Service = {
  async <action>(payload: <ActionDto>): Promise<<ResponseType>> {
    const { data } = await axios.post(`${API_URL}/<resource>`, payload, {
      withCredentials: true,
    });
    return data;
  },
};
```

Rules:

- Always `withCredentials: true` — auth uses HttpOnly cookies
- Type every response — no `any`
- All calls for a feature live in one service file

---

### Step 2 — Hook (`src/features/<feature>/hooks/use<Feature>.ts`)

Wrap the service in a TanStack Query hook. Add to the existing hook file if one exists:

```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { <feature>Service } from '../services/<feature>.service';
import { showToast } from '../../../shared/utils/toast';

// For reads:
export const use<FeatureData> = () => {
  return useQuery({
    queryKey: ['<feature>'],
    queryFn: () => <feature>Service.get<Feature>(),
  });
};

// For mutations:
export const use<Action><Feature> = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: <ActionDto>) => <feature>Service.<action>(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['<feature>'] });
      showToast.success('...');
    },
    onError: () => {
      showToast.error('...');
    },
  });
};
```

Rules:

- Always invalidate relevant query keys on mutation success
- Use `showToast` from `src/shared/utils/toast` — never call Sonner directly
- No business logic in hooks — only data fetching and cache management

---

### Step 3 — Component (`src/features/<feature>/components/<Name>.tsx`)

```typescript
'use client';

import { use<Feature> } from '../hooks/use<Feature>';
import { useTranslations } from 'next-intl';
import { cn } from '../../../shared/utils/cn';
import { Spinner } from '../../../shared/components/ui/spinner';

interface <Name>Props {
  // explicit, minimal props — no raw API data passed through
}

export const <Name> = ({ ... }: <Name>Props) => {
  const t = useTranslations('features.<feature>');
  const { data, isLoading } = use<Feature>();

  if (isLoading) return <Spinner />;

  return (
    <div className={cn('...')}>
      {/* content */}
    </div>
  );
};
```

Rules:

- `'use client'` on every component that uses hooks, state, or browser APIs
- Use `useTranslations` for ALL user-visible strings — no hardcoded English text
- Use `cn()` for all `className` values — never string concatenation
- Use `<Spinner />` for loading states
- Components are thin — data fetching goes in hooks, API calls go in services
- Reusable primitives (buttons, inputs, badges) belong in `src/shared/components/ui/`
- Feature-specific components stay in `src/features/<feature>/components/`

---

### Step 4 — Page (`app/<route>/page.tsx`)

Pages are thin wrappers — import and render the feature component:

```typescript
// Server component — no 'use client' unless this page itself needs browser APIs
import { <Name> } from '../../src/features/<feature>/components/<Name>';

export default function <Route>Page() {
  return <Name />;
}
```

Rules:

- Pages live in `app/` (Next.js App Router convention)
- Keep pages as server components unless they directly need hooks
- All logic lives in `src/features/` — not in `app/`

---

### Step 5 — i18n Keys (`messages/en.json`)

Add translation keys under the correct feature namespace:

```json
{
  "features": {
    "<feature>": {
      "<action>": "...",
      "errors": {
        "<errorKey>": "..."
      }
    }
  }
}
```

Rules:

- Never hardcode user-visible strings in components
- Nest under `features.<feature>` namespace
- Add error keys alongside action keys

---

## Quality Checklist Before Finishing

- [ ] Checked for existing components, hooks, and services before creating new files — no duplicates
- [ ] All user-visible strings use `useTranslations` — no hardcoded English
- [ ] All `className` values use `cn()` — no string concatenation
- [ ] Loading states handled with `<Spinner />`
- [ ] Mutations invalidate relevant query keys on success
- [ ] `showToast` used for user feedback — Sonner never called directly
- [ ] `withCredentials: true` on all Axios calls
- [ ] No `any` types anywhere
- [ ] `'use client'` on all components/hooks that use React state or browser APIs
- [ ] New reusable primitives added to `src/shared/components/ui/`, feature components to `src/features/<feature>/components/`
- [ ] New i18n keys added to `messages/en.json` under correct namespace
- [ ] Run `pnpm nx typecheck frontend` and fix all errors
- [ ] Run `pnpm nx lint frontend` and fix all warnings
