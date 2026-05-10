# Message Delivery & Read Status — Feature Spec

## 1. Summary

This feature surfaces the existing `Message.status` field (SENT / DELIVERED / READ) in the UI as WhatsApp-style checkmark icons below each message timestamp. The `status` field, enum, OpenAPI schema, and shared types are **already in the database and the contract** — what is missing is the business logic that advances the status, the Kafka event for delivery, the gateway fanout for both delivery and read, and the frontend rendering. The feature requires changes across the backend (two use cases, the repository port and its implementation, and the chat gateway) and the frontend (the socket hook and the message bubble component).

---

## 2. Current State

All facts below were verified by reading the code directly.

### What already exists

**Database (`apps/chat-service`):**
- `Message.status` field exists in `infrastructure/persistence/mongoose/schemas/message.schema.ts` with enum `['SENT', 'DELIVERED', 'READ']` and default `'SENT'`
- `ConversationParticipant.lastReadAt` field exists for a conversation-level read cursor

**Kafka contracts (`libs/kafka-events/src/v1/chat-events.ts`):**
- `MessageStatus` enum: `SENT | DELIVERED | READ`
- `ChatTopics.MESSAGE_READ = "message.read.v1"` — topic exists
- `MessageReadEventV1` interface exists: `{ conversationId, userId, lastReadAt }` — note: no `senderId` field (this is a gap)
- `MESSAGE_SENT`, `MESSAGE_EDITED`, `MESSAGE_DELETED` topics all exist

**OpenAPI + shared types:**
- `Message.status` in `libs/openapi-specs/src/v1/chat.yaml` with enum `[SENT, DELIVERED, READ]`
- Auto-generated `libs/shared-types/src/v1/chat.types.ts` exposes `status: "SENT" | "DELIVERED" | "READ"`

**Application layer:**
- `SendMessageUseCase` creates messages with `status: SENT` (schema default)
- `MarkConversationReadUseCase` (`application/use-cases/mark-conversation-read.use-case.ts`) updates `ConversationParticipant.lastReadAt` and emits `MESSAGE_READ` Kafka event — but does NOT update individual `Message.status` fields

**Infrastructure:**
- `ChatGateway` (`infrastructure/messaging/chat.gateway.ts`) subscribes to `MESSAGE_SENT`, `MESSAGE_EDITED`, `MESSAGE_DELETED`, `FRIEND_REMOVED`, `FRIEND_REQUEST_SENT` — does NOT subscribe to `MESSAGE_DELIVERED` or `MESSAGE_READ`
- `PresenceGateway.emitToRoom()` exists and is the correct fanout mechanism

**Frontend:**
- `MessageBubble.tsx` renders time and edit/delete controls — **no status indicator**
- `usePresence.ts` handles `message.new`, `presence.updated`, `friendship.removed`, `friend.request.received` — **no `message.delivered` or `message.read` handlers**
- `useChatStore.ts` has `activeConversationId` — needed for auto-read on new message arrival

### What does NOT exist

| Gap | Impact |
|-----|--------|
| `ChatTopics.MESSAGE_DELIVERED` topic | Cannot emit delivery event |
| `MessageDeliveredEventV1` interface | No typed event payload |
| `senderId` in `MessageReadEventV1` | ChatGateway cannot route `message.read` socket event without a DB lookup |
| `status` in `UpdateMessageInput` | Cannot update message status through the repository |
| `updateStatusBySender()` in `MessageRepository` port | Cannot bulk-transition SENT → DELIVERED or SENT/DELIVERED → READ |
| Delivery logic in `GetMessagesUseCase` | Status never transitions from SENT to DELIVERED |
| Read status logic in `MarkConversationReadUseCase` | Individual messages never reach READ status |
| `MESSAGE_DELIVERED` and `MESSAGE_READ` fanout in `ChatGateway` | Sender never receives real-time status update |
| Checkmark icons in `MessageBubble` | User never sees delivery/read confirmation |
| Socket listeners in `usePresence` | Frontend cannot react to status updates |

---

## 3. Desired State

### User-facing behaviour

1. User A sends a message → single grey checkmark appears below the timestamp (SENT)
2. User B opens the conversation (API fetches messages) → User A's checkmark updates to double grey in real-time (DELIVERED)
3. User B marks conversation as read → User A's checkmark updates to double blue in real-time (READ)
4. If User B already has the conversation open when User A's message arrives via socket, the auto-read path fires immediately → User A sees double blue checkmarks without any intermediate DELIVERED state
5. Status indicators only appear on the sender's own messages (`isMine === true`)
6. Deleted messages show the tombstone UI — no checkmarks

### Data flows

**DELIVERED transition** (User B opens conversation):

```
User B: GET /api/v1/chat/conversations/{id}/messages
→ API Gateway → chat-service
→ GetMessagesUseCase.execute({ userId: B, conversationId })
  1. Fetch messages (existing logic)
  2. Derive otherUserId = the participant who is not B
  3. Filter: messages from otherUserId with status SENT → sentMessageIds
  4. In-memory update: set those messages' status to DELIVERED in the response
  5. Fire-and-forget:
       MessageRepository.updateStatusBySender(conversationId, otherUserId, ['SENT'], 'DELIVERED')
       → (after update) KafkaProducer.emit(MESSAGE_DELIVERED, { conversationId, senderId: A, recipientId: B, deliveredAt })
  6. Return messages (with DELIVERED status already reflected in response)
→ ChatGateway consumes MESSAGE_DELIVERED
→ PresenceGateway.emitToRoom('user:{A}', 'message.delivered', { conversationId, senderId: A, recipientId: B, deliveredAt })
→ User A frontend: usePresence 'message.delivered' handler
  → updates messages cache: A's SENT messages in conversationId → DELIVERED
  → MessageBubble re-renders: single grey → double grey checkmarks
```

**READ transition** (User B calls mark-as-read):

```
User B: POST /api/v1/chat/conversations/{id}/read
→ API Gateway → chat-service
→ MarkConversationReadUseCase.execute({ userId: B, conversationId })
  1. Validate participant (existing)
  2. Derive otherUserId = the participant who is not B
  3. participantRepository.updateLastRead(conversationId, B, now) (existing)
  4. messageRepository.updateStatusBySender(conversationId, otherUserId, ['SENT', 'DELIVERED'], 'READ') ← NEW
  5. KafkaProducer.emit(MESSAGE_READ, { conversationId, readerId: B, senderId: A, lastReadAt }) ← updated payload
→ ChatGateway consumes MESSAGE_READ
→ PresenceGateway.emitToRoom('user:{A}', 'message.read', { conversationId, senderId: A, lastReadAt })
→ User A frontend: usePresence 'message.read' handler
  → updates messages cache: all messages from A in conversationId → READ
  → MessageBubble re-renders: double grey → double blue checkmarks
```

**Auto-read when conversation is already open** (User B is in the conversation):

```
Socket: 'message.new' arrives (data.conversationId === activeConversationId)
→ usePresence: existing cache update (prepend message as SENT)
→ usePresence: auto-calls markRead(data.conversationId) ← NEW
→ Same READ transition flow above fires immediately
→ User A sees double blue checkmarks without intermediate DELIVERED state
```

### Business rules and constraints

- Status only advances forward: `SENT → DELIVERED → READ`. The bulk update query always uses `$in: fromStatuses` to prevent backward transitions.
- Sender's own messages are never marked DELIVERED or READ by their own fetch or read call (the `senderId` filter ensures only the other participant's messages are updated).
- The DB bulk update is fire-and-forget from the perspective of the API response. If it fails, the fetch still succeeds and the status update will be retried on the next fetch (idempotent by design).
- The Kafka delivery event is emitted only if `modifiedCount > 0` to avoid spurious socket events on repeated fetches.
- `MessageReadEventV1` must carry `senderId` so `ChatGateway` can route the socket event to the correct user room without a DB lookup.
- Deleted messages (`isDeleted: true`) are excluded from bulk status updates (the `updateStatusBySender` query adds `isDeleted: false` to its filter).
- Auto-read only fires when `data.conversationId === activeConversationId` (Zustand store), preventing spurious read calls for background conversations.

---

## Phase 1 — Contracts & Schema

**Goal**: Define all new Kafka event contracts and extend the repository port interface. No implementation in this phase.

### 1.1 OpenAPI Changes

Editing `libs/openapi-specs/src/v1/chat.yaml` (existing file — no new endpoints are needed; `Message.status` already covers all three enum values).

The only change is the Kafka events comment block at the bottom to document the new `message.delivered.v1` topic and the updated `message.read.v1` payload. **Already applied** to `chat.yaml`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| — | — | — | No new HTTP endpoints |

### 1.2 Database Schema Changes

**None required.** The `Message.status` field already exists in the Mongoose schema with all three enum values and the correct default. `ConversationParticipant.lastReadAt` also already exists.

### 1.3 Kafka Event Contracts

| Direction | Topic | Producer | Consumer | Payload |
|-----------|-------|----------|----------|---------|
| Produces (new) | `message.delivered.v1` | chat-service (GetMessagesUseCase) | ChatGateway (same service) | `{ conversationId, senderId, recipientId, deliveredAt }` |
| Produces (modified) | `message.read.v1` | chat-service (MarkConversationReadUseCase) | ChatGateway (same service) | adds `senderId` field to existing payload |

**New — `MessageDeliveredEventV1`:**
```typescript
export interface MessageDeliveredEventV1 {
  conversationId: string;
  senderId: string;    // Original message sender (User A) — the socket room to notify
  recipientId: string; // The user whose fetch triggered delivery (User B)
  deliveredAt: string; // ISO 8601
}
```

**Modified — `MessageReadEventV1`** (add `senderId`; `userId` renamed to `readerId` for clarity):
```typescript
export interface MessageReadEventV1 {
  conversationId: string;
  readerId: string;    // The user who marked as read (was: userId)
  senderId: string;    // NEW: the other participant whose messages are being marked READ
  lastReadAt: string;
}
```

> **Note on renaming `userId` → `readerId`:** This is a breaking change to the existing interface. Update the one call site in `MarkConversationReadUseCase` and the one consumer branch in `ChatGateway` (where it will be added). There are no other consumers today.

### 1.4 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/chat.yaml                    — modified (Kafka comment block) ✅ done
libs/kafka-events/src/v1/chat-events.ts                — modified (add MESSAGE_DELIVERED topic, MessageDeliveredEventV1, update MessageReadEventV1)
libs/kafka-events/src/index.ts                         — modified (export MessageDeliveredEventV1)
apps/chat-service/src/application/ports/message.repository.ts — modified (add updateStatusBySender method, add status to UpdateMessageInput)
```

Commands to run after this phase:

```bash
pnpm generate:types    # Regenerate shared-types from OpenAPI (no schema changes but good practice)
```

---

## Phase 2 — Backend Implementation

**Goal**: Wire the business logic. Every change follows the existing DDD layer order used throughout the service.

### 2.1 Domain Layer

No new domain entities. The `MessageEntity` already carries a `status: string` field. No invariants need to be enforced at the domain level for status transitions (the transition is triggered by external events, not domain logic).

### 2.2 Application Layer

#### Repository port changes (`application/ports/message.repository.ts`)

Add `status` to `UpdateMessageInput` (allows future single-message status updates):

```typescript
export interface UpdateMessageInput {
  content?: string;
  isDeleted?: boolean;
  isEdited?: boolean;
  status?: string;   // NEW
}
```

Add new bulk-transition method:

```typescript
/**
 * Bulk-updates message status for all non-deleted messages sent by `senderId`
 * in `conversationId` that currently have one of the `fromStatuses`.
 * Returns the number of documents modified (used to decide whether to emit events).
 */
updateStatusBySender(
  conversationId: string,
  senderId: string,
  fromStatuses: string[],
  toStatus: string,
): Promise<number>;
```

#### GetMessagesUseCase changes

Inject `KafkaProducerService` (new dependency — add to constructor and module registration).

After fetching messages, derive delivery update logic:

```typescript
// Execution sequence (after existing validation):
const otherUserId =
  conversation.participant1Id === dto.userId
    ? conversation.participant2Id
    : conversation.participant1Id;

const messages = await this.messageRepository.findByConversationId(
  dto.conversationId, limit + 1, dto.before,
);
const hasMore = messages.length > limit;
const page = messages.slice(0, limit);

// Identify SENT messages from the other participant
const sentIds = new Set(
  page.filter(m => m.senderId === otherUserId && m.status === 'SENT').map(m => m.id),
);

// Return response with DELIVERED reflected in memory immediately
const views = page.map(m => this.toView(
  sentIds.has(m.id) ? { ...m, status: 'DELIVERED' } : m
));

// Fire-and-forget: DB update → Kafka event (do not await for response latency)
if (sentIds.size > 0) {
  this.messageRepository
    .updateStatusBySender(dto.conversationId, otherUserId, ['SENT'], 'DELIVERED')
    .then(count => {
      if (count > 0) {
        return this.kafkaProducer.emit(ChatTopics.MESSAGE_DELIVERED, {
          conversationId: dto.conversationId,
          senderId: otherUserId,
          recipientId: dto.userId,
          deliveredAt: new Date().toISOString(),
        } satisfies MessageDeliveredEventV1);
      }
    })
    .catch(err => this.logger.error('Failed to update delivery status', err));
}

return { data: views, hasMore, nextCursor: hasMore ? page[page.length - 1].id : undefined };
```

Add `private readonly logger = new Logger(GetMessagesUseCase.name)` for the error path.

#### MarkConversationReadUseCase changes

Inject `MessageRepository` (new dependency — add to constructor and module registration).

After updating `lastReadAt`, also transition individual message statuses:

```typescript
// After existing: participantRepository.updateLastRead(...)
const otherUserId =
  conversation.participant1Id === userId
    ? conversation.participant2Id
    : conversation.participant1Id;

await this.messageRepository.updateStatusBySender(
  conversationId, otherUserId, ['SENT', 'DELIVERED'], 'READ'
);

// Updated event payload — now includes senderId for gateway routing
await this.kafkaProducer.emit(ChatTopics.MESSAGE_READ, {
  conversationId,
  readerId: userId,        // renamed from userId
  senderId: otherUserId,  // NEW
  lastReadAt: now.toISOString(),
} satisfies MessageReadEventV1);
```

#### Use case summary

| Use Case | Change | Events Emitted |
|----------|--------|----------------|
| `GetMessagesUseCase` | Add delivery transition + event | `message.delivered.v1` (conditional) |
| `MarkConversationReadUseCase` | Add READ transition + updated event payload | `message.read.v1` (updated payload) |
| `SendMessageUseCase` | No change | `message.sent.v1` (unchanged) |

### 2.3 Infrastructure Layer

#### MongooseMessageRepository — new method

```typescript
async updateStatusBySender(
  conversationId: string,
  senderId: string,
  fromStatuses: string[],
  toStatus: string,
): Promise<number> {
  const result = await this.messageModel.updateMany(
    {
      conversationId,
      senderId,
      status: { $in: fromStatuses },
      isDeleted: false,
    },
    { $set: { status: toStatus } },
  );
  return result.modifiedCount;
}
```

The `{ conversationId: 1, createdAt: -1 }` index already on the collection does not cover this query efficiently. The filter is `{ conversationId, senderId, status }`. Consider adding a compound index:

```typescript
MessageSchema.index({ conversationId: 1, senderId: 1, status: 1 });
```

This index is used by both the new bulk-update and by `countUnread` (which currently uses `{ conversationId: 1, createdAt: -1 }`). Worth adding since delivery/read calls happen on every conversation open.

#### ChatGateway — subscribe to new topics and fan out

Subscribe to `ChatTopics.MESSAGE_DELIVERED` and `ChatTopics.MESSAGE_READ`:

```typescript
await this.consumer.subscribe({
  topics: [
    ChatTopics.MESSAGE_SENT,
    ChatTopics.MESSAGE_DELIVERED,  // NEW
    ChatTopics.MESSAGE_EDITED,
    ChatTopics.MESSAGE_DELETED,
    ChatTopics.MESSAGE_READ,       // NEW
    FriendTopics.FRIEND_REMOVED,
    FriendTopics.FRIEND_REQUEST_SENT,
  ],
  fromBeginning: false,
});
```

Add two new branches in `fanOut()`:

```typescript
} else if (topic === ChatTopics.MESSAGE_DELIVERED) {
  if (!p.senderId) return;
  const event = p as unknown as MessageDeliveredEventV1;
  this.presenceGateway.emitToRoom(
    `user:${event.senderId}`,
    'message.delivered',
    event,
  );
} else if (topic === ChatTopics.MESSAGE_READ) {
  if (!p.senderId) return;
  const event = p as unknown as MessageReadEventV1;
  this.presenceGateway.emitToRoom(
    `user:${event.senderId}`,
    'message.read',
    event,
  );
}
```

Both routes notify the **sender** of the original messages (User A) so they see their checkmarks update.

### 2.4 Interfaces Layer

No controller changes — no new HTTP endpoints.

### 2.5 Module Registration

**`GetMessagesUseCase`** — inject `KafkaProducerService` (already a module-level provider):

```typescript
// In chat.module.ts providers array — add KafkaProducerService to GetMessagesUseCase injection
// KafkaProducerService is already registered; just add it to GetMessagesUseCase constructor
```

**`MarkConversationReadUseCase`** — inject `MessageRepository` (already bound as `'MessageRepository'`):

```typescript
// Add @Inject('MessageRepository') to MarkConversationReadUseCase constructor
```

**New Mongoose index** — add to `MessageSchema` in the schema file, no Mongoose migration needed (MongoDB adds indexes automatically on next startup; TTL and unique indexes require more care, but this is a plain compound index).

### 2.6 Files to Create / Modify in This Phase

```
libs/kafka-events/src/v1/chat-events.ts                                        — modified (MESSAGE_DELIVERED, MessageDeliveredEventV1, update MessageReadEventV1)
libs/kafka-events/src/index.ts                                                  — modified (export MessageDeliveredEventV1)
apps/chat-service/src/application/ports/message.repository.ts                  — modified (updateStatusBySender method, status in UpdateMessageInput)
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-message.repository.ts — modified (implement updateStatusBySender)
apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts      — modified (add compound index { conversationId, senderId, status })
apps/chat-service/src/application/use-cases/get-messages.use-case.ts           — modified (delivery logic, KafkaProducerService injection)
apps/chat-service/src/application/use-cases/mark-conversation-read.use-case.ts — modified (READ transition, updated event payload, MessageRepository injection)
apps/chat-service/src/infrastructure/messaging/chat.gateway.ts                 — modified (subscribe to MESSAGE_DELIVERED and MESSAGE_READ, fanout branches)
```

### 2.7 Test Cases

**Unit — `GetMessagesUseCase`:**
- [ ] When recipient fetches messages: SENT messages from sender are returned with status `DELIVERED` in the view (in-memory update reflected)
- [ ] When recipient fetches messages: `updateStatusBySender` is called with `['SENT']` and `'DELIVERED'`
- [ ] When recipient fetches messages and no SENT messages exist: `updateStatusBySender` is NOT called and no Kafka event is emitted
- [ ] Kafka event `message.delivered.v1` is emitted with `{ conversationId, senderId, recipientId, deliveredAt }`
- [ ] When `updateStatusBySender` returns `0`: Kafka event is NOT emitted
- [ ] When `updateStatusBySender` throws: fetch still succeeds, error is logged, no crash

**Unit — `MarkConversationReadUseCase`:**
- [ ] `updateStatusBySender` is called with `['SENT', 'DELIVERED']` and `'READ'` after `updateLastRead`
- [ ] Kafka event `message.read.v1` is emitted with `{ conversationId, readerId, senderId, lastReadAt }`
- [ ] `senderId` in the event is the OTHER participant (not the user calling mark-as-read)
- [ ] Throws `NotFoundException` when conversation not found
- [ ] Throws `ForbiddenException` when user is not a participant

```bash
pnpm nx typecheck chat-service
pnpm nx lint chat-service
pnpm nx test chat-service
```

---

## Phase 3 — Frontend Implementation

**Goal**: React to the new socket events and render status indicators. No new services, hooks, or store state are needed beyond extending `usePresence.ts` and `MessageBubble.tsx`.

### 3.1 Routes / Pages

No new routes or pages. The existing `/chat` page and `ConversationView` are unchanged.

### 3.2 API Service

No new service methods. The `markRead` method in `chat.service.ts` already exists and is reused for auto-read.

### 3.3 Hooks

No new hooks. `useMarkRead(conversationId)` already exists in `useChat.ts`.

The `usePresence.ts` hook is extended with two new socket listeners and the auto-read trigger on `message.new`.

### 3.4 Zustand Store Changes

None. `activeConversationId` already exists in `useChatStore.ts` and is the correct mechanism to check whether the incoming message's conversation is currently open.

### 3.5 Components & Socket Logic

#### `usePresence.ts` — three additions

**1. Auto-read when message.new arrives for active conversation**

Inside the existing `socket.on('message.new', ...)` handler, after the cache update:

```typescript
// Auto-read if this conversation is currently open
const { activeConversationId } = useChatStore.getState();
if (data.conversationId === activeConversationId) {
  queryClient.getMutationCache(); // not needed — just call the API
  // Call markRead via the service directly (not via hook mutation, which requires component context)
  chatService.markRead(data.conversationId).catch(() => {});
}
```

> The hook is not inside a component render, so it cannot call `useMarkRead()`. Import `chatService.markRead` directly from `chat.service.ts` for this call.

**2. `message.delivered` listener**

```typescript
interface MessageDeliveredPayload {
  conversationId: string;
  senderId: string;
  recipientId: string;
  deliveredAt: string;
}

socket.on('message.delivered', (data: MessageDeliveredPayload) => {
  queryClient.setQueryData<InfiniteData<MessageListResponse>>(
    ['messages', data.conversationId],
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: (page.data ?? []).map((msg) =>
            msg.senderId === data.senderId && msg.status === 'SENT'
              ? { ...msg, status: 'DELIVERED' as const }
              : msg,
          ),
        })),
      };
    },
  );
});
```

**3. `message.read` listener**

```typescript
interface MessageReadPayload {
  conversationId: string;
  senderId: string;
  lastReadAt: string;
}

socket.on('message.read', (data: MessageReadPayload) => {
  queryClient.setQueryData<InfiniteData<MessageListResponse>>(
    ['messages', data.conversationId],
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: (page.data ?? []).map((msg) =>
            msg.senderId === data.senderId && msg.status !== 'READ'
              ? { ...msg, status: 'READ' as const }
              : msg,
          ),
        })),
      };
    },
  );
});
```

#### `MessageBubble.tsx` — status indicator

Add checkmark indicator below the message time. Only render for `isMine` messages. Lucide's `Check` icon is already imported; add `CheckCheck`.

```tsx
import { MoreVertical, Pencil, Trash2, Check, X, CheckCheck } from 'lucide-react';

// Inside the time row (below the existing time span):
{isMine && !message.isDeleted && (
  <span className="flex items-center">
    {message.status === 'READ' ? (
      <CheckCheck className="w-3.5 h-3.5 text-primary" />
    ) : message.status === 'DELIVERED' ? (
      <CheckCheck className="w-3.5 h-3.5 text-foreground/40" />
    ) : (
      <Check className="w-3.5 h-3.5 text-foreground/40" />
    )}
  </span>
)}
```

Place this inside the existing `<div className="flex items-center gap-1.5 mt-0.5 px-1">` alongside the time and edited badge.

| Status | Icon | Colour class |
|--------|------|-------------|
| SENT | `<Check>` (single) | `text-foreground/40` (grey) |
| DELIVERED | `<CheckCheck>` (double) | `text-foreground/40` (grey) |
| READ | `<CheckCheck>` (double) | `text-primary` (blue) |

### 3.6 Files to Create / Modify in This Phase

```
apps/frontend/src/features/friends/hooks/usePresence.ts         — modified (message.delivered listener, message.read listener, auto-read on message.new)
apps/frontend/src/features/chat/components/MessageBubble.tsx    — modified (add status indicator checkmarks for isMine messages)
```

### 3.7 Test Cases

**`MessageBubble` component:**
- [ ] Renders `<Check>` (single, grey) when `isMine && status === 'SENT'`
- [ ] Renders `<CheckCheck>` (double, grey) when `isMine && status === 'DELIVERED'`
- [ ] Renders `<CheckCheck>` (double, blue/primary) when `isMine && status === 'READ'`
- [ ] Renders NO status indicator when `!isMine`
- [ ] Renders NO status indicator when `message.isDeleted === true`

**`usePresence` socket handlers:**
- [ ] `message.delivered`: updates SENT messages from `senderId` to DELIVERED in messages cache
- [ ] `message.delivered`: does NOT update DELIVERED or READ messages (status already advanced)
- [ ] `message.read`: updates SENT and DELIVERED messages from `senderId` to READ in messages cache
- [ ] `message.new` for active conversation: calls `chatService.markRead(conversationId)`
- [ ] `message.new` for inactive conversation: does NOT call `chatService.markRead`

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Architecture Decisions

| # | Decision | Options Considered | Choice | Rationale |
|---|----------|--------------------|--------|-----------|
| 1 | When to trigger DELIVERED | (a) On message fetch, (b) On socket connection, (c) Separate ACK endpoint | On `GET /messages` fetch | No new endpoint or socket event needed; already covers the "recipient has opened the conversation" case; idempotent by design |
| 2 | Bulk update sync vs async | (a) Await before responding, (b) Concurrent with fetch, (c) Fire-and-forget after response | Fire-and-forget, in-memory status reflected immediately | Keeps API latency minimal; response carries correct status via in-memory update; DB update is best-effort and idempotent on retry |
| 3 | Include `senderId` in `MessageReadEventV1` | (a) Add field to event, (b) ChatGateway does a DB lookup | Add field to event | ChatGateway must remain stateless and fast; a DB lookup per event would add unnecessary latency and coupling |
| 4 | New Kafka topic vs piggyback on existing | N/A | New `message.delivered.v1` topic | Semantically distinct from `message.sent.v1`; separate topic allows independent subscription and filtering |
| 5 | Auto-read on `message.new` | (a) Frontend triggers markRead for active conversation, (b) Backend tracks socket room membership | Frontend triggers markRead | Simplest; no backend state needed; follows same path as manual mark-read |
| 6 | Compound index `{ conversationId, senderId, status }` | (a) Add index, (b) Rely on existing `{ conversationId, createdAt }` index | Add compound index | `updateStatusBySender` filters on all three fields; without the index, MongoDB falls back to a collection scan per delivery event |

---

## 5. Open Questions

None — all decisions are resolved in Section 4.

---

> After Phase 1 is complete, run `pnpm generate:types` to regenerate shared types from the updated OpenAPI spec.
