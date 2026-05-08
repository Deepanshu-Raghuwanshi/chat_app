**Before reading any files or running any commands, do this first:**

Parse `$ARGUMENTS`. The user may have passed just a feature name, or a feature name plus a path to a requirement spec document.

- If `$ARGUMENTS` includes a file path to a requirement spec (e.g. `docs/specs/friend-search.md`, `specs/chat-feature.md`, or any `.md`/`.txt` path), read that file now. The spec is your **source of truth** — every screen, flow, interaction, and copy must trace back to it.
- If `$ARGUMENTS` contains only a feature name with no spec reference, **stop and ask the user**:

  > "Do you have a requirement spec or design document for **[feature name]**? If so, paste the file path (e.g. `docs/specs/friend-search.md`) or paste its contents directly — I'll use it as the source of truth for what to build. If you don't have one, reply **skip** and I'll implement against the OpenAPI spec only."

  Wait for the user's reply before proceeding. If they provide a spec, read it. If they reply "skip" or "no", continue using the OpenAPI spec.

---

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
- libs/openapi-specs/src/v1/ (list all files and read the relevant one for this feature)

---

You are implementing the frontend spec for: **$ARGUMENTS**

You are acting as a **senior frontend engineer** on this project. You know the codebase deeply, you think in components and data flows before opening any file, and you write production-quality code on the first pass. You never create a file without first knowing why it needs to exist. You anticipate every UI state a user can encounter — not just the happy path.

---

## Phase 1 — Understand Before You Build

Before writing a single line of code, answer these questions out loud (write them as a short analysis in your response):

1. **Which feature folder owns this?** (`src/features/auth`, `src/features/chat`, `src/features/friends`, `src/features/profile`, or a new folder?)
2. **What does the OpenAPI spec define?** List every endpoint: method, URL, request body, response shape, and error codes.
3. **If a requirement spec was provided**, enumerate every screen, user flow, interaction, and piece of copy it describes. Note anything the OpenAPI spec doesn't capture (empty states, confirmation dialogs, redirect behaviour, error messages).
4. **What UI states must be handled?** For every view: loading, empty/zero-results, error, and success. Never ship a component that silently fails.
5. **Does this feature involve a form?** If so: what fields, what validations, what happens on submit, what happens on error?
6. **What global state is affected?** Does a mutation need to update the Zustand auth store, or is TanStack Query cache invalidation enough?
7. **What existing components, hooks, or services can be reused?** Do not create new files for things that already exist.
8. **What are the new i18n keys needed?** List them under the correct `features.<feature>` namespace before writing any JSX.
9. **What new routes (pages) are needed?** Where do they live in `app/`?
10. **Are there any accessibility requirements?** Keyboard navigation, ARIA roles, focus management after mutations.

Write your answers as a brief pre-implementation plan. Only proceed to implementation once the plan is clear.

---

## Phase 2 — Check for Existing Reusables (do this before creating anything)

Before writing a single new file, scan the frontend:

1. **Shared UI components** — check `src/shared/components/ui/` (Avatar, Spinner) and `src/shared/components/` (Navbar, AnimatedBackground). Reuse before creating.
2. **Feature components** — check `src/features/<feature>/components/` for a similar component. Extend rather than duplicating.
3. **Custom hooks** — check `src/features/<feature>/hooks/` for an existing TanStack Query hook that already fetches or mutates the same resource. Add to the existing hook file if related.
4. **Services** — check `src/features/<feature>/services/` for an existing Axios service file. Add new calls to it — do NOT create a second service file for the same feature.
5. **Zustand store** — check `src/features/auth/store/useAuthStore.ts`. Only extend it if this feature truly requires new global client state.
6. **Shared utilities** — `cn()` and `showToast` are always available. Never reimplement these.
7. **i18n keys** — check `messages/en.json` for existing keys before adding new ones. Nest under the correct feature namespace.
8. **Shared types** — check `libs/shared-types/src/index.ts` before defining local types.

**Rule:** Only create a new file if nothing reusable exists. Grep before creating.

---

## Phase 3 — Implementation (follow this order exactly)

### Step 1 — Types (`src/features/<feature>/types/<feature>.types.ts` or `libs/shared-types`)

Define all TypeScript interfaces matching the OpenAPI spec response shapes exactly. These are the contracts the rest of the feature depends on — get them right first.

```typescript
// Mirror the OpenAPI spec exactly — field names, optionality, and types must match
export interface <Name> {
  id: string;
  userId: string;
  someField: string;
  optionalField?: string;
  createdAt: string; // ISO string from API — convert to Date only when displaying
}

export interface <Name>ListResponse {
  items: <Name>[];
  total: number;
  page: number;
  limit: number;
}

export interface Create<Name>Payload {
  someField: string;
  optionalField?: string;
}
```

---

### Step 2 — Service (`src/features/<feature>/services/<feature>.service.ts`)

Add all API calls for this feature to the existing service file. If none exists, create one:

```typescript
import axios from 'axios';
import type { <Name>, <Name>ListResponse, Create<Name>Payload } from '../types/<feature>.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const <feature>Service = {
  async getAll(page = 1, limit = 20): Promise<<Name>ListResponse> {
    const { data } = await axios.get(`${API_URL}/<resource>`, {
      params: { page, limit },
      withCredentials: true,
    });
    return data;
  },

  async getById(id: string): Promise<<Name>> {
    const { data } = await axios.get(`${API_URL}/<resource>/${id}`, {
      withCredentials: true,
    });
    return data;
  },

  async create(payload: Create<Name>Payload): Promise<<Name>> {
    const { data } = await axios.post(`${API_URL}/<resource>`, payload, {
      withCredentials: true,
    });
    return data;
  },

  async update(id: string, payload: Partial<Create<Name>Payload>): Promise<<Name>> {
    const { data } = await axios.patch(`${API_URL}/<resource>/${id}`, payload, {
      withCredentials: true,
    });
    return data;
  },

  async delete(id: string): Promise<void> {
    await axios.delete(`${API_URL}/<resource>/${id}`, { withCredentials: true });
  },
};
```

**Service rules:**
- Always `withCredentials: true` — auth uses HttpOnly cookies
- Every response typed — no `any`
- All calls for a feature live in one service file — no splitting by endpoint
- No business logic in services — only HTTP calls and response mapping

---

### Step 3 — Hook (`src/features/<feature>/hooks/use<Feature>.ts`)

```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { <feature>Service } from '../services/<feature>.service';
import { showToast } from '../../../shared/utils/toast';
import { useTranslations } from 'next-intl';

const QUERY_KEY = '<feature>' as const;

// Read hook
export const use<Feature>List = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', page, limit],
    queryFn: () => <feature>Service.getAll(page, limit),
    staleTime: 30_000, // set appropriately — data that changes rarely should not refetch every mount
  });
};

export const use<Feature>ById = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => <feature>Service.getById(id),
    enabled: !!id,
  });
};

// Write hooks
export const useCreate<Feature> = () => {
  const queryClient = useQueryClient();
  const t = useTranslations('features.<feature>');

  return useMutation({
    mutationFn: (payload: Create<Name>Payload) => <feature>Service.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
      showToast.success(t('createSuccess'));
    },
    onError: () => {
      showToast.error(t('errors.createFailed'));
    },
  });
};

export const useDelete<Feature> = () => {
  const queryClient = useQueryClient();
  const t = useTranslations('features.<feature>');

  return useMutation({
    mutationFn: (id: string) => <feature>Service.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
      showToast.success(t('deleteSuccess'));
    },
    onError: () => {
      showToast.error(t('errors.deleteFailed'));
    },
  });
};
```

**Hook rules:**
- `useQuery` for reads, `useMutation` for writes — never raw `useEffect` for fetching
- Invalidate the correct query keys on mutation success — lists must refresh after create/delete/update
- `showToast` from shared utils — never call Sonner directly
- No direct API calls in hooks — always delegate to service
- Set `staleTime` — don't leave it undefined for data that rarely changes
- `enabled: !!id` on queries that depend on a dynamic param

---

### Step 4 — Component (`src/features/<feature>/components/<Name>.tsx`)

Handle **all four UI states** in every data component — this is non-negotiable:

```typescript
'use client';

import { use<Feature>List } from '../hooks/use<Feature>';
import { useTranslations } from 'next-intl';
import { cn } from '../../../shared/utils/cn';
import { Spinner } from '../../../shared/components/ui/spinner';

interface <Name>Props {
  // explicit, minimal props — no raw API response objects passed as props
}

export const <Name> = ({ ... }: <Name>Props) => {
  const t = useTranslations('features.<feature>');
  const { data, isLoading, isError } = use<Feature>List();

  // Loading state — always show feedback, never a blank screen
  if (isLoading) return <Spinner />;

  // Error state — never silent failure
  if (isError) {
    return (
      <div role="alert" className={cn('...')}>
        {t('errors.loadFailed')}
      </div>
    );
  }

  // Empty state — never skip this — users need to know the list is empty, not broken
  if (!data?.items.length) {
    return (
      <div className={cn('...')}>
        {t('emptyState')}
      </div>
    );
  }

  // Success state
  return (
    <div className={cn('...')}>
      {data.items.map((item) => (
        <div key={item.id}> {/* always use item.id as key — never array index */}
          {/* render item */}
        </div>
      ))}
    </div>
  );
};
```

**Form component pattern (when the feature includes a form):**

```typescript
'use client';

import { useState } from 'react';
import { useCreate<Feature> } from '../hooks/use<Feature>';
import { useTranslations } from 'next-intl';
import { cn } from '../../../shared/utils/cn';

export const <Name>Form = () => {
  const t = useTranslations('features.<feature>');
  const { mutate, isPending } = useCreate<Feature>();
  const [field, setField] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation — only for UX, not as a security measure
    if (!field.trim()) {
      setError(t('errors.fieldRequired'));
      return;
    }

    mutate({ field });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="field-input">{t('fieldLabel')}</label>
      <input
        id="field-input"
        value={field}
        onChange={(e) => setField(e.target.value)}
        aria-describedby={error ? 'field-error' : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <span id="field-error" role="alert">
          {error}
        </span>
      )}
      {/* Disable submit while mutation is in-flight — prevents double-submit */}
      <button type="submit" disabled={isPending} aria-busy={isPending}>
        {isPending ? <Spinner /> : t('submitLabel')}
      </button>
    </form>
  );
};
```

**Component rules:**
- `'use client'` on every component that uses hooks, state, or browser APIs
- Every user-visible string uses `useTranslations` — zero hardcoded English in JSX
- `cn()` for all `className` values — never template literals or string concatenation
- `<Spinner />` for loading states — no custom spinners
- Components are thin — data fetching in hooks, API calls in services
- Always use `item.id` as the `key` prop — never array index
- Forms: disable submit while `isPending`, show `aria-busy`, associate labels with inputs

---

### Step 5 — Page (`app/<route>/page.tsx`)

Pages are thin wrappers:

```typescript
// Server component by default — no 'use client' unless this page itself needs browser APIs
import { <Name> } from '../../src/features/<feature>/components/<Name>';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '<Page Title>',
  description: '<Description for SEO>',
};

export default function <Route>Page() {
  return <Name />;
}
```

**Page rules:**
- All logic lives in `src/features/` — pages just render the feature component
- Add `metadata` export for public-facing pages
- Keep pages as server components unless they directly need browser APIs

---

### Step 6 — i18n Keys (`messages/en.json`)

Add all translation keys before writing any JSX that uses them:

```json
{
  "features": {
    "<feature>": {
      "title": "...",
      "submitLabel": "...",
      "createSuccess": "...",
      "deleteSuccess": "...",
      "emptyState": "No <items> yet.",
      "fieldLabel": "...",
      "errors": {
        "loadFailed": "Failed to load <items>. Please try again.",
        "createFailed": "Could not create <item>. Please try again.",
        "deleteFailed": "Could not delete <item>. Please try again.",
        "fieldRequired": "<Field> is required."
      }
    }
  }
}
```

**i18n rules:**
- Every user-visible string — including error messages, empty states, placeholders, button labels, and aria-labels — must have a translation key
- Nest under `features.<feature>` namespace
- Add error keys alongside action keys — not as an afterthought

---

### Step 7 — Write Tests

For every new component and hook added, create test files:

**Component test:**

```typescript
// apps/frontend/tests/<Name>.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { <Name> } from '../src/features/<feature>/components/<Name>';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('<Name>', () => {
  it('renders loading state while fetching', () => {
    // mock hook to return isLoading: true
    render(<Name />, { wrapper: createWrapper() });
    expect(screen.getByRole('status')).toBeInTheDocument(); // Spinner
  });

  it('renders error state when request fails', async () => {
    // mock hook to return isError: true
    render(<Name />, { wrapper: createWrapper() });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders empty state when list is empty', async () => {
    // mock hook to return empty items array
    render(<Name />, { wrapper: createWrapper() });
    expect(await screen.findByText(/no .* yet/i)).toBeInTheDocument();
  });

  it('renders items when data loads successfully', async () => {
    // mock hook to return populated items
    render(<Name />, { wrapper: createWrapper() });
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
  });

  it('calls mutation and shows toast on form submit', async () => {
    // test form submit flow
  });
});
```

**Test rules:**
- Test all four UI states: loading, error, empty, success
- Test form submission: success path, validation error, mutation error
- Test mutations: verify query invalidation happens on success
- No test shares state with another (each uses its own `QueryClient`)
- Test descriptions are specific — not "should work"

---

## Phase 4 — Automated Checks (run all, fix all failures before finishing)

```bash
pnpm nx typecheck frontend   # must pass with zero errors
pnpm nx lint frontend        # must pass with zero warnings
pnpm nx test frontend        # all tests must pass
```

Do not report the task as done until all three commands pass cleanly.

---

## Final Quality Checklist

- [ ] Requirement spec (if provided) — every stated screen, flow, and interaction is implemented
- [ ] OpenAPI spec — every endpoint consumed, every response type matched exactly
- [ ] No file created when an existing one could be extended
- [ ] All four UI states handled in every data component: loading, error, empty, success
- [ ] Forms: submit disabled while `isPending`, inputs have labels, errors shown accessibly
- [ ] All user-visible strings use `useTranslations` — zero hardcoded English in JSX
- [ ] All translation keys present in `messages/en.json` including error and empty state keys
- [ ] `cn()` used for all `className` values — no string concatenation
- [ ] `item.id` used as list `key` — never array index
- [ ] `useQuery` for reads, `useMutation` for writes — no `useState` + `useEffect` for fetching
- [ ] Mutations invalidate correct query keys on success
- [ ] `staleTime` set appropriately on all queries
- [ ] `showToast` used — Sonner never called directly
- [ ] `withCredentials: true` on all Axios calls
- [ ] No `any` types, no `@ts-ignore`, no unsafe `as` casts
- [ ] `'use client'` on every component/hook that uses React state or browser APIs
- [ ] Feature components in `src/features/<feature>/components/`, shared primitives in `src/shared/components/ui/`
- [ ] Page files are thin wrappers — logic lives in `src/features/`
- [ ] Public-facing pages have `metadata` export
- [ ] Tests written for every new component and hook — all four states covered
- [ ] `pnpm nx typecheck frontend` — zero errors
- [ ] `pnpm nx lint frontend` — zero warnings
- [ ] `pnpm nx test frontend` — all pass
