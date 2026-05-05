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

Then gather all local changes:

- Run `git status` to see all modified, added, and staged files
- Run `git diff HEAD --name-only` to list every changed file (filter to `apps/frontend/`)
- Read each changed frontend file in full
- Run `git branch --show-current` to get the branch name

You are reviewing the frontend implementation for: **$ARGUMENTS**

---

## Your Task

Review the local frontend changes for **$ARGUMENTS** against the OpenAPI spec, the project's feature-based architecture, existing patterns, and test requirements. Then write the full review to a `.md` file at:

```
reviews/frontend-<branch>-<YYYY-MM-DD>.md
```

Create the `reviews/` directory if it doesn't exist.

---

## Review Dimensions

### 1. Implementation Completeness — Is it 100% done?

Compare the changed code against the OpenAPI spec for this feature:

- Are ALL endpoints defined in the spec consumed by the frontend?
- Do request payloads and response types exactly match the spec (field names, types)?
- Are all UI states handled: loading, empty, error, and success?
- Are all user interactions wired up (clicks, form submits, navigations)?
- Are there any `TODO`, `FIXME`, or placeholder comments left in the code?
- Are all new routes added to the `app/` directory?
- Are all new i18n keys added to `messages/en.json`?

Flag anything partially implemented or missing entirely.

---

### 2. Pattern & Structure Compliance

Compare each new file against the pattern reference files loaded above. Flag deviations:

**Service files** — must follow `auth.service.ts` pattern:

- Plain object with async methods (not a class)
- All calls use `withCredentials: true`
- Base URL from `process.env.NEXT_PUBLIC_API_URL`
- All responses typed — no `any`
- One service file per feature in `src/features/<feature>/services/`

**Hook files** — must follow `useAuth.ts` pattern:

- `useQuery` for reads, `useMutation` for writes
- Mutations invalidate relevant query keys on `onSuccess`
- `showToast.success/error` used for user feedback — never Sonner directly
- Zustand store updated when global auth/user state changes
- One hook file per feature in `src/features/<feature>/hooks/`

**Component files** — must follow `FriendList.tsx` / `LoginForm.tsx` pattern:

- `'use client'` directive on components that use hooks or state
- `useTranslations` for every user-visible string
- `cn()` for all `className` values — never string concatenation
- `<Spinner />` for loading states
- No business logic — data fetching in hooks, API calls in services
- Feature components in `src/features/<feature>/components/`
- Shared/reusable primitives in `src/shared/components/ui/`

**Page files** — thin wrappers in `app/<route>/page.tsx`:

- Server components unless browser APIs are needed
- Import and render one feature component — nothing else

---

### 3. No Duplicate Code

- Were existing shared components (Avatar, Spinner, Navbar) reused?
- Were existing hooks extended rather than duplicated?
- Were existing service files extended rather than new files created for the same feature?
- Were types from `libs/shared-types` used instead of locally redefined?
- Were `cn()` and `showToast` utilities used — not reimplemented?

---

### 4. Test Coverage — Are all tests written?

For every new component and hook added, verify:

- [ ] Test file exists at `apps/frontend/tests/` or alongside the component
- [ ] Tests follow the same structure and tooling as existing frontend tests
- [ ] Component tests cover: render, user interactions, loading state, error state
- [ ] Hook tests cover: success response, error response, cache invalidation

If significant logic is added with no tests, that is a **Blocker**.

---

### 5. i18n Completeness

- [ ] Every user-visible string uses `useTranslations` — no hardcoded English in JSX
- [ ] All new translation keys added to `messages/en.json` under the correct `features.<feature>` namespace
- [ ] No translation key is referenced in code but missing from `messages/en.json`
- [ ] Error message keys exist alongside action keys

---

### 6. State Management

- [ ] TanStack Query used for all server state (not `useState` + `useEffect` for fetching)
- [ ] Zustand only used for global client state (auth user) — not for UI or server state
- [ ] Mutations invalidate the correct query keys on success
- [ ] No stale data shown after a mutation (cache properly invalidated)

---

### 7. Security & API Correctness

- [ ] All Axios calls use `withCredentials: true`
- [ ] No API keys, tokens, or secrets hardcoded in frontend code
- [ ] No sensitive data stored in `localStorage` directly (Zustand persist handles auth)
- [ ] User input that reaches the API is passed as-is — no client-side sanitization hiding validation that belongs on the backend

---

### 8. TypeScript Quality

- [ ] No `any` types
- [ ] No unsafe type assertions (`as SomeType`)
- [ ] Props interfaces defined for every component
- [ ] API response types match the OpenAPI spec shapes
- [ ] No `@ts-ignore` or `@ts-nocheck`

---

### 9. Accessibility & UX Basics

- [ ] Interactive elements are keyboard accessible (buttons, links, inputs)
- [ ] Images have `alt` attributes
- [ ] Form inputs have associated labels
- [ ] Loading and error states are shown — not silent failures

---

### 10. Automated Checks — Run All of These

Run the following commands against the frontend app. Record the actual output (pass/fail + any errors) — do NOT skip any step:

```bash
# 1. Type checking
pnpm nx typecheck frontend

# 2. Lint
pnpm nx lint frontend

# 3. Prettier format check
pnpm nx format:check frontend

# 4. Tests
pnpm nx test frontend
```

If any command fails, every failure is a **Blocker**. Include the exact error output in the review file under Blockers.

---

## Output Format

Write the review to `reviews/frontend-<branch>-<YYYY-MM-DD>.md` using exactly this structure:

```markdown
# Frontend Spec Review: <branch> — <YYYY-MM-DD>

## Summary

### What Is Implemented

- Bullet list of everything fully complete and working as intended

### What Is Pending / Incomplete

- Bullet list of missing pieces, partial implementations, or leftover TODOs
- Write "Nothing pending" if everything is complete

---

## Automated Checks

| Check                           | Result            | Notes                   |
| ------------------------------- | ----------------- | ----------------------- |
| `pnpm nx typecheck frontend`    | ✅ Pass / ❌ Fail | error summary if failed |
| `pnpm nx lint frontend`         | ✅ Pass / ❌ Fail | error summary if failed |
| `pnpm nx format:check frontend` | ✅ Pass / ❌ Fail | error summary if failed |
| `pnpm nx test frontend`         | ✅ Pass / ❌ Fail | error summary if failed |

---

## Files Changed

| File               | Type                       | Description                          |
| ------------------ | -------------------------- | ------------------------------------ |
| `path/to/file.tsx` | Added / Modified / Deleted | One-line description of what changed |

---

## Blockers — Must Fix

> Breaks functionality, missing tests, missing i18n keys, or violates architecture. Cannot merge until resolved.

- **`path/to/file.tsx`** — description of problem and required fix
- _(None)_ if no blockers

---

## Nitpicks — Should Fix

> Non-blocking: style, minor conventions, small improvements.

- **`path/to/file.tsx`** — description
- _(None)_ if no nitpicks

---

## Verdict

**Ready to merge / Needs changes / Major rework required**

One paragraph: completeness assessment, most critical issue, and overall confidence in the implementation quality.
```

After writing the file, print the full path so the user can open it directly.
