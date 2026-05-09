# Friend Search Feature Spec

## 1. Summary

The friend search feature lets authenticated users find other users on the platform by typing a partial username or full name. Results include **all users** (excluding only the requester themselves), with each result annotated with a `relationshipStatus` field so the UI can render the appropriate action: "Add Friend" for new connections, "Pending" for in-flight requests, and "Friends" for existing connections. After finding a match the user can send a friend request inline, or navigate to the matched user's profile. The feature ships as a third tab on the existing Friends page, keeping the UI consistent with the current tab pattern.

---

## 2. Current State

**Verified by reading the actual source files.**

### Backend — user-service

| Layer      | File                                                                                 | What exists                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Port       | `apps/user-service/src/application/ports/user-profile.repository.ts`                 | `findById`, `findByUsername`, `findAllExcept`, `upsert`, `update` — **no search method**                                                                                                                 |
| Repository | `apps/user-service/src/infrastructure/persistence/prisma-user-profile.repository.ts` | `findAllExcept` does a `notIn` query with hardcoded `take: 20`, no text filtering                                                                                                                        |
| Use case   | `apps/user-service/src/application/use-cases/get-recommendations.use-case.ts`        | Builds exclusion list (friends + pending requests both directions) then calls `findAllExcept` — exclusion logic **can be reused**                                                                        |
| Controller | `apps/user-service/src/interfaces/controllers/friends.controller.ts`                 | `GET /friends/recommendations`, `GET /friends`, `POST /friends/requests`, `POST /friends/requests/:id/respond`, `GET /friends/requests/incoming`, `GET /friends/requests/outgoing` — **no search route** |
| Module     | `apps/user-service/src/app.module.ts`                                                | All above use cases and repositories registered                                                                                                                                                          |

### Database (schema.prisma)

```prisma
model UserProfile {
  id          String   @id          // UUID from auth-service
  username    String   @unique      // always present; unique B-tree index already exists
  fullName    String?              // optional; NO index currently
  avatarUrl   String?
  bio         String?
  phoneNumber String?
  countryCode String?
  status      String?
  isOnline    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- `email` is stored **only** in auth-service (not duplicated in user-service).
- `username` is indexed via `@unique`. `fullName` has no index.

### Frontend — friends feature

| File                                                                   | What exists                                                                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/frontend/src/features/friends/services/friends.service.ts`       | `getFriends`, `getRecommendations`, `getIncomingRequests`, `sendFriendRequest`, `respondToRequest` — **no searchUsers**       |
| `apps/frontend/src/features/friends/hooks/useFriends.ts`               | `useFriends`, `useIncomingRequests`, `useRecommendations`, `useSendFriendRequest`, `useRespondToRequest` — **no search hook** |
| `apps/frontend/src/features/friends/components/SubNavbar.tsx`          | Two tabs: `'friends'` and `'requests'` — **no search tab**                                                                    |
| `apps/frontend/src/features/friends/components/FriendList.tsx`         | Renders friends/recommendations on `'friends'` tab and requests on `'requests'` tab                                           |
| `apps/frontend/src/features/friends/components/RecommendationList.tsx` | Renders a grid of user cards with "Add Friend" button and profile link                                                        |
| `apps/frontend/app/friends/page.tsx`                                   | `activeTab` typed as `'friends'                                                                                               | 'requests'`; passes to `SubNavbar`and`FriendList` |

### What does NOT exist yet

- Any text-search capability (backend or frontend)
- A search tab in SubNavbar
- A search input component
- An index on `UserProfile.fullName`

---

## 3. Desired State

### User-facing behaviour

1. User opens the Friends page.
2. They click the new **Search** tab (magnifying glass icon) in `SubNavbar`.
3. A search input appears. Typing fewer than 2 characters shows an idle state.
4. After typing ≥ 2 characters (debounced 300 ms) the app calls `GET /api/v1/friends/search?q=<query>`.
5. Results show up to 20 user cards. Each card shows avatar, display name (fullName fallback to username), and an action indicator based on relationship:
   - **No relationship** → **Add Friend** button
   - **Pending request** (either direction) → "Pending" badge (no action)
   - **Already friends** → "Friends" badge (no action)
6. Clicking **Add Friend** calls the existing `POST /api/v1/friends/requests` — exactly as recommendations do today.
7. Clicking the user's name/avatar navigates to `/profile/:id` — the existing profile page.
8. After sending a request, the card optimistically updates to show "Pending" status (no longer removed from results).
9. Clearing the input returns to the idle state (no results, no spinner).

### Data flow

**Search query:**

```
Client (300ms debounce)
  → GET /api/v1/friends/search?q=<query>
  → API Gateway (proxy /api/v1/* → user-service)
  → FriendsController.search(@Query('q'), req.user.id)
  → SearchUsersUseCase.execute(userId, query)
      → FriendshipRepository.findByUserId(userId)            // annotate as 'friend'
      → FriendRequestRepository.findIncomingByUserId(userId) // annotate as 'pending_incoming'
      → FriendRequestRepository.findOutgoingByUserId(userId) // annotate as 'pending_outgoing'
      → UserProfileRepository.search(query, [userId])        // only self excluded
          → Prisma: WHERE (username ILIKE '%q%' OR fullName ILIKE '%q%')
                    AND id NOT IN ([userId])
                    ORDER BY username ASC LIMIT 20
      → annotate each profile with relationshipStatus
  ← UserSearchResult[]  (UserProfile + { relationshipStatus })
```

**Send friend request (unchanged flow, reused):**

```
Client → POST /api/v1/friends/requests { receiverId }
  → SendFriendRequestUseCase (existing)
```

### Business rules

- **Minimum query length**: 2 characters. Backend returns `400` for `q` shorter than 2 characters or missing. Frontend only fires the query when `q.length >= 2`.
- **Maximum query length**: 100 characters (to prevent pathological DB queries).
- **Match type**: Partial, case-insensitive (`ILIKE '%q%'`). Not exact match.
- **Search fields**: `username` and `fullName` only. `email` is not in user-service's DB and cannot be searched. `phoneNumber` is PII and is not exposed in search.
- **Exclusion**: Only the requesting user is excluded from results. Friends and users with pending requests are included but annotated with their `relationshipStatus`.
- **Relationship annotation**: Each result carries `relationshipStatus`: `'friend'`, `'pending_outgoing'`, `'pending_incoming'`, or `'none'`. Frontend uses this to render the correct action badge.
- **Result limit**: Maximum 20 results, ordered by `username ASC`.
- **Empty query**: Backend is not called. Frontend shows idle state.
- **No results**: Frontend shows an empty-state message.
- **Idempotent**: Calling search twice with the same query returns the same set. No state is mutated.

---

## Phase 1 — Contracts & Schema

### 1.1 OpenAPI Changes

Editing the existing `libs/openapi-specs/src/v1/user.yaml` because the search endpoint belongs to the user-service, which already owns the friends routes.

Added `GET /api/v1/friends/search` alongside existing friends endpoints. Also added the shared `ErrorResponse` schema and `bearerAuth` security scheme that were missing from this file.

| Method | Path                               | Auth | Purpose                                                      |
| ------ | ---------------------------------- | ---- | ------------------------------------------------------------ |
| GET    | `/api/v1/friends/search?q=<query>` | JWT  | Search users by username or full name; returns filtered list |

### 1.2 Database Schema Changes

**Change to existing model `UserProfile`:**

Add an index on `fullName` to make case-insensitive substring queries on this column efficient at scale. `username` already has a B-tree index via `@unique`.

```prisma
model UserProfile {
  id          String   @id
  username    String   @unique
  fullName    String?
  // ...all other fields unchanged...

  @@index([fullName])   // enables efficient ILIKE scans on fullName
  @@map("UserProfile")
  @@schema("user_service")
}
```

**Why this index**: Without it, every search query does a full sequential scan on `UserProfile` filtered by `fullName`. Postgres can use a B-tree index for `ILIKE 'prefix%'` patterns; for infix `ILIKE '%query%'` it cannot, but the `@@index` still helps the planner and is the correct starting point. For production traffic, upgrade to a `gin` trigram index (`pg_trgm` extension), but that requires a custom migration outside Prisma schema DSL. The B-tree index is a zero-risk first step.

No new tables. No changes to `FriendRequest` or `Friendship`.

### 1.3 Kafka Event Contracts

No Kafka events needed. Search is a read-only query. Sending a friend request after search uses the existing `friend.request.sent.v1` event from `SendFriendRequestUseCase` — no change.

### 1.4 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/user.yaml          — modified (add search endpoint, ErrorResponse schema, bearerAuth)
apps/user-service/prisma/schema.prisma       — modified (add @@index([fullName]) to UserProfile)
```

Commands to run after this phase:

```bash
pnpm prisma:migrate:user   # apply the new index migration
pnpm prisma:generate        # regenerate the Prisma client
pnpm generate:types         # regenerate shared-types from OpenAPI
```

---

## Phase 2 — Backend Implementation

### 2.1 Domain Layer

No new domain entities. `UserProfile` is already the correct aggregate for this feature — a search result is just a `UserProfile` projected through a filter. No business invariants are introduced by read-only search.

### 2.2 Application Layer

#### Repository port — add to existing `UserProfileRepository`

File: `apps/user-service/src/application/ports/user-profile.repository.ts` (modified)

```typescript
search(query: string, excludeIds: string[]): Promise<UserProfile[]>;
```

#### DTOs

No new DTO needed. The controller accepts `q: string` from `@Query()` directly; validation is done with NestJS's built-in `ParseIntPipe` equivalent via a validation guard or manual check in the use case (see below). Response type is the existing `UserProfile` Prisma type.

#### Use case

New file: `apps/user-service/src/application/use-cases/search-users.use-case.ts`

| Use Case             | HTTP trigger             | Business rules enforced                     | Events emitted |
| -------------------- | ------------------------ | ------------------------------------------- | -------------- |
| `SearchUsersUseCase` | `GET /friends/search?q=` | min length 2, max 100, self-exclusion only  | none           |

**Execution sequence:**

1. Validate `query.trim().length >= 2` → throw `BadRequestException('Search query must be at least 2 characters')` if not.
2. Validate `query.length <= 100` → throw `BadRequestException('Search query too long')` if not.
3. `friendshipRepository.findByUserId(userId)` → build `friendIdSet`.
4. `friendRequestRepository.findIncomingByUserId(userId)` → build `pendingIncomingSet` (PENDING only).
5. `friendRequestRepository.findOutgoingByUserId(userId)` → build `pendingOutgoingSet` (PENDING only).
6. `userProfileRepository.search(query.trim(), [userId])` → fetch all matching users except self.
7. Map each profile to `UserSearchResult` by annotating with `relationshipStatus`: `'friend'` | `'pending_outgoing'` | `'pending_incoming'` | `'none'`.

Returns `UserSearchResult[]` — `UserProfile` extended with `{ relationshipStatus: RelationshipStatus }`.

### 2.3 Infrastructure Layer

#### Repository implementation

File: `apps/user-service/src/infrastructure/persistence/prisma-user-profile.repository.ts` (modified — add `search` method)

```typescript
async search(query: string, excludeIds: string[]): Promise<UserProfile[]> {
  return this.prisma.userProfile.findMany({
    where: {
      AND: [
        { id: { notIn: excludeIds } },
        {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { fullName: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    orderBy: { username: 'asc' },
    take: 20,
  });
}
```

**Query decisions:**

- `mode: 'insensitive'` compiles to `ILIKE` in Postgres. The alternative (full-text search with `ts_vector`) is disproportionate complexity for single-word name search and would require schema changes beyond what this phase covers.
- `AND [notIn, OR [username, fullName]]` — the compound structure ensures exclusions always apply even when the text filter matches many users.
- `take: 20` — matches the existing recommendations limit; keeps response payloads predictable.
- `orderBy: { username: 'asc' }` — deterministic ordering so paginated extensions can use cursor-based pagination in the future.
- No caching: search results depend on a string that changes every keystroke. Cache hit rate would be near zero. The debounce on the frontend is the correct throttle mechanism.

#### Kafka producer

None. This is a read-only use case.

#### Kafka consumer

None.

### 2.4 Interfaces Layer

File: `apps/user-service/src/interfaces/controllers/friends.controller.ts` (modified — add route)

Adding to the **existing** `FriendsController`. The search endpoint belongs to the same resource (`/friends`) and follows the same auth guard.

| Method | Route             | Guard          | Use Case             |
| ------ | ----------------- | -------------- | -------------------- |
| GET    | `/friends/search` | `JwtAuthGuard` | `SearchUsersUseCase` |

```typescript
@Get('search')
async searchUsers(
  @Req() req: AuthenticatedRequest,
  @Query('q') query: string,
) {
  return this.searchUsersUseCase.execute(req.user.id, query);
}
```

The `@Query('q')` value is a raw string; validation (min/max length) lives in the use case, consistent with how other use cases in this codebase enforce their own business rules.

**Route ordering note**: NestJS matches routes in declaration order. `GET /friends/search` must be declared **before** any parameterised `GET /friends/:id` routes to avoid the literal string `"search"` being captured as a path parameter. In the current controller there are no `GET /friends/:id` routes, so ordering is not an issue.

### 2.5 Module Registration

File: `apps/user-service/src/app.module.ts` (modified)

Add to `providers` array:

```typescript
SearchUsersUseCase,
```

Add to the constructor injections of `FriendsController`:

```typescript
private readonly searchUsersUseCase: SearchUsersUseCase,
```

No new repository bindings — `SearchUsersUseCase` injects the existing `'UserProfileRepository'`, `'FriendshipRepository'`, and `'FriendRequestRepository'` tokens already registered.

### 2.6 Files to Create / Modify in This Phase

```
apps/user-service/src/application/ports/user-profile.repository.ts           — modified (add search signature)
apps/user-service/src/application/use-cases/search-users.use-case.ts         — created
apps/user-service/src/infrastructure/persistence/prisma-user-profile.repository.ts — modified (add search implementation)
apps/user-service/src/interfaces/controllers/friends.controller.ts            — modified (add searchUsers route)
apps/user-service/src/app.module.ts                                           — modified (register SearchUsersUseCase)
```

### 2.7 Test Cases

**Unit — `SearchUsersUseCase`** (`apps/user-service/tests/unit/`):

- [ ] Happy path: given `userId='u1'`, `query='ali'`, friends=`['u2']`, pending=`[]` — calls `userProfileRepository.search('ali', ['u1','u2'])` and returns profiles
- [ ] Throws `BadRequestException` when `query` is 1 character
- [ ] Throws `BadRequestException` when `query` is empty string
- [ ] Throws `BadRequestException` when `query` is 101 characters
- [ ] Does NOT throw when `query` is exactly 2 characters
- [ ] Excludes current user from `excludeIds` passed to repository
- [ ] Excludes friends from `excludeIds`
- [ ] Excludes PENDING incoming request senders from `excludeIds`
- [ ] Excludes PENDING outgoing request receivers from `excludeIds`
- [ ] Does NOT exclude REJECTED or ACCEPTED request participants (only PENDING)
- [ ] Returns empty array when repository returns empty array (no error thrown)

```bash
pnpm nx typecheck user-service
pnpm nx lint user-service
pnpm nx test user-service
```

---

## Phase 3 — Frontend Implementation

### 3.1 Routes / Pages

| Route      | File                                 | Status   | Change                                                                              |
| ---------- | ------------------------------------ | -------- | ----------------------------------------------------------------------------------- |
| `/friends` | `apps/frontend/app/friends/page.tsx` | modified | Extend `activeTab` type to include `'search'`; pass to `SubNavbar` and `FriendList` |

### 3.2 API Service

File: `apps/frontend/src/features/friends/services/friends.service.ts` (modified)

Add types:

```typescript
export type RelationshipStatus = 'friend' | 'pending_incoming' | 'pending_outgoing' | 'none';
export interface UserSearchResult extends UserProfile { relationshipStatus: RelationshipStatus; }
```

Add to existing `friendsService` object:

```typescript
async searchUsers(query: string): Promise<UserSearchResult[]> {
  const response = await apiClient.get<UserSearchResult[]>('/friends/search', {
    params: { q: query },
  });
  return response.data;
},
```

### 3.3 Hooks

File: `apps/frontend/src/features/friends/hooks/useFriends.ts` (modified — add `useSearchUsers`)

| Hook                    | TQ type    | Query key                         | Enabled                      | Cache               |
| ----------------------- | ---------- | --------------------------------- | ---------------------------- | ------------------- |
| `useSearchUsers(query)` | `useQuery` | `['user-search', debouncedQuery]` | `debouncedQuery.length >= 2` | `staleTime: 30_000` |

```typescript
export const useSearchUsers = (query: string) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return useQuery({
    queryKey: ["user-search", debouncedQuery],
    queryFn: () => friendsService.searchUsers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });
};
```

**After sending a friend request from search results**, the search cache is updated optimistically. Extend the existing `useSendFriendRequest` mutation's `onMutate` to update the matched user's `relationshipStatus` to `'pending_outgoing'` (instead of removing):

```typescript
// snapshot for rollback
const previousSearchQueries = queryClient.getQueriesData<UserSearchResult[]>({ queryKey: ['user-search'] });

// optimistic status update
queryClient.setQueriesData<UserSearchResult[]>(
  { queryKey: ["user-search"], exact: false },
  (old) => old?.map((u) => u.id === receiverId ? { ...u, relationshipStatus: 'pending_outgoing' as const } : u) ?? old,
);
```

In `onError`, restore each cached query using `previousSearchQueries`. In `onSettled`, invalidate `['user-search']`.

### 3.4 Zustand Store Changes

No store changes needed. The search query string is local UI state owned by `UserSearchPanel`; TanStack Query owns the server state. Neither belongs in Zustand.

### 3.5 Components

#### `SubNavbar.tsx` — modified

Add `'search'` to the `activeTab` union and add a third tab button:

```typescript
interface SubNavbarProps {
  activeTab: "friends" | "requests" | "search"; // extended
  onTabChange: (tab: "friends" | "requests" | "search") => void; // extended
  requestCount?: number;
}
```

Add the search tab button after the existing requests button, using `Search` from `lucide-react`.

#### `UserSearchPanel.tsx` — created

New file: `apps/frontend/src/features/friends/components/UserSearchPanel.tsx`

```typescript
interface UserSearchPanelProps {
  onSendRequest: (userId: string) => void;
}
```

Responsibilities:

- Controlled search input (`useState<string>('')`)
- Passes `query` to `useSearchUsers(query)` hook (debounce lives in the hook)
- Shows loading spinner while `isLoading && debouncedQuery.length >= 2`
- Shows idle state when `query.length < 2`
- Shows empty state when results array is empty and query is valid
- Shows user cards using the same visual style as `RecommendationList` (avatar, name, profile link)
- Renders a `RelationshipButton` per card: "Add Friend" when `relationshipStatus === 'none'`, "Pending" badge for `pending_outgoing`/`pending_incoming`, "Friends" badge for `friend`

#### `FriendList.tsx` — modified

Add a third branch for `activeTab === 'search'`:

```typescript
interface FriendListProps {
  activeTab: "friends" | "requests" | "search"; // extended
}
```

When `activeTab === 'search'`, render `<UserSearchPanel onSendRequest={(id) => sendRequest(id)} />`.

#### `friends/page.tsx` — modified

Change `useState` type:

```typescript
const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">(
  "friends",
);
```

### 3.6 Files to Create / Modify in This Phase

```
apps/frontend/app/friends/page.tsx                                             — modified (extend activeTab type)
apps/frontend/src/features/friends/services/friends.service.ts                 — modified (add searchUsers)
apps/frontend/src/features/friends/hooks/useFriends.ts                         — modified (add useSearchUsers; extend useSendFriendRequest optimistic update)
apps/frontend/src/features/friends/components/SubNavbar.tsx                    — modified (add 'search' tab)
apps/frontend/src/features/friends/components/FriendList.tsx                   — modified (add 'search' branch)
apps/frontend/src/features/friends/components/UserSearchPanel.tsx              — created
```

### 3.7 Test Cases

**Hook — `useSearchUsers`:**

- [ ] Does NOT fire when `query` length is 0
- [ ] Does NOT fire when `query` length is 1
- [ ] Fires when `query` length is exactly 2
- [ ] Debounces: does not call API within 300 ms of last keystroke; calls exactly once after idle
- [ ] Returns empty array when API returns `[]`
- [ ] `useSendFriendRequest` optimistically removes sent user from search results cache

**Component — `UserSearchPanel`:**

- [ ] Shows idle placeholder when input is empty
- [ ] Shows idle placeholder when input has 1 character
- [ ] Shows spinner when `isLoading` is true and query ≥ 2 chars
- [ ] Shows empty-state message when results is `[]` and query ≥ 2 chars
- [ ] Renders one card per result
- [ ] Each card has a profile link to `/profile/:id`
- [ ] Clicking Add Friend calls `onSendRequest` with the correct `userId`

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Architecture Decisions

| #   | Decision                   | Options considered                                                                            | Choice                            | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which fields to search     | `username`, `fullName`, `email`, `phoneNumber`                                                | `username` + `fullName` only      | `email` lives in auth-service (not in user-service DB, would require cross-service call or data duplication). `phoneNumber` is PII and optional. `username` is always present and the canonical handle. `fullName` is the natural social search.                                                                                                                                                                                                     |
| 2   | Endpoint placement         | New controller vs extend `FriendsController`                                                  | Extend `FriendsController`        | Search is scoped to finding users to befriend, and applies the same exclusion logic as recommendations. Keeping it in `/api/v1/friends/search` makes the intent clear and avoids a new controller file.                                                                                                                                                                                                                                              |
| 3   | Text search strategy       | Prisma `contains` + `mode: 'insensitive'` vs `pg_trgm` GIN index vs Postgres full-text search | Prisma `contains` (ILIKE) for now | `pg_trgm` is the production-grade solution for infix search but requires a custom migration outside Prisma DSL. Full-text search (`tsvector`) is designed for document search, not short username/name matching. ILIKE is correct and simple for a dataset that will be in the thousands range initially. The `@@index([fullName])` added in Phase 1 can be upgraded to a GIN trigram index in a follow-up migration when query volume justifies it. |
| 4   | Where does validation live | Controller `ParseQuery` pipe vs use case                                                      | Use case                          | Consistent with every other use case in this codebase (e.g., `SendFriendRequestUseCase` validates `senderId !== receiverId`). Controllers are thin pass-throughs.                                                                                                                                                                                                                                                                                    |
| 5   | Debounce location          | Component vs hook                                                                             | Hook (`useSearchUsers`)           | Debounce is tied to the TQ `enabled` condition and query key. Placing it in the hook prevents the component from needing to manage a `debouncedQuery` state variable; it just passes the raw input. This matches the `usePresence` / hook-encapsulation pattern already used in this codebase.                                                                                                                                                       |
| 6   | Caching search results     | Cache vs no cache                                                                             | Cache with 30 s `staleTime`       | Repeated searches for the same query (user types, deletes, retypes) benefit from a short cache. 30 s is long enough to avoid redundant requests but short enough that presence/request-status changes are picked up quickly.                                                                                                                                                                                                                         |
| 7   | New tab vs inline search   | Add a third tab to SubNavbar vs search inline on friends tab                                  | Third `'search'` tab              | The friends tab already shows a friends list + recommendations section. Adding an inline search input would clutter it. A dedicated tab follows the existing `SubNavbar` pattern and gives the search UI dedicated screen real estate.                                                                                                                                                                                                               |

---

## 5. Open Questions

None — all decisions are resolved in Section 4.

---

> **Reminder**: Run `pnpm generate:types` after Phase 1 to regenerate shared types from the updated OpenAPI spec.
