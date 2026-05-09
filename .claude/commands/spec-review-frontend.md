**Before reading any files or running any commands, do this first:**

Parse `$ARGUMENTS`. The user may have passed just a feature name, or a feature name plus a path to a requirement spec document.

- If `$ARGUMENTS` includes a file path to a requirement spec (e.g. `docs/specs/friend-search.md`, `specs/chat-feature.md`, or any `.md`/`.txt` path), read that file now and use it throughout the review.
- If `$ARGUMENTS` contains only a feature name with no spec reference, **stop and ask the user**:

  > "Do you have a requirement spec or design document for **[feature name]**? If so, paste the file path (e.g. `docs/specs/friend-search.md`) or paste its contents directly — the review will cross-check the implementation against it. If you don't have one, reply **skip** and I'll proceed using the OpenAPI spec and existing patterns only."

  Wait for the user's reply before proceeding. If they provide a spec, read it. If they reply "skip" or "no", continue without it and note "No requirement spec provided" in the review file.

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

Then gather all local changes:

- Run `git status` to see all modified, added, and staged files
- Run `git diff HEAD --name-only` to list every changed file (filter to `apps/frontend/`)
- Run `git diff HEAD -- apps/frontend/` to read the exact line-by-line diff — this is your primary review target
- Read each changed frontend file **in full** (not just the diff) so you see context around changes
- Run `git branch --show-current` to get the branch name

You are reviewing the frontend implementation for: **$ARGUMENTS**

---

## Your Task

Review the local frontend changes for **$ARGUMENTS** against the OpenAPI spec, the project's feature-based architecture, existing patterns, and test requirements. Apply maximum strictness — if something could be done better, flag it. Then write the full review to a `.md` file at:

```
reviews/frontend-<branch>-<YYYY-MM-DD>.md
```

Create the `reviews/` directory if it doesn't exist.

---

## Review Dimensions

### 0. Requirement Spec Compliance (only if a spec was provided)

If the user provided a requirement spec, this is your **highest-priority dimension**. Read the spec and verify the implementation against every requirement stated in it:

- Are all features/behaviours described in the spec implemented? List each requirement and mark it as implemented, partially implemented, or missing.
- Does the UI match the described flows, screens, interactions, and user-facing copy exactly?
- Are there UX requirements in the spec that the OpenAPI spec does not capture (e.g. empty state copy, redirect behaviour, confirmation dialogs, specific error messages)?
- Are there things implemented in the code that the spec explicitly says should NOT be present?
- Does the error handling and feedback match what the spec prescribes?

Any requirement from the spec that is missing or incorrect in the implementation is a **Blocker** — prefix it with **[SPEC]** in the Blockers section.

If no spec was provided, skip this section and write "No requirement spec provided — reviewed against OpenAPI spec and existing patterns only."

---

### 1. Implementation Completeness — Is it 100% done?

Compare the changed code against the OpenAPI spec for this feature:

- Are ALL endpoints defined in the spec consumed by the frontend?
- Do request payloads and response types exactly match the spec (field names, types)?
- Are all UI states handled: loading, empty/zero-results, error, and success?
- Are all user interactions wired up (clicks, form submits, navigations, keyboard)?
- Are there any `TODO`, `FIXME`, `HACK`, or placeholder comments left in the code?
- Are all new routes added to the `app/` directory?
- Are all new i18n keys added to `messages/en.json`?
- Are all error states shown to the user — no silent failures?

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
- No business logic in services — only HTTP calls and response mapping

**Hook files** — must follow `useAuth.ts` pattern:

- `useQuery` for reads, `useMutation` for writes — never raw `useEffect` for fetching
- Mutations invalidate relevant query keys on `onSuccess`
- `showToast.success/error` used for user feedback — never Sonner or alert() directly
- Zustand store updated when global auth/user state changes
- One hook file per feature in `src/features/<feature>/hooks/`
- No direct API calls inside hooks — always delegate to service

**Component files** — must follow `FriendList.tsx` / `LoginForm.tsx` pattern:

- `'use client'` directive on every component that uses hooks, state, or browser APIs
- `useTranslations` for every user-visible string — zero hardcoded English text in JSX
- `cn()` for all `className` values — never template literals or string concatenation
- `<Spinner />` for loading states — no custom inline spinners
- No business logic or data fetching in components — hooks handle data, services handle API
- Feature components in `src/features/<feature>/components/`
- Shared/reusable primitives in `src/shared/components/ui/`

**Page files** — thin wrappers in `app/<route>/page.tsx`:

- Server components by default — add `'use client'` only if browser APIs are needed
- Import and render one feature component — nothing else
- No data fetching or logic inline in page files

---

### 3. No Duplicate Code

- Were existing shared components (Avatar, Spinner, Navbar) reused — not reimplemented?
- Were existing hooks extended rather than new hooks created for the same feature?
- Were existing service files extended rather than new files created for the same feature?
- Were types from `libs/shared-types` used instead of locally redefined?
- Were `cn()` and `showToast` utilities used — not reimplemented?
- Is there copy-paste between components that should be extracted to a shared component?

---

### 4. Test Coverage — Are all tests written?

For every new component and hook added, verify:

- [ ] Test file exists at `apps/frontend/tests/` or colocated with the component
- [ ] Tests follow the same structure and tooling as existing frontend tests
- [ ] Component tests cover: render, user interactions, loading state, error state, empty state
- [ ] Hook tests cover: success response, error response, cache invalidation on mutation
- [ ] No test depends on another test's state (each test is isolated)
- [ ] Test descriptions are specific ("renders loading spinner while fetching" not "should work")

If significant logic is added with no tests, that is a **Blocker**.

---

### 5. i18n Completeness

- [ ] Every user-visible string uses `useTranslations` — no hardcoded English in JSX
- [ ] All new translation keys added to `messages/en.json` under the correct `features.<feature>` namespace
- [ ] No translation key is referenced in code but missing from `messages/en.json`
- [ ] Error message keys exist alongside action keys (not just success messages)
- [ ] Placeholder text, button labels, aria-labels, and tooltips all use translation keys

---

### 6. State Management

- [ ] TanStack Query used for all server state — never `useState` + `useEffect` for fetching
- [ ] Zustand only used for global client state (auth user) — not for local UI state or server cache
- [ ] Mutations invalidate the correct query keys on success so lists refresh
- [ ] No stale data shown after a mutation (cache properly invalidated or optimistically updated)
- [ ] No prop drilling beyond 2 levels — if data needs to go deeper, it should be in Zustand or a query

---

### 7. Performance & Re-render Optimization

This section is critical — flag anything that causes unnecessary work on every render:

- [ ] Lists have stable `key` props — never use array index as key for a list that can reorder or update
- [ ] Expensive computations inside render are wrapped in `useMemo`
- [ ] Callback functions passed as props are wrapped in `useCallback` to prevent child re-renders
- [ ] Heavy components that render often and receive stable props are wrapped in `React.memo`
- [ ] No large library imported at the top level when only one function is needed — use named imports or lazy load
- [ ] Images use `next/image` — never a raw `<img>` tag (ensures lazy loading and optimization)
- [ ] No `console.log` left in render paths (causes noise and minor perf hit)
- [ ] Query `staleTime` is set appropriately — data that rarely changes should not refetch on every mount

---

### 8. Security & API Correctness

- [ ] All Axios calls use `withCredentials: true`
- [ ] No API keys, tokens, or secrets hardcoded in frontend code or `.env` files committed to git
- [ ] No sensitive data stored directly in `localStorage` — Zustand persist handles auth state
- [ ] User-generated content rendered in JSX never uses `dangerouslySetInnerHTML` — if it must, the content is sanitized
- [ ] No open redirect: navigation targets are validated or come from trusted sources only

---

### 9. TypeScript Quality

- [ ] No `any` types
- [ ] No unsafe type assertions (`as SomeType` without a runtime check)
- [ ] Props interfaces defined for every component — no inline anonymous prop types on complex components
- [ ] API response types match the OpenAPI spec shapes exactly
- [ ] No `@ts-ignore` or `@ts-nocheck`
- [ ] `useRef` typed correctly (e.g., `useRef<HTMLInputElement>(null)` not `useRef(null)`)
- [ ] Event handler types are explicit (`React.ChangeEvent<HTMLInputElement>`, not `any`)

---

### 10. Accessibility & UX Correctness

- [ ] All interactive elements are keyboard accessible — buttons, links, inputs work with Tab and Enter/Space
- [ ] Images have descriptive `alt` attributes — not empty or "image"
- [ ] Form inputs have associated `<label>` elements (via `htmlFor` or wrapping)
- [ ] Loading and error states are communicated to screen readers (`aria-live`, `role="alert"`)
- [ ] Buttons that submit or mutate are disabled while a mutation is in-flight (no double-submit)
- [ ] Focus is managed correctly after modals open/close
- [ ] Color is not the only way to convey status (icons or text alongside color indicators)

---

### 11. Next.js App Router Compliance

- [ ] Server components do not import or use client-only APIs (localStorage, useState, useEffect, etc.)
- [ ] Client components are leaf nodes where possible — server components render client components, not the reverse for large trees
- [ ] New pages export correct metadata (`export const metadata`) for SEO if they are public-facing
- [ ] Dynamic routes use correct segment config (`export const dynamic`, `export const revalidate`) if caching behavior differs from default
- [ ] No `useRouter().push()` inside server components
- [ ] Suspense boundaries wrap async server components that fetch data so the rest of the page does not block

---

### 12. Component Quality & Maintainability

Flag these patterns that make future changes risky:

- [ ] No component exceeds 150 lines — if it does, extract sub-components
- [ ] No deeply nested JSX beyond 4 levels without extraction — unreadable and brittle
- [ ] No inline styles — all styling via Tailwind classes through `cn()`
- [ ] No magic numbers hardcoded in JSX (e.g., `timeout={3000}` — use named constants)
- [ ] No commented-out code or dead imports left in the diff

---

### 13. Automated Checks — Run All of These

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

> Breaks functionality, missing tests, missing i18n keys, violates architecture, or is a security/perf issue. Cannot merge until resolved.

- **[SECURITY] `path/to/file.tsx`** — description of problem and required fix
- **[PERF] `path/to/file.tsx`** — index used as list key, causes broken re-renders on reorder
- **[ARCH] `path/to/file.tsx`** — data fetching done in component, should be in hook
- **[TEST] `path/to/file.tsx`** — no test file for this component
- **[I18N] `path/to/file.tsx`** — hardcoded English text "Submit" — must use translation key
- **[A11Y] `path/to/file.tsx`** — button has no accessible label
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
