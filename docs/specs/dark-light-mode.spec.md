# Dark / Light Mode Feature Spec

## 1. Summary

This feature adds dark and light mode to the chat application, toggled via a button in the Navbar. The chosen preference is persisted in the user's profile on the backend so every login on any device restores the last-used theme. Default mode is light. Both modes use a professional, accessible colour palette so all UI elements — message bubbles, read/delivered ticks, quote-reply highlights, reactions, conversation items, emoji picker, and online indicators — remain clearly visible. Simple colours throughout: no gradients, no neon.

---

## 2. Current State

**Verified by reading the code.**

### CSS / Theming

- `apps/frontend/app/globals.css` already defines both `:root` (light) and `.dark` CSS custom-property blocks.
- Line 4: `@custom-variant dark (&:is(.dark *))` is declared — Tailwind v4 dark-mode variant already works by toggling a `.dark` class on any ancestor.
- `@theme inline` maps all variables to semantic Tailwind utilities (`bg-background`, `text-foreground`, `bg-primary`, `bg-card`, `border-border`, etc.).
- **The current dark palette is pure achromatic** (`oklch(0.145 0 0)` background, `oklch(0.985 0 0)` primary = near-white on near-black). Flat and harsh; redesign required.
- **The current light primary is also near-black** (`oklch(0.205 0 0)`). A proper blue-accent primary makes the app look far better and is standard for chat applications.
- No CSS transition on theme switch — colours snap instantly (jarring).

### Components already theme-switch-ready (use semantic CSS vars)

| Component                      | Key semantic classes                                        |
| ------------------------------ | ----------------------------------------------------------- |
| `QuotedPreview`                | `bg-primary/5 border-primary/50 text-foreground/60`         |
| `ReactionBar`                  | `bg-secondary`, `bg-primary/15 ring-primary/40`             |
| `ConversationItem` (content)   | `text-foreground`, `hover:bg-secondary/80`, `bg-primary/10` |
| `MessageComposer` (inner)      | `bg-secondary`, `text-foreground`                           |
| `ConversationSidebar` (inner)  | `border-border`, `bg-muted/40`, `text-foreground`           |
| `MessageBubble` (own bubble)   | `bg-primary text-white`                                     |
| `MessageBubble` (meta/actions) | `text-foreground/40`, `hover:bg-secondary`                  |

### Components with hardcoded colours (all must be fixed)

| Component                         | Hardcoded class                                             | Semantic replacement                                                   |
| --------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Navbar`                          | `bg-white/80 border-gray-100`                               | `bg-card/80 border-border`                                             |
| `Navbar` nav items                | `text-gray-500 hover:bg-gray-50 hover:text-gray-900`        | `text-muted-foreground hover:bg-secondary hover:text-foreground`       |
| `ConversationSidebar` (root)      | `bg-white`                                                  | `bg-card`                                                              |
| `ConversationHeader` (root)       | `bg-white border-b border-border`                           | `bg-card border-b border-border`                                       |
| `ConversationHeader` online dot   | `border-2 border-white`                                     | `border-2 border-card`                                                 |
| `ConversationItem` online dot     | `border-2 border-white`                                     | `border-2 border-card`                                                 |
| `MessageBubble` (others' bubble)  | `bg-white border border-border`                             | `bg-card border border-border`                                         |
| `MessageBubble` (edit input)      | `bg-white border border-border`                             | `bg-card border border-border`                                         |
| `MessageBubble` (action menu)     | `bg-white border border-border`                             | `bg-card border border-border`                                         |
| `MessageComposer` (outer wrapper) | `bg-white border-t border-border`                           | `bg-card border-t border-border`                                       |
| `EmojiPickerPopover` (loading)    | `bg-white border border-border`                             | `bg-card border border-border`                                         |
| `EmojiPickerPopover` (picker)     | `theme="auto"` (OS pref)                                    | `theme={currentTheme}` (store)                                         |
| `ProfileHeader` (avatar ring)     | `ring-4 ring-white`                                         | `ring-4 ring-card`                                                     |
| `ProfileHeader` (name/username)   | `text-gray-900`, `text-gray-500`                            | `text-foreground`, `text-muted-foreground`                             |
| `ProfileFeature` (page wrapper)   | `bg-gray-50`                                                | `bg-background`                                                        |
| `ProfileFeature` (header section) | `bg-white border-gray-100`                                  | `bg-card border-border`                                                |
| `ProfileForm` (root)              | `bg-white border-gray-100`                                  | `bg-card border-border`                                                |
| `ProfileForm` (labels/heading)    | `text-gray-700`, `text-gray-900`                            | `text-foreground`                                                      |
| `ProfileForm` (input disabled)    | `disabled:bg-gray-50 disabled:text-gray-500`                | `disabled:bg-muted disabled:text-muted-foreground`                     |
| `SecuritySection` (root)          | `bg-white border-gray-100 text-gray-900`                    | `bg-card border-border text-foreground`                                |
| `SecuritySection` (email row)     | `bg-gray-50 border-gray-100`                                | `bg-muted/40 border-border`                                            |
| `SecuritySection` (labels)        | `text-gray-700`, `text-gray-500`, `text-gray-400`           | `text-foreground`, `text-muted-foreground`, `text-muted-foreground/60` |
| `SecuritySection` (buttons/hover) | `hover:bg-gray-200`, `hover:bg-gray-100`, `border-gray-200` | `hover:bg-secondary`, `hover:bg-muted`, `border-border`                |
| `SecuritySection` (cancel btn)    | `text-gray-500`                                             | `text-muted-foreground`                                                |

> Note: `AnimatedBackground` (auth pages) is already a dark decorative background — intentional, no changes needed.

### Backend — user-service

- `apps/user-service/prisma/schema.prisma` — `UserProfile` has no `theme` field.
- `apps/user-service/src/application/dto/update-profile.dto.ts` — no `theme` field.
- `apps/user-service/src/application/ports/user-profile.repository.ts` — `update()` signature has no `theme`.
- `apps/user-service/src/application/use-cases/update-profile.use-case.ts` — already emits `USER_PROFILE_UPDATED`; handles profile patches generically via DTO spread.
- `apps/user-service/src/interfaces/controllers/user.controller.ts` — `PATCH /profile` route exists and calls `UpdateProfileUseCase`.

### Frontend — no theme infrastructure exists

- No `useThemeStore` Zustand store.
- No `ThemeProvider` component.
- No theme toggle in `Navbar`.
- No theme preference section in `ProfileFeature`.
- Profile service/hooks don't accept `theme`.

### Auth flow (important — already handles theme sync correctly)

`apps/frontend/src/features/auth/hooks/useAuth.ts` — both `useLogin.onSuccess` and `useRefresh.onSuccess` call `profileService.getProfile().then(setUser)` after login. Once `theme` is on the profile response, `user.theme` in `useAuthStore` will be populated automatically on every login/refresh — the `ThemeProvider` gets the backend theme without any additional wiring.

---

## 3. Desired State

### User-facing behaviour

1. **Navbar toggle**: A Sun/Moon icon button in the Navbar (right side, left of avatar). Clicking instantly switches theme with a smooth colour transition, saves preference to backend silently.
2. **Profile preferences**: A "Preferences" card in the user's own profile page (below SecuritySection) with a Light / Dark radio toggle. Same smooth behaviour.
3. **Persistence across devices**: On login, the `getProfile()` call (already in `useLogin`) returns `theme`; `ThemeProvider` applies it — user always gets their chosen theme back.
4. **Default**: New users and unauthenticated pages use light mode.
5. **Flash prevention**: An inline script in `layout.tsx` reads `localStorage` before React hydration to avoid a flash of the wrong theme on every page load.
6. **Smooth transition**: A 200ms colour fade when switching so the change is never jarring.
7. **Logout persistence**: Theme stays as-is when logging out — UI shouldn't snap to light just because the user logs out.
8. **Emoji picker in sync**: Emoji picker theme matches the app theme, not the OS.

### Data flow

**Toggle from Navbar:**

```
User clicks toggle
→ useThemeStore.setTheme(newTheme)      [reactive — all components re-render instantly]
→ document.documentElement.classList.toggle('dark', newTheme === 'dark')
→ localStorage.setItem via Zustand persist
→ profileService.updateProfile({ theme: newTheme })   [fire-and-forget, no toast]
→ PATCH /api/v1/user/profile  →  API Gateway  →  user-service
→ UpdateProfileUseCase.execute({ userId, theme })
→ PrismaUserProfileRepository.update(userId, { theme })
→ KafkaProducerService.emit(USER_PROFILE_UPDATED, { ...profile, theme })
```

**Login / page refresh (restore preference):**

```
useLogin.onSuccess calls profileService.getProfile() → setUser(fullProfile)
→ fullProfile.theme = 'dark'
→ useAuthStore.user.theme updated
→ ThemeProvider useEffect fires (dependency: user)
→ if profile.theme !== currentTheme → setTheme(profile.theme)
→ document.documentElement.classList updated + localStorage updated
```

**Page load (flash prevention — before React):**

```
Browser parses <script> in <head>
→ reads localStorage key 'theme-storage'  (Zustand persist blob)
→ if state.theme === 'dark' → document.documentElement.classList.add('dark')
→ First paint is in correct theme
```

### Business rules

- `theme` values: `'light'` | `'dark'`, default `'light'`.
- Only the authenticated user can update their own theme (same JWT guard as other profile fields).
- Navbar toggle fires the backend PATCH silently — no success toast (the visual change is the confirmation).
- Backend call failure does NOT roll back the local theme change.
- On logout: `user` becomes `null`; `ThemeProvider` guard `if (profileTheme && ...)` prevents any theme reset.

---

## Phase 1 — Contracts & Schema

### Goal

Define all contracts and DB changes before any code is written.

### 1.1 OpenAPI Changes

Editing the existing `libs/openapi-specs/src/v1/user.yaml` — theme is a user profile field that belongs to user-service.

| Method | Path                     | Auth | Purpose                                                         |
| ------ | ------------------------ | ---- | --------------------------------------------------------------- |
| GET    | `/api/v1/profile`        | JWT  | Response now includes `theme` (via `$ref: UserProfile`)         |
| GET    | `/api/v1/users/{userId}` | JWT  | Response now includes `theme` (via `$ref: UserProfile`)         |
| PATCH  | `/api/v1/profile`        | JWT  | Request body accepts `theme` (via `$ref: UpdateProfileRequest`) |

New schemas added: `Theme` (enum: light, dark) and `UpdateProfileRequest`.
`UserProfile` schema extended with `theme: $ref Theme`.

### 1.2 Database Schema Changes

**Change to `apps/user-service/prisma/schema.prisma`** — add one field to `UserProfile`:

```prisma
model UserProfile {
  id          String   @id
  username    String   @unique
  fullName    String?
  avatarUrl   String?
  bio         String?
  phoneNumber String?
  countryCode String?
  status      String?
  isOnline    Boolean  @default(false)
  theme       String   @default("light")   // "light" | "dark"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([fullName])
  @@map("UserProfile")
  @@schema("user_service")
}
```

**Why `String` not Prisma enum**: A two-value enum creates a migration-time DDL change and a generated enum type that must be regenerated whenever the set changes. A validated string (with `@IsIn` at the DTO layer) is simpler, consistent with how `status` is stored, and trivially extensible to `'system'` in the future.

No new indexes — `theme` is never used as a filter or sort key.

### 1.3 Kafka Event Contracts

No new Kafka topics. The existing `USER_PROFILE_UPDATED` event already fires on every profile update; `theme` is implicitly included because `UpdateProfileUseCase` emits the full updated profile object. Adding a dedicated `user.theme.updated.v1` topic would add infra overhead with zero benefit — no downstream consumer acts on theme changes.

### 1.4 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/user.yaml         — modified (Theme schema, UpdateProfileRequest, theme in UserProfile, proper response $refs)
apps/user-service/prisma/schema.prisma      — modified (add theme String @default("light"))
```

Commands to run after this phase:

```bash
pnpm generate:types          # Regenerates shared-types — UserProfile now has theme?: 'light' | 'dark'
pnpm prisma:migrate:user     # Applies schema migration (ADD COLUMN theme VARCHAR DEFAULT 'light')
pnpm prisma:generate         # Regenerates Prisma client with new theme field
```

---

## Phase 2 — Backend Implementation

### Goal

Thread `theme` through the existing user-service stack. Only two files need code changes — the rest flows through automatically.

### 2.1 Domain Layer

No new domain entities. Theme is a simple preference field on `UserProfile`, not a domain concept warranting its own aggregate.

### 2.2 Application Layer

**`UpdateProfileDto`** — add one field with validation:

```typescript
@ApiPropertyOptional({ enum: ['light', 'dark'] })
@IsString()
@IsOptional()
@IsIn(['light', 'dark'])
theme?: string;
```

**`UserProfileRepository` port** — add `theme` to `update()` data parameter:

```typescript
update(
  id: string,
  data: {
    fullName?: string;
    avatarUrl?: string;
    bio?: string;
    phoneNumber?: string;
    countryCode?: string;
    status?: string;
    isOnline?: boolean;
    theme?: string;       // added
  },
): Promise<UserProfile>;
```

**`UpdateProfileUseCase`** — no changes needed. The `request` object is already destructured as `{ userId, ...data }` and `data` is passed directly to `repository.update()`. The DTO extension is enough.

### 2.3 Infrastructure Layer

**`PrismaUserProfileRepository`** — no changes needed. The `update()` method passes `data` directly to `prisma.userProfile.update({ where: { id }, data })`. Prisma's generated client from the new schema accepts all schema fields including `theme`.

**Kafka producer** — no changes. The existing `USER_PROFILE_UPDATED` emit in `UpdateProfileUseCase` passes the full updated profile row, which now includes `theme`.

### 2.4 Interfaces Layer

No new routes. `PATCH /profile` in `UserController` already routes to `UpdateProfileUseCase` with the full validated DTO. The new `theme` field flows through automatically.

### 2.5 Module Registration

No changes to `AppModule`. No new providers.

### 2.6 Files to Create / Modify in This Phase

```
apps/user-service/src/application/dto/update-profile.dto.ts            — modified (add theme field with @IsIn)
apps/user-service/src/application/ports/user-profile.repository.ts     — modified (add theme to update signature)
```

No other backend files need changes.

### 2.7 Test Cases

**Unit — `UpdateProfileUseCase`**:

- [ ] Happy path: `execute({ userId, theme: 'dark' })` → repository receives `{ theme: 'dark' }`, `USER_PROFILE_UPDATED` emitted
- [ ] Happy path: `execute({ userId, theme: 'light' })` → same
- [ ] `theme` omitted → update succeeds with existing value unchanged
- [ ] `theme: 'blue'` rejected by DTO validation → `BadRequestException` before use case runs
- [ ] `NotFoundException` when user profile does not exist

```bash
pnpm nx typecheck user-service
pnpm nx lint user-service
pnpm nx test user-service
```

---

## Phase 3 — Frontend Implementation

### Goal

Implement all theme infrastructure, add Navbar toggle and Profile preference UI, redesign the CSS palette for both modes, and replace all hardcoded colour classes with semantic equivalents.

### 3.0 CSS Colour Redesign (`apps/frontend/app/globals.css`)

Replace both palette blocks. Light mode gets a blue-accent primary. Dark mode gets a dark navy-gray (Slack/Discord style) instead of near-black. Add a smooth transition to `body`.

**Light mode:**

```css
:root {
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.13 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.13 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.13 0 0);
  --primary: oklch(0.55 0.2 262); /* indigo-blue — readable on white */
  --primary-foreground: oklch(1 0 0); /* white */
  --secondary: oklch(0.96 0.01 240); /* very light blue-gray for hover/chips */
  --secondary-foreground: oklch(0.2 0 0);
  --muted: oklch(0.95 0.01 240);
  --muted-foreground: oklch(0.5 0 0);
  --border: oklch(0.9 0.01 240);
  --input: oklch(0.9 0.01 240);
  --ring: oklch(0.55 0.2 262);
  /* destructive, chart, sidebar, radius — unchanged from current */
}
```

**Dark mode:**

```css
.dark {
  --background: oklch(0.19 0.015 250); /* dark navy-gray */
  --foreground: oklch(0.92 0 0); /* off-white */
  --card: oklch(0.23 0.015 250); /* elevated surface */
  --card-foreground: oklch(0.92 0 0);
  --popover: oklch(0.23 0.015 250);
  --popover-foreground: oklch(0.92 0 0);
  --primary: oklch(0.65 0.18 262); /* lighter blue for dark bg */
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.28 0.015 250); /* hover/chip bg */
  --secondary-foreground: oklch(0.92 0 0);
  --muted: oklch(0.28 0.015 250);
  --muted-foreground: oklch(0.63 0 0);
  --border: oklch(0.33 0.015 250); /* subtle borders */
  --input: oklch(0.28 0.015 250);
  --ring: oklch(0.65 0.18 262);
  /* destructive, chart, sidebar — keep existing */
}
```

**Smooth transition** — add to `@layer base`:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    transition:
      background-color 200ms ease,
      color 200ms ease;
  }
}
```

**Why 200ms**: Fast enough not to feel sluggish; slow enough to be visually smooth. The standard used by GitHub, Linear, and Tailwind UI.

**Visibility checklist for dark mode:**

| Element            | Classes                             | Dark mode result                  |
| ------------------ | ----------------------------------- | --------------------------------- |
| Own message bubble | `bg-primary text-white`             | Indigo-blue bubble, white text ✓  |
| Others' bubble     | `bg-card border-border`             | Dark surface, off-white text ✓    |
| Read tick          | `text-blue-500` (hardcoded)         | `#3b82f6` — visible on dark bg ✓  |
| Delivered tick     | `text-foreground/40`                | ~37% opacity off-white ✓          |
| Sent tick          | `text-foreground/40`                | Same ✓                            |
| Quote highlight    | `bg-primary/5 border-primary/50`    | Faint blue tint ✓                 |
| Reaction (own)     | `bg-primary/15 ring-primary/40`     | Faint blue chip with ring ✓       |
| Reaction (others)  | `bg-secondary text-foreground/70`   | Dark chip, off-white text ✓       |
| Online indicator   | `bg-green-500 border-2 border-card` | Green dot, card-coloured border ✓ |
| Unread badge       | `bg-primary text-white`             | Indigo badge ✓                    |

### 3.1 Routes / Pages

No new routes. The Preferences section lives inside `ProfileFeature` on the existing `/profile` page.

### 3.2 Theme Store

**New file**: `apps/frontend/src/shared/store/useThemeStore.ts`

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", theme === "dark");
        }
      },
    }),
    { name: "theme-storage" }, // key used by flash-prevention script — must not change
  ),
);
```

### 3.3 Flash-Prevention Script

Add inside `<head>` in `app/layout.tsx` **before any other content**:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var s=localStorage.getItem('theme-storage');if(s){var p=JSON.parse(s);if(p&&p.state&&p.state.theme==='dark')document.documentElement.classList.add('dark');}}catch(e){}})();`,
  }}
/>
```

The key `'theme-storage'` matches the Zustand persist name. The script runs synchronously before first paint — no FOUC on any page load, authenticated or not.

### 3.4 ThemeProvider

**New file**: `apps/frontend/src/shared/providers/ThemeProvider.tsx`

Syncs backend theme preference into local store after login (and on every profile update that changes theme):

```typescript
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../../features/auth/store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    const profileTheme = (user as { theme?: 'light' | 'dark' } | null)?.theme;
    if (profileTheme && profileTheme !== theme) {
      setTheme(profileTheme);
    }
  }, [user]);   // fires on login (user changes from null → profile), on profile updates, NOT on logout (user→null, guard prevents reset)

  return <>{children}</>;
};
```

**Why this is enough**: `useLogin.onSuccess` and `useRefresh.onSuccess` already call `profileService.getProfile().then(setUser)`. Once `theme` is in the profile response, `user.theme` in auth store is populated on every login — no extra fetch needed.

**Logout safety**: When user logs out, `user` becomes `null` → `profileTheme` is `undefined` → the `if (profileTheme && ...)` guard prevents any theme reset. Theme stays exactly as it was.

Mount in `app/layout.tsx`, inside `TanstackProvider`:

```tsx
<TanstackProvider>
  <ThemeProvider>{children}</ThemeProvider>
</TanstackProvider>
```

### 3.5 API Service

Add `theme` to `updateProfile` in `apps/frontend/src/features/profile/services/profile.service.ts`:

```typescript
async updateProfile(data: {
  fullName?: string;
  bio?: string;
  phoneNumber?: string;
  countryCode?: string;
  status?: string;
  theme?: 'light' | 'dark';   // added
}): Promise<UserProfile> { ... }
```

### 3.6 Hooks

Extend `apps/frontend/src/features/profile/hooks/useProfile.ts` — add a `updateTheme` helper that wraps the existing mutation:

```typescript
const updateTheme = (newTheme: 'light' | 'dark') => {
  updateProfileMutation.mutate({ theme: newTheme });
};

// expose in return object:
updateTheme,
```

No new TanStack Query hooks — theme update goes through the existing `updateProfileMutation`.

### 3.7 New Components

#### `ThemeToggle` (shared)

**New file**: `apps/frontend/src/shared/components/ThemeToggle.tsx`

```tsx
"use client";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { cn } from "../utils/cn";

interface ThemeToggleProps {
  onToggle?: (newTheme: "light" | "dark") => void;
  className?: string;
}

export const ThemeToggle = ({ onToggle, className }: ThemeToggleProps) => {
  const { theme, setTheme } = useThemeStore();
  const isDark = theme === "dark";

  const handleClick = () => {
    const next: "light" | "dark" = isDark ? "light" : "dark";
    setTheme(next);
    onToggle?.(next);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200",
        "text-muted-foreground hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};
```

#### `ThemePreferenceSection` (profile)

**New file**: `apps/frontend/src/features/profile/components/ThemePreferenceSection.tsx`

```tsx
"use client";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../../shared/store/useThemeStore";
import { useProfile } from "../hooks/useProfile";
import { cn } from "../../../shared/utils/cn";

export const ThemePreferenceSection = () => {
  const { theme, setTheme } = useThemeStore();
  const { updateTheme } = useProfile();

  const handleSelect = (selected: "light" | "dark") => {
    if (selected === theme) return;
    setTheme(selected);
    updateTheme(selected);
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-4">
        Preferences
      </h2>
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Theme</p>
        <div className="flex gap-3">
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleSelect(mode)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                theme === mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {mode === "light" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              {mode === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### 3.8 Modified Components

#### `Navbar`

- Add `<ThemeToggle>` (right side, before avatar link), pass `onToggle` calling `updateProfile({ theme })` fire-and-forget
- `bg-white/80 border-gray-100` → `bg-card/80 border-border`
- Nav item inactive: `text-gray-500 hover:bg-gray-50 hover:text-gray-900` → `text-muted-foreground hover:bg-secondary hover:text-foreground`

#### `ConversationSidebar`

- Root div: `bg-white` → `bg-card`

#### `ConversationHeader`

- Root div: `bg-white border-b border-border` → `bg-card border-b border-border`
- Online indicator: `border-2 border-white` → `border-2 border-card`

#### `ConversationItem`

- Online indicator: `border-2 border-white` → `border-2 border-card`

#### `MessageComposer`

- Outer wrapper: `bg-white border-t border-border` → `bg-card border-t border-border`

#### `MessageBubble`

- Others' bubble: `bg-white border border-border` → `bg-card border border-border`
- Edit input wrapper: `bg-white border border-border` → `bg-card border border-border`
- Action menu dropdown: `bg-white border border-border` → `bg-card border border-border`

#### `EmojiPickerPopover`

- Loading state: `bg-white border border-border` → `bg-card border border-border`
- Picker `theme="auto"` → `theme={theme}` where `theme = useThemeStore(s => s.theme)` — so emoji picker always matches the app theme, not the OS preference

#### `ProfileHeader`

- Avatar ring: `ring-4 ring-white` → `ring-4 ring-card`
- Name: `text-gray-900` → `text-foreground`
- Username: `text-gray-500` → `text-muted-foreground`

#### `ProfileFeature`

- Page wrapper: `bg-gray-50` → `bg-background`
- Header section: `bg-white border-gray-100` → `bg-card border-border`
- Add `{isOwnProfile && <ThemePreferenceSection />}` after `SecuritySection`

#### `ProfileForm`

- Root form: `bg-white border-gray-100` → `bg-card border-border`
- Section heading: `text-gray-900` → `text-foreground`
- Labels: `text-gray-700` → `text-foreground`
- Inputs disabled: `disabled:bg-gray-50 disabled:text-gray-500` → `disabled:bg-muted disabled:text-muted-foreground`

#### `SecuritySection`

- Root: `bg-white border-gray-100 text-gray-900` → `bg-card border-border text-foreground`
- Email row: `bg-gray-50 border-gray-100` → `bg-muted/40 border-border`
- Labels: `text-gray-700`, `text-gray-500`, `text-gray-400` → `text-foreground`, `text-muted-foreground`, `text-muted-foreground/60`
- Hover states: `hover:bg-gray-200`, `hover:bg-gray-100` → `hover:bg-secondary`, `hover:bg-muted`
- Input: `border-gray-200` → `border-border`
- Cancel button: `text-gray-500` → `text-muted-foreground`

### 3.9 Files to Create / Modify in This Phase

```
apps/frontend/app/globals.css                                                     — modified (redesign :root + .dark palettes, add body transition)
apps/frontend/app/layout.tsx                                                      — modified (flash-prevention script in <head>, ThemeProvider wrapping content)
apps/frontend/src/shared/store/useThemeStore.ts                                   — created
apps/frontend/src/shared/providers/ThemeProvider.tsx                              — created
apps/frontend/src/shared/components/ThemeToggle.tsx                               — created
apps/frontend/src/shared/components/Navbar.tsx                                    — modified (ThemeToggle added, bg-white/gray-* fixed)
apps/frontend/src/features/profile/components/ThemePreferenceSection.tsx          — created
apps/frontend/src/features/profile/components/ProfileFeature.tsx                  — modified (bg-gray-50 fixed, ThemePreferenceSection added)
apps/frontend/src/features/profile/components/ProfileForm.tsx                     — modified (bg-white/gray-* fixed)
apps/frontend/src/features/profile/components/ProfileHeader.tsx                   — modified (ring-white, text-gray-* fixed)
apps/frontend/src/features/profile/components/SecuritySection.tsx                 — modified (all bg-white/gray-* fixed)
apps/frontend/src/features/profile/hooks/useProfile.ts                           — modified (updateTheme helper added)
apps/frontend/src/features/profile/services/profile.service.ts                   — modified (theme added to updateProfile signature)
apps/frontend/src/features/chat/components/ConversationSidebar.tsx               — modified (bg-white fixed)
apps/frontend/src/features/chat/components/ConversationHeader.tsx                — modified (bg-white + border-white online dot fixed)
apps/frontend/src/features/chat/components/ConversationItem.tsx                  — modified (border-white online dot fixed)
apps/frontend/src/features/chat/components/MessageBubble.tsx                     — modified (bg-white on bubbles/menu/edit fixed)
apps/frontend/src/features/chat/components/MessageComposer.tsx                   — modified (bg-white outer wrapper fixed)
apps/frontend/src/features/chat/components/EmojiPickerPopover.tsx                — modified (bg-white loading + theme prop fixed)
```

### 3.10 Test Cases

**Store:**

- [ ] `useThemeStore`: initial state is `'light'`
- [ ] `setTheme('dark')` → state becomes `'dark'`, `document.documentElement.classList.contains('dark')` is `true`
- [ ] `setTheme('light')` → removes `dark` class

**`ThemeProvider`:**

- [ ] When `user.theme === 'dark'` and store is `'light'` → calls `setTheme('dark')`
- [ ] When `user.theme === 'light'` and store is `'light'` → no call (no unnecessary re-render)
- [ ] When `user` becomes `null` (logout) → no theme change

**`ThemeToggle`:**

- [ ] Renders Moon icon when `theme === 'light'`; Sun icon when `theme === 'dark'`
- [ ] Click calls `setTheme` with opposite mode and fires `onToggle` callback

**`ThemePreferenceSection`:**

- [ ] Active mode button has `border-primary bg-primary/10` class
- [ ] Clicking already-active mode is a no-op (no mutation fired)
- [ ] Clicking opposite mode calls `setTheme` and `updateTheme`

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Architecture Decisions

| #   | Decision                                        | Options Considered                                                     | Choice                | Rationale                                                                                                                                                                                        |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Where to store theme preference                 | Client-only (localStorage) vs backend (UserProfile)                    | Both                  | localStorage for instant flash-free paint on every load; backend for cross-device consistency                                                                                                    |
| 2   | Toggle mechanism                                | CSS `prefers-color-scheme` media query vs `.dark` class                | `.dark` class         | Media query cannot be user-controlled; `.dark` class is what `globals.css` already implements                                                                                                    |
| 3   | "System" theme option                           | Light/Dark/System vs Light/Dark only                                   | Light/Dark only       | User explicitly specified two modes and default light; "system" can be added later by extending the enum and `setTheme` logic                                                                    |
| 4   | Separate theme endpoint vs extend PATCH profile | New `PATCH /profile/theme` vs extend existing                          | Extend existing       | Theme is a profile preference field. A dedicated endpoint violates REST resource design; the existing DTO handles partial updates                                                                |
| 5   | Prisma String vs enum                           | `theme String` vs `theme ThemeEnum`                                    | `String` with `@IsIn` | A Prisma enum for two values adds DDL migration complexity and generated type churn. Validated strings are simpler and consistent with how `status` is stored                                    |
| 6   | CSS transition                                  | No transition vs 200ms ease                                            | 200ms ease            | Without it, the switch is a jarring instant flash. 200ms is the standard (GitHub, Linear, Tailwind UI). Applied to `body` only — does not affect animations or layout                            |
| 7   | Flash prevention method                         | `ThemeProvider` (React) vs inline `<script>` in `<head>`               | Inline `<script>`     | React runs after first paint. Component-based approach causes FOUC on every page load. The inline script executes synchronously before any layout paint — the standard Next.js dark-mode pattern |
| 8   | ThemeProvider sync trigger                      | Additional `useProfile` call vs watching existing `user` in auth store | Watch existing `user` | `useLogin.onSuccess` already fetches the full profile and calls `setUser(fullProfile)`. Once `theme` is on the profile, no extra fetch is needed — the existing auth flow handles sync           |
| 9   | EmojiPicker theme                               | `theme="auto"` (OS pref) vs `theme={storeTheme}`                       | Store theme           | `theme="auto"` reads `prefers-color-scheme` — if the user's OS is light but app is dark, the picker shows light. Passing the store theme keeps the picker in sync with the app                   |
| 10  | Primary colour                                  | Keep near-black (`oklch(0.205 0 0)`) vs introduce blue accent          | Blue accent indigo    | Near-black primary makes message bubbles and nav items black — poor contrast in both modes. A consistent blue accent is standard for chat applications and creates clear visual hierarchy        |

---

## 5. Open Questions

None — all decisions are resolved in Section 4.

---

## Reminder

Run `pnpm generate:types` after Phase 1 to regenerate `libs/shared-types` from the updated `user.yaml`. The `UserProfile` TypeScript type must include `theme?: 'light' | 'dark'` before Phase 3 frontend work begins. The `Theme` enum schema will generate as a `'light' | 'dark'` string literal union in TypeScript.
