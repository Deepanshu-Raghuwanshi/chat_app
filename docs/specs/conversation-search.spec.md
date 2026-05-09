# Conversation Search Spec

## 1. Summary

Users on the chat page need to find old conversations quickly. The sidebar currently shows conversations in a paginated list (20 per page, cursor-based). As the list grows, there is no way to jump to a conversation without scrolling through all loaded pages — and older conversations are never even fetched unless the user scrolls to them. This feature adds a search box to the sidebar that searches the authenticated user's **entire conversation history** (not just the loaded page) by the other participant's name or username. Results are returned from the backend in a single request, bypassing pagination entirely, so conversations from months ago appear instantly regardless of how many conversations exist.

---

## 2. Current State

**Verified by reading the actual code — no assumptions.**

### Chat service backend

- **`apps/chat-service/src/infrastructure/persistence/mongoose/schemas/conversation.schema.ts`** — `Conversation` document stores only `participant1Id`, `participant2Id`, `lastActivityAt`, and a `lastMessage` snapshot. No participant names here.
- **`apps/chat-service/src/infrastructure/persistence/mongoose/schemas/conversation-participant.schema.ts`** — `ConversationParticipant` document stores `conversationId`, `userId`, **`username`**, **`fullName`**, `avatarUrl`, `lastReadAt`. Indexes: individual `conversationId` index, individual `userId` index, unique compound `(conversationId, userId)` index.
- **`apps/chat-service/src/application/ports/conversation-participant.repository.ts`** — port has: `findByConversationAndUser`, `findByConversationId`, `create`, `updateLastRead`. No search method exists.
- **`apps/chat-service/src/application/ports/conversation.repository.ts`** — port has: `findById`, `findByParticipants`, `findByUserId` (paginated), `create`, `updateLastMessage`. No search method exists.
- **`apps/chat-service/src/application/use-cases/list-conversations.use-case.ts`** — calls `findByUserId(userId, limit+1, before?)`, checks hasMore, builds views. Only knows about the current page.
- **`apps/chat-service/src/application/services/conversation-view.builder.ts`** — `build(conversation, requesterId)` joins participant names, presence, unread count. Reusable — search will call this for each matched conversation.
- **`apps/chat-service/src/application/dto/conversation.dto.ts`** — `ListConversationsQueryDto` has `limit` and `before` only. No `q` field.
- **`apps/chat-service/src/interfaces/controllers/conversation.controller.ts`** — `GET /` delegates to `ListConversationsUseCase`. No search branch.
- **`apps/chat-service/src/chat.module.ts`** — registers all existing use cases. `SearchConversationsUseCase` not registered.

### API Gateway

- **`apps/api-gateway/src/interfaces/controllers/gateway.controller.ts`** — pure transparent proxy. `chat` prefix maps to `CHAT_SERVICE_URL`. Query params (`req.query`) are forwarded verbatim. **No gateway change needed** — adding `?q=` to the upstream call is automatically forwarded.

### Frontend

- **`apps/frontend/src/features/chat/components/ConversationSidebar.tsx`** — fetches conversations with `useConversations()` (infinite query), renders `ConversationList`. No search input exists.
- **`apps/frontend/src/features/chat/hooks/useChat.ts`** — exports `useConversations` (infinite query). No `useSearchConversations` exists.
- **`apps/frontend/src/features/chat/services/chat.service.ts`** — `listConversations(params?)` sends `GET /chat/conversations`. No search function exists.
- **`apps/frontend/messages/en.json`** — `features.chat.sidebar` has `title` and `no_conversations`. No search-related keys exist.

### What does NOT exist yet

- Any backend search capability for conversations
- `?q=` query param on any conversation endpoint
- `findConversationIdsByParticipantName` repository method
- `SearchConversationsUseCase`
- Frontend search input in the sidebar
- `useSearchConversations` hook
- `searchConversations` service function

---

## 3. Desired State

### User-facing behaviour

1. User opens the chat page — sidebar renders exactly as today (paginated infinite scroll, unaffected).
2. User clicks the search input at the top of the sidebar and types at least 1 character.
3. After 300 ms of idle (debounce), the sidebar switches to search mode: existing conversation list is replaced by a results view.
4. A spinner shows while the API call is in flight.
5. Results appear — a flat, non-paginated list of matching conversations sorted by most recent activity, showing the same `ConversationItem` UI (avatar, name, last message preview, unread badge).
6. User clicks a result → navigates to that conversation exactly as today.
7. User clears the input (via `×` button or backspace to empty) → sidebar returns to normal paginated list mode with no additional API call.

### Data flow

**Search mode (query present):**
```
User types → 300ms debounce → useSearchConversations(q)
  → GET /api/v1/chat/conversations?q=john
  → API Gateway (transparent proxy, no change needed)
  → chat-service ConversationController.list()
  → q present → SearchConversationsUseCase.execute({ userId, q })
    → ConversationParticipantRepository.findConversationIdsByParticipantName(userId, q)
        Step 1: ConversationParticipant.find({ userId }) → [{ conversationId }] (my conv IDs)
        Step 2: ConversationParticipant.find({
                  conversationId: { $in: myConvIds },
                  userId: { $ne: currentUserId },
                  $or: [{ username: /q/i }, { fullName: /q/i }]
                }) → [{ conversationId }] (matched conv IDs)
    → ConversationRepository.findByIds(matchedIds)  (new method, uses _id $in)
    → ConversationViewBuilder.build() per conversation (parallel Promise.all)
  → ConversationListResponse { data: [...], hasMore: false }
  → Frontend renders flat result list
```

**Normal mode (no query):**
```
(unchanged — existing infinite query, cursor pagination)
```

### Business rules and constraints

- `q` must be at least 1 character; if empty string or absent, normal pagination applies.
- `q` is matched case-insensitively against `username` and `fullName` of the **other** participant (not the caller).
- Results are capped at **50** — more than enough for any realistic match set; prevents `Promise.all` from building a hundred views in parallel.
- Results are sorted by `lastActivityAt` descending (most recently active first) — same ordering as the normal list.
- The response always uses `ConversationListResponse` with `hasMore: false` and no `nextCursor` in search mode. The frontend's infinite query is simply not used during search; a regular `useQuery` handles it instead.
- When `q` is present, `limit` and `before` query params are silently ignored by the use case.
- Only conversations where the current user is a participant are ever returned (enforced by Step 1 of the query).
- A search returning 0 results is a valid 200 response with `data: []`.

---

## Phase 1 — Contracts & Schema

**Goal:** Define all contracts before any implementation begins.

### 1.1 OpenAPI Changes

Editing existing `libs/openapi-specs/src/v1/chat.yaml` — the search endpoint lives on the existing `GET /api/v1/chat/conversations` route. A separate endpoint would split the same resource unnecessarily; one route with an optional `q` param follows REST convention (filter params on collection endpoints).

| Method | Path                          | Auth | Purpose                                         |
| ------ | ----------------------------- | ---- | ----------------------------------------------- |
| GET    | `/api/v1/chat/conversations`  | JWT  | List (paginated) **or** search (flat, by name)  |

New `q` query param added (already done above):
```yaml
- name: q
  in: query
  description: Search term — filters by the other participant's username or full name (case-insensitive, minimum 1 character). When present activates search mode; pagination params are ignored.
  schema:
    type: string
    minLength: 1
    maxLength: 100
```

Response shape is unchanged — `ConversationListResponse` with `hasMore: false` in search mode.

### 1.2 Database Schema Changes

**No schema changes required.**

The `conversation_participants` collection already stores `username` and `fullName` per participant. The existing individual indexes on `userId` and `conversationId` are sufficient for the two-step query:

- Step 1 hits the `userId` index → O(number of my conversations)
- Step 2 hits the `conversationId` index with an `$in` filter → O(number of my conversations), then a regex scan over only those documents

The regex scan is not index-backed but the dataset is bounded by the user's conversation count, which is always small (tens to low hundreds for real users). A MongoDB text index is not appropriate here because partial/prefix matches (e.g., typing "jo" to find "john") require regex, and text indexes only support full-word matching.

**No new indexes needed. No Mongoose schema changes. No migrations.**

### 1.3 Kafka Event Contracts

No Kafka events produced or consumed. This feature is a pure read operation.

### 1.4 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/chat.yaml   — modified (add q param, update description)
```

Commands to run after this phase:
```bash
pnpm generate:types   # Regenerate shared-types from updated OpenAPI
```

---

## Phase 2 — Backend Implementation

**Goal:** Implement the search path in strict DDD layer order. Reuse existing infrastructure everywhere possible.

### 2.1 Domain Layer

No new domain entities or value objects are needed. A conversation search result is structurally identical to a `ConversationView` — same participants, same last message, same unread count. The existing `ConversationEntity` and `ConversationParticipantEntity` cover this completely.

### 2.2 Application Layer

#### Repository port — `ConversationParticipantRepository`

Add one method to the existing port at `apps/chat-service/src/application/ports/conversation-participant.repository.ts`:

```typescript
findConversationIdsByParticipantName(
  userId: string,
  query: string,
): Promise<string[]>;
```

This method returns the IDs of all conversations where:
- The current user (`userId`) is a participant, AND
- The **other** participant's `username` or `fullName` contains `query` (case-insensitive)

#### Repository port — `ConversationRepository`

Add one method to the existing port at `apps/chat-service/src/application/ports/conversation.repository.ts`:

```typescript
findByIds(ids: string[]): Promise<ConversationEntity[]>;
```

Returns conversations matching the given IDs, sorted by `lastActivityAt` descending.

#### DTO

No new DTO class needed. Add `q` as an optional field to the existing `ListConversationsQueryDto` in `apps/chat-service/src/application/dto/conversation.dto.ts`:

```typescript
@ApiPropertyOptional({ description: "Search term — min 1 char, max 100 chars", minLength: 1, maxLength: 100 })
@IsOptional()
@IsString()
@MinLength(1)
@MaxLength(100)
q?: string;
```

#### Use case

**`SearchConversationsUseCase`** — created at `apps/chat-service/src/application/use-cases/search-conversations.use-case.ts`

| Use Case Class                | HTTP Trigger                              | Business Rules Enforced          | Events Emitted |
| ----------------------------- | ----------------------------------------- | -------------------------------- | -------------- |
| `SearchConversationsUseCase`  | GET /chat/conversations?q=<term>          | Caller sees only own convos; cap at 50 | none   |

Exact execution sequence:

1. Call `ConversationParticipantRepository.findConversationIdsByParticipantName(userId, q)` → get matching conversation IDs (max 50 enforced in implementation).
2. If result is empty → return `{ data: [], hasMore: false }` immediately (avoids unnecessary DB call).
3. Call `ConversationRepository.findByIds(matchedIds)` → get `ConversationEntity[]` sorted by `lastActivityAt` desc.
4. Call `ConversationViewBuilder.build(conv, userId)` in parallel via `Promise.all` → returns `ConversationView[]`.
5. Return `{ data: views, hasMore: false }` — `hasMore` is always false in search mode.

### 2.3 Infrastructure Layer

#### `MongooseConversationParticipantRepository` — add `findConversationIdsByParticipantName`

```typescript
async findConversationIdsByParticipantName(
  userId: string,
  query: string,
): Promise<string[]> {
  // Step 1: all conversation IDs the current user belongs to
  const myParticipations = await this.model
    .find({ userId })
    .select('conversationId')
    .lean()
    .exec();

  const myConvIds = myParticipations.map((p) => p.conversationId);
  if (myConvIds.length === 0) return [];

  // Step 2: among those conversations, find the OTHER participant matching the query
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  const matched = await this.model
    .find({
      conversationId: { $in: myConvIds },
      userId: { $ne: userId },
      $or: [{ username: regex }, { fullName: regex }],
    })
    .select('conversationId')
    .limit(50)
    .lean()
    .exec();

  return matched.map((p) => p.conversationId);
}
```

**Why this query is written this way:**

- **Two-step instead of aggregation:** MongoDB's `$lookup` on the same collection (self-join) is possible but requires an aggregation pipeline that is harder to read, harder to test, and offers no performance advantage for the dataset sizes involved. Two simple indexed queries are cleaner.
- **`query.replace(...)` regex escape:** User input must not be passed raw into a `RegExp` constructor — unescaped special characters like `.` or `*` would create an unintended pattern. Escaping prevents ReDoS and incorrect matches.
- **`$ne: userId`:** Filters out the caller's own participant document so we never match the user against their own username.
- **`.limit(50)` on Step 2:** Caps the result set. The `findByIds` call and the `Promise.all` of view builds are bounded. Without this, a user with 500 conversations whose other participants all happen to match would trigger 500 parallel MongoDB queries via the view builder.
- **`.lean()`:** Returns plain objects instead of Mongoose documents — significantly faster for read-only queries since Mongoose hydration overhead is skipped.
- **`$in` uses existing `conversationId` index:** Step 2 hits the individual `conversationId` index on `conversation_participants`, making the lookup O(n_my_conversations) rather than a full collection scan.

#### `MongooseConversationRepository` — add `findByIds`

```typescript
async findByIds(ids: string[]): Promise<ConversationEntity[]> {
  const objectIds = ids
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const docs = await this.model
    .find({ _id: { $in: objectIds } })
    .sort({ lastActivityAt: -1 })
    .exec();

  return docs.map((d) => this.toEntity(d));
}
```

**Why sort here and not in the use case:** The repository is the correct layer to own query ordering for persistence operations. The use case should receive results in the correct order and not have to sort in memory.

#### Caching

No caching for search results. Search is infrequent (only fires on user input), the dataset is small, and search results can change if a participant updates their display name. The complexity of cache invalidation is not justified.

### 2.4 Interfaces Layer

Modify **existing** `ConversationController.list()` in `apps/chat-service/src/interfaces/controllers/conversation.controller.ts` to branch on `query.q`:

```typescript
@Get()
async list(
  @Req() req: RequestWithUser,
  @Query() query: ListConversationsQueryDto,
) {
  if (query.q) {
    return this.searchConversations.execute({
      userId: req.user.id,
      q: query.q,
    });
  }
  return this.listConversations.execute({
    userId: req.user.id,
    limit: query.limit,
    before: query.before,
  });
}
```

`SearchConversationsUseCase` is injected into the controller constructor alongside the existing use cases.

### 2.5 Module Registration

Modify `apps/chat-service/src/chat.module.ts`:

- Import `SearchConversationsUseCase`
- Add to `providers` array: `SearchConversationsUseCase`
- Add to `ConversationController` constructor injection: `SearchConversationsUseCase`

No new repository bindings — both new repository methods are added to the existing implementations already registered as `ConversationRepository` and `ConversationParticipantRepository`.

### 2.6 Files to Create / Modify in This Phase

```
apps/chat-service/src/application/ports/conversation-participant.repository.ts  — modified (add findConversationIdsByParticipantName)
apps/chat-service/src/application/ports/conversation.repository.ts              — modified (add findByIds)
apps/chat-service/src/application/dto/conversation.dto.ts                       — modified (add q field to ListConversationsQueryDto)
apps/chat-service/src/application/use-cases/search-conversations.use-case.ts   — created
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-conversation-participant.repository.ts  — modified (implement findConversationIdsByParticipantName)
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-conversation.repository.ts              — modified (implement findByIds)
apps/chat-service/src/interfaces/controllers/conversation.controller.ts         — modified (inject SearchConversationsUseCase, add branch in list())
apps/chat-service/src/chat.module.ts                                            — modified (register SearchConversationsUseCase)
```

### 2.7 Test Cases

**Unit — `SearchConversationsUseCase`** (`apps/chat-service/tests/unit/search-conversations.use-case.spec.ts`):

Test framework: Sinon + Chai (matching existing test style).

- [ ] Happy path: returns `{ data: [view], hasMore: false }` when participant repo returns one conversation ID and view builder builds it correctly.
- [ ] Returns `{ data: [], hasMore: false }` immediately when `findConversationIdsByParticipantName` returns an empty array — `findByIds` must NOT be called.
- [ ] `hasMore` is always `false` regardless of how many conversations are returned.
- [ ] `findByIds` is called with exactly the IDs returned by `findConversationIdsByParticipantName` — no extras.
- [ ] `ConversationViewBuilder.build` is called once per conversation (parallel — verify call count).
- [ ] Returns up to 50 results when repo returns 50 IDs.

```bash
pnpm nx typecheck chat-service
pnpm nx lint chat-service
pnpm nx test chat-service
```

---

## Phase 3 — Frontend Implementation

**Goal:** Wire the search input into the sidebar so it switches between normal list mode and search mode cleanly.

### 3.1 Routes / Pages

No new routes or pages. The sidebar is rendered on both `/chat` and `/chat/[conversationId]` via `ChatLayout → ConversationSidebar`. Modifying `ConversationSidebar` handles both automatically.

| Route                    | Page File                            | New or Modified | Purpose                      |
| ------------------------ | ------------------------------------ | --------------- | ---------------------------- |
| `/chat`                  | `app/chat/page.tsx`                  | unchanged       | —                            |
| `/chat/[conversationId]` | `app/chat/[conversationId]/page.tsx` | unchanged       | —                            |

### 3.2 API Service

Add to existing `apps/frontend/src/features/chat/services/chat.service.ts`:

```typescript
async searchConversations(q: string): Promise<ConversationListResponse> {
  const { data } = await apiClient.get<ConversationListResponse>(
    '/chat/conversations',
    { params: { q } },
  );
  return data;
},
```

Reuses the same endpoint and same `ConversationListResponse` type — no new types needed.

### 3.3 Hooks

Add to existing `apps/frontend/src/features/chat/hooks/useChat.ts`:

```typescript
export const useSearchConversations = (query: string) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return useQuery({
    queryKey: ['conversation-search', debouncedQuery],
    queryFn: () => chatService.searchConversations(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
  });
};
```

**Debounce inside the hook** — matching the exact pattern used in `useSearchUsers` in `useFriends.ts`. No external debounce library.

| Hook                           | TQ Type    | Query Key                                | Enabled Condition         | Cache Strategy   |
| ------------------------------ | ---------- | ---------------------------------------- | ------------------------- | ---------------- |
| `useSearchConversations(query)` | `useQuery` | `['conversation-search', debouncedQuery]` | `query.trim().length >= 1` | `staleTime: 30s` |

### 3.4 Zustand Store Changes

No store changes. The search query is transient local UI state — it lives in a `useState` inside `ConversationSidebar` and does not need to persist across navigation or be shared with other components.

### 3.5 Components

Modify existing `ConversationSidebar` only. No new components needed — `ConversationList` already accepts any `Conversation[]` array and can render search results without modification.

**`ConversationSidebar`** — modified:

```
State added:
  searchQuery: string  (useState, local)

Derived:
  isSearchMode = searchQuery.trim().length >= 1
  
When isSearchMode = false:
  use existing useConversations() infinite query
  conversations = data?.pages.flatMap(p => p.data) ?? []

When isSearchMode = true:
  use useSearchConversations(searchQuery)
  conversations = searchData?.data ?? []
```

Layout addition — below the existing `<h1>Messages</h1>` header line, add a search input row:

```
┌────────────────────────────────────────┐
│  💬 Messages                           │  ← existing header (unchanged)
│  ┌─────────────────────────────────┐  │  ← NEW: search input row
│  │ 🔍 Search conversations...   ✕  │  │
│  └─────────────────────────────────┘  │
│  ConversationList (filtered or normal) │
└────────────────────────────────────────┘
```

- `×` clear button appears only when `searchQuery.length > 0`; clicking it sets `searchQuery` to `''`
- When `isSearchMode` and `isLoading` → show `Spinner` in place of conversation list
- When `isSearchMode` and `!isLoading` and `conversations.length === 0` → show "No conversations found" empty state (own i18n key)
- When `isSearchMode` and results present → render `ConversationList` exactly as today
- The infinite scroll `onLoadMore`/`hasMore`/`isFetchingMore` props are passed as `undefined`/`false`/`false` during search mode — `ConversationList` already handles `hasMore: false` gracefully (it doesn't render the sentinel or spinner)

| Component              | New or Modified | Key Changes                                                          |
| ---------------------- | --------------- | -------------------------------------------------------------------- |
| `ConversationSidebar`  | modified        | Add `searchQuery` state, search input UI, mode switching logic       |
| `ConversationList`     | unchanged       | Already accepts any `Conversation[]` and handles empty/hasMore:false |

### 3.6 i18n Keys

Add to `apps/frontend/messages/en.json` under `features.chat.sidebar`:

```json
"search_placeholder": "Search conversations...",
"search_no_results": "No conversations found for \"{query}\""
```

### 3.7 Files to Create / Modify in This Phase

```
apps/frontend/src/features/chat/services/chat.service.ts          — modified (add searchConversations)
apps/frontend/src/features/chat/hooks/useChat.ts                   — modified (add useSearchConversations)
apps/frontend/src/features/chat/components/ConversationSidebar.tsx — modified (add search input + mode switching)
apps/frontend/messages/en.json                                     — modified (add 2 i18n keys under features.chat.sidebar)
```

### 3.8 Test Cases

**Hook tests** (`apps/frontend/tests/unit/`):

- [ ] `useSearchConversations`: does NOT fire when query is empty string.
- [ ] `useSearchConversations`: debounces — API is only called after 300ms of idle, not on every keystroke.
- [ ] `useSearchConversations`: calls `chatService.searchConversations` with the debounced query value.
- [ ] `useSearchConversations`: returns empty `data` array when API returns `{ data: [], hasMore: false }`.

**Component tests** — `ConversationSidebar`:

- [ ] Renders search input with placeholder text.
- [ ] Does not show `×` button when input is empty.
- [ ] Shows `×` button when input has text; clicking it clears the input and returns to normal list mode.
- [ ] Shows `Spinner` while `useSearchConversations` is loading.
- [ ] Shows "no results" message when search returns empty array.
- [ ] Renders `ConversationList` with search results when results are present.
- [ ] Does not call `fetchNextPage` / render infinite scroll sentinel in search mode.

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Architecture Decisions

| #   | Decision | Options Considered | Choice | Rationale |
| --- | -------- | ------------------ | ------ | --------- |
| 1 | Where does the search live? | New endpoint `GET /chat/conversations/search` vs `?q=` param on existing list endpoint | `?q=` param on existing endpoint | Same resource, same response type. A separate path would require the frontend to maintain two base URLs and the gateway has no routing logic to update. The existing `ConversationListResponse` type already covers search results with `hasMore: false`. |
| 2 | Two-step query vs MongoDB aggregation | Two separate `.find()` calls vs `$lookup` aggregation pipeline | Two-step `.find()` | Both hit existing indexes. The two-step approach is easier to read, easier to unit test (stubs are simple), and the intermediate array (my conversation IDs) is bounded by the user's total conversation count, which is always small. An aggregation pipeline joining the same collection on itself is harder to stub in tests. |
| 3 | Where to cap result count (50)? | Repository layer vs use case layer | Repository layer (`.limit(50)` in Step 2 of the query) | Capping in the repository prevents the matched ID array from growing before it reaches the use case. The view builder does `Promise.all` across those IDs — bounding at the source means the use case never receives an oversized array. |
| 4 | Regex escape on user input | Raw `RegExp(query)` vs escaped | Escaped with `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` | User input passed raw into a RegExp constructor is a ReDoS vector and produces incorrect matches for special characters (a user named "A.J. Smith" would be matched by the dot as any character). Escaping is mandatory. |
| 5 | Frontend — one hook or two? | Merge search into `useConversations` vs separate `useSearchConversations` | Separate hook | `useConversations` is an `useInfiniteQuery` with its own cache key structure. Conflating a regular `useQuery` into it would require conditional logic inside the hook and pollute the `['conversations']` cache. Two focused hooks, each for one purpose, is cleaner and matches the existing pattern in this codebase (`useFriends` vs `useSearchUsers`). |
| 6 | Debounce location | In the hook vs in the component | In the hook (matching `useSearchUsers` pattern) | Keeps the debounce co-located with the API call. The component just binds the input value. Consistent with the friends feature's established pattern. |
| 7 | New index on `fullName`? | Add text index on `(username, fullName)` vs rely on existing indexes + regex | No new index | A text index only supports full-word matching — typing "jo" would NOT find "john" with a text index. Partial/prefix matching requires regex. The regex scan is bounded to the user's own conversation set (Step 2 only scans the other participant documents for their conversation IDs), so it's fast enough without an index. |

---

## 5. Open Questions

None — all decisions are resolved in Section 4.

---

## Reminder

Run after Phase 1:
```bash
pnpm generate:types
```
