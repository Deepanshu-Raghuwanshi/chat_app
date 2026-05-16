# Typing Indicator — Feature Spec

## 1. Summary

When a user is composing a message, the other participant in the conversation sees a "typing…" indicator replace the online/offline status text in the conversation header. The indicator appears within ~100 ms of the first keystroke and disappears 3 seconds after the last keystroke (or immediately when the message is sent). This is a pure real-time feature: no HTTP endpoints, no Kafka events, no database writes. All state flows through the existing Socket.IO `PresenceGateway` and is stored ephemerally in the Zustand `useChatStore`.

---

## 2. Current State

Verified by reading the following files:

### Backend — `chat-service`

- `apps/chat-service/src/interfaces/gateways/presence.gateway.ts` — Socket.IO gateway at `/presence` namespace. Already handles:
  - `connection` / `disconnect` → sets Redis presence status, emits `presence.updated`
  - `join.conversation` → joins socket to `conversation:{conversationId}` room
  - `emitToRoom(room, event, payload)` — used by `ChatGateway` to push Kafka events to rooms
- `apps/chat-service/src/infrastructure/cache/redis-presence.repository.ts` — Reads/writes `presence:{userId}` keys in Redis. No typing-related keys exist.
- `apps/chat-service/src/infrastructure/messaging/chat.gateway.ts` — Kafka consumer that calls `presenceGateway.emitToRoom()` for all message/friend events. Not relevant to typing.
- `apps/chat-service/src/chat.module.ts` — `PresenceGateway` is already registered as a provider.

**No typing event handlers exist in `PresenceGateway` today.**

### Frontend

- `apps/frontend/src/features/friends/hooks/usePresence.ts` — Singleton Socket.IO client (`/presence` namespace). Already handles: `presence.updated`, `friendship.removed`, `friend.request.received`, `message.new`, `message.delivered`, `message.read`, `message.updated`, `message.deleted`, `message.reaction`. Exports `joinConversationRoom(conversationId)`. **No typing event handlers exist.**
- `apps/frontend/src/features/chat/store/useChatStore.ts` — Zustand store with: `activeConversationId`, `draftMessages`, `replyTargets`, `highlightedMessageId`. **No `typingUsers` state exists.**
- `apps/frontend/src/features/chat/components/MessageComposer.tsx` — Handles text input, draft state, emoji picker, send-on-Enter. `handleChange` calls `setDraft(conversationId, value)`. **Does not emit any typing events.**
- `apps/frontend/src/features/chat/components/ConversationHeader.tsx` — Shows avatar + `displayName`. Status sub-text: `"Online"` (green) or `"Offline"` (muted). **Does not show typing indicator.**
- `apps/frontend/src/features/chat/components/ConversationView.tsx` — Mounts `usePresence()`, calls `joinConversationRoom(conversationId)` on load, renders `ConversationHeader` + `MessageList` + `MessageComposer`.

### Libraries

- `libs/kafka-events/src/v1/chat-events.ts` — Defines `ChatTopics`, message event interfaces. **No typing events defined (and none are needed — typing is not a Kafka concern).**
- `libs/openapi-specs/src/v1/chat.yaml` — Updated (as part of this spec) with WebSocket event documentation block.

### What does NOT exist yet

- `typing.start` / `typing.stop` socket event handlers in `PresenceGateway`
- `typing.started` / `typing.stopped` socket event listeners in `usePresence`
- `typingUsers` state in `useChatStore`
- Typing event emission in `MessageComposer`
- "typing…" display in `ConversationHeader`

---

## 3. Desired State

### User-facing behaviour

1. User A opens a conversation with User B and joins the conversation room (this already happens via `joinConversationRoom` in `ConversationView`).
2. User A starts typing in the `MessageComposer`. On the first non-empty keystroke, the frontend emits `typing.start` via the socket.
3. Within ~100 ms, User B's `ConversationHeader` shows `"typing…"` in animated dots style, replacing `"Online"` / `"Offline"`.
4. If User A keeps typing, a 3-second idle timer resets with each keystroke. Only one `typing.start` emission per burst — no per-keystroke events.
5. When the 3-second idle timer fires (User A paused), the frontend emits `typing.stop`. User B's indicator disappears.
6. When User A sends the message, `typing.stop` is emitted immediately (before or alongside the send mutation).
7. When User A clears the input entirely (empty draft), `typing.stop` is emitted immediately.
8. If User A disconnects, the conversation room broadcast ends naturally — no stale indicator.

### Data flow

```
[User A types in MessageComposer]
  → debounce: emit typing.start { conversationId } via socket
  → PresenceGateway.handleTypingStart()
  → client.to(`conversation:{conversationId}`).emit('typing.started', { conversationId, userId: userA })
  → User B's socket receives 'typing.started'
  → usePresence handler: useChatStore.setTyping(conversationId, userA.id, true)
  → ConversationHeader reads typingUsers[conversationId]
  → renders "typing…" indicator

[3 s idle / send / empty draft]
  → emit typing.stop { conversationId } via socket
  → PresenceGateway.handleTypingStop()
  → client.to(`conversation:{conversationId}`).emit('typing.stopped', { conversationId, userId: userA })
  → usePresence handler: useChatStore.setTyping(conversationId, userA.id, false)
  → ConversationHeader renders normal Online/Offline status
```

### Business rules and constraints

- **Participant-only**: The socket emitter must already be in `conversation:{conversationId}` room (guaranteed by `joinConversationRoom` called in `ConversationView`). The handler performs no extra DB check — room membership is the implicit authorization.
- **Self-exclusion**: `client.to(room).emit()` (not `server.to(room).emit()`) is used so the sender never receives their own typing event.
- **No persistence**: Typing state is never written to MongoDB or Redis. It is lost on socket reconnect. This is intentional — a stale "typing…" indicator from a previous session is worse than no indicator.
- **Debounce window**: 3 000 ms. After the last keystroke, the stop timer fires and `typing.stop` is emitted.
- **Burst suppression**: Only one `typing.start` is emitted per typing burst. While the stop timer is pending, additional keystrokes reset the timer but do NOT re-emit `typing.start`.
- **Immediate stop conditions**: `typing.stop` is emitted immediately (cancelling the timer) when: draft becomes empty, message is sent, composer unmounts.
- **No-op guard**: If `typing.start` is emitted but no `typing.stop` comes (e.g., app crash), the indicator will stay until User B navigates away (component unmounts → `setTyping` clears all state for the conversation).

---

## Phase 1 — Contracts & Schema

**Goal**: Define all contracts before any implementation. Nothing is implemented in this phase.

### 1.1 OpenAPI Changes

Editing `libs/openapi-specs/src/v1/chat.yaml` — the typing indicator is a chat-service concern, and the existing chat.yaml already documents the `/presence` WebSocket namespace indirectly via the Kafka events block. A new WebSocket event comment block is appended. No new HTTP endpoints are added because typing indicators are entirely WebSocket-driven.

No new endpoints — **no endpoint table**.

### 1.2 Database Schema Changes

**None.** Typing state is transient and must not be persisted. Redis is not used either — the simple 3-second client-side timer provides the same auto-expiry behaviour with zero infrastructure overhead.

### 1.3 Kafka Event Contracts

**None.** Typing events are direct socket emissions, not Kafka messages. Kafka is appropriate for durable cross-service events; typing indicators are neither durable nor cross-service.

### 1.4 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/chat.yaml   — modified (WebSocket event comment block added)
```

No type generation needed — no new shared types are required (`typing.started` / `typing.stopped` payloads are inline interfaces in `usePresence.ts`).

---

## Phase 2 — Backend Implementation

**Goal**: Add two `@SubscribeMessage` handlers to the existing `PresenceGateway`. No new files, no new use cases, no new repositories.

### 2.1 Domain Layer

No new domain entities. Typing state is not a domain concept — it has no business invariants and requires no persistence. The existing `PresenceGateway` (an infrastructure/interfaces concern) handles it directly.

### 2.2 Application Layer

No new use cases, DTOs, or repository ports. Typing event handling is a thin relay (receive → broadcast). Introducing a use case layer for a one-liner broadcast would violate the principle of not designing for hypothetical complexity.

### 2.3 Infrastructure Layer

No new repository implementations, Kafka producers, or consumers.

### 2.4 Interfaces Layer — `PresenceGateway` changes

**File**: `apps/chat-service/src/interfaces/gateways/presence.gateway.ts` — **modified**

Add two handlers after the existing `handleJoinConversation` method:

```typescript
@SubscribeMessage('typing.start')
handleTypingStart(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string },
): void {
  const userId = this.getUserId(client);
  if (!userId || !data?.conversationId) return;
  client.to(`conversation:${data.conversationId}`).emit('typing.started', {
    conversationId: data.conversationId,
    userId,
  });
}

@SubscribeMessage('typing.stop')
handleTypingStop(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string },
): void {
  const userId = this.getUserId(client);
  if (!userId || !data?.conversationId) return;
  client.to(`conversation:${data.conversationId}`).emit('typing.stopped', {
    conversationId: data.conversationId,
    userId,
  });
}
```

**Why `client.to()` not `this.server.to()`**: `client.to(room)` excludes the sending socket from the broadcast. The typer should never receive their own typing indicator. `this.server.to(room)` would include them.

**Why no guard check on room membership**: The client must have called `join.conversation` to be in `conversation:{conversationId}`. If they haven't, `client.to(room)` emits to an empty set — a no-op. Adding an explicit membership check would require a Redis lookup on every keystroke, which is unacceptable at this frequency.

### 2.5 Module Registration

No changes needed. `PresenceGateway` is already a provider in `ChatModule`.

### 2.6 Files to Create / Modify in This Phase

```
apps/chat-service/src/interfaces/gateways/presence.gateway.ts   — modified (add 2 handlers)
```

### 2.7 Test Cases

**Unit — PresenceGateway** (`apps/chat-service/tests/unit/`):

- [ ] `handleTypingStart`: calls `client.to('conversation:{id}').emit('typing.started', { conversationId, userId })` with correct payload
- [ ] `handleTypingStart`: returns early (no emit) when `getUserId` returns null
- [ ] `handleTypingStart`: returns early (no emit) when `data.conversationId` is missing or falsy
- [ ] `handleTypingStop`: calls `client.to('conversation:{id}').emit('typing.stopped', { conversationId, userId })` with correct payload
- [ ] `handleTypingStop`: returns early when `getUserId` returns null
- [ ] Does NOT call `this.server.to()` — sender is excluded via `client.to()`

```bash
pnpm nx typecheck chat-service
pnpm nx lint chat-service
pnpm nx test chat-service
```

---

## Phase 3 — Frontend Implementation

**Goal**: Emit typing events from `MessageComposer`, handle them in `usePresence`, store in `useChatStore`, display in `ConversationHeader`.

### 3.1 Routes / Pages

No new routes or pages. Changes are in components within the existing `/chat/[conversationId]` route.

### 3.2 API Service

No changes. Typing is entirely WebSocket — `chat.service.ts` is not involved.

### 3.3 Hooks

**File**: `apps/frontend/src/features/friends/hooks/usePresence.ts` — **modified**

Add two payload interfaces and two exported functions (for use in `MessageComposer`):

```typescript
interface TypingStartedPayload {
  conversationId: string;
  userId: string;
}

interface TypingStoppedPayload {
  conversationId: string;
  userId: string;
}

export const emitTypingStart = (conversationId: string) => {
  socket?.emit("typing.start", { conversationId });
};

export const emitTypingStop = (conversationId: string) => {
  socket?.emit("typing.stop", { conversationId });
};
```

Inside `useEffect`, after the existing `socket.on('message.reaction', ...)` block, add:

```typescript
socket.on("typing.started", (data: TypingStartedPayload) => {
  useChatStore.getState().setTyping(data.conversationId, data.userId, true);
});

socket.on("typing.stopped", (data: TypingStoppedPayload) => {
  useChatStore.getState().setTyping(data.conversationId, data.userId, false);
});
```

**Why `useChatStore.getState()` not the hook**: This runs inside a socket event callback (not a React render), so the hook cannot be called. This is identical to the existing `useChatStore.getState()` pattern already used in the `message.new` handler.

### 3.4 Zustand Store Changes

**File**: `apps/frontend/src/features/chat/store/useChatStore.ts` — **modified**

Add `typingUsers` to `ChatState` and a `setTyping` action:

```typescript
interface ChatState {
  // ...existing fields...
  typingUsers: Record<string, string[]>; // conversationId → array of typing userIds
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
}

// In create():
typingUsers: {},
setTyping: (conversationId, userId, isTyping) =>
  set((state) => {
    const current = state.typingUsers[conversationId] ?? [];
    const updated = isTyping
      ? current.includes(userId) ? current : [...current, userId]
      : current.filter((id) => id !== userId);
    return {
      typingUsers: { ...state.typingUsers, [conversationId]: updated },
    };
  }),
```

**Why `string[]` not `Set<string>`**: Zustand's `set` creates a shallow-merged object. `Set` is a reference type and Zustand's equality check would not detect inner mutations. An `Array` with explicit filter/spread is deterministic and produces a new reference on every change, ensuring React re-renders.

| Field         | Type                       | Default | Purpose                                                 |
| ------------- | -------------------------- | ------- | ------------------------------------------------------- |
| `typingUsers` | `Record<string, string[]>` | `{}`    | Maps conversationId to list of currently-typing userIds |

### 3.5 Components

**`MessageComposer`** — `apps/frontend/src/features/chat/components/MessageComposer.tsx` — **modified**

Import `emitTypingStart` and `emitTypingStop` from `usePresence`. Add a `useRef<ReturnType<typeof setTimeout> | null>` for the stop timer. Call `emitTypingStart` on non-empty input change (only on first keystroke of a burst) and reset the 3-second stop timer. Emit `typing.stop` when the timer fires, draft empties, or message sends.

```typescript
const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const isTypingRef = useRef(false); // true while stop timer is pending

const stopTyping = () => {
  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  typingTimerRef.current = null;
  if (isTypingRef.current) {
    emitTypingStop(conversationId);
    isTypingRef.current = false;
  }
};

// In handleChange, after setDraft:
if (e.target.value.trim()) {
  if (!isTypingRef.current) {
    emitTypingStart(conversationId);
    isTypingRef.current = true;
  }
  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  typingTimerRef.current = setTimeout(stopTyping, 3000);
} else {
  stopTyping(); // draft became empty
}

// In handleSend, before sendMessage call:
stopTyping();

// Cleanup on unmount:
useEffect(() => () => stopTyping(), [conversationId]);
```

**Why `useRef` not `useState` for the timer**: The timer ID must not cause re-renders when updated. `useRef` is the correct React pattern for mutable values that don't affect the rendered output.

**Why suppress re-emit during a burst**: Without `isTypingRef`, every keystroke would emit `typing.start`. This is unnecessary — one event per burst is sufficient and reduces socket traffic.

---

**`ConversationHeader`** — `apps/frontend/src/features/chat/components/ConversationHeader.tsx` — **modified**

Read `typingUsers` from the store. If the other participant's userId is in `typingUsers[conversationId]`, show `"typing…"` with an animated dots class instead of the Online/Offline status text.

The `conversationId` is not currently a prop on `ConversationHeader`. Pass it down from `ConversationView` where `conversationId` is already available.

```typescript
interface ConversationHeaderProps {
  conversation: Conversation;
  conversationId: string; // add this
}
```

In the status sub-text:

```tsx
const typingUsers = useChatStore((s) => s.typingUsers[conversationId] ?? []);
const otherIsTyping = other ? typingUsers.includes(other.userId) : false;

// Replace the existing status <p>:
<p
  className={cn(
    "text-xs",
    otherIsTyping
      ? "text-primary"
      : other?.isOnline
        ? "text-green-500"
        : "text-foreground/40",
  )}
>
  {otherIsTyping ? t("typing") : other?.isOnline ? t("online") : t("offline")}
</p>;
```

A CSS animation for the dots (e.g., a pulsing `…` via `animate-pulse`) can be added via Tailwind's `animate-pulse` on the text or a separate 3-dot component.

Update `ConversationView` to pass `conversationId` to `ConversationHeader`:

```tsx
<ConversationHeader
  conversation={conversation}
  conversationId={conversationId}
/>
```

| Component            | New or Modified | Key Change                                         |
| -------------------- | --------------- | -------------------------------------------------- |
| `ConversationHeader` | modified        | Add `conversationId` prop; show "typing…" sub-text |
| `ConversationView`   | modified        | Pass `conversationId` prop to `ConversationHeader` |
| `MessageComposer`    | modified        | Emit `typing.start`/`typing.stop` on draft changes |

### 3.6 i18n Keys

Add to the relevant translation files under `features.chat.conversation`:

```json
"typing": "typing…"
```

### 3.7 Files to Create / Modify in This Phase

```
apps/frontend/src/features/chat/store/useChatStore.ts                  — modified (add typingUsers + setTyping)
apps/frontend/src/features/friends/hooks/usePresence.ts                — modified (add emitTypingStart, emitTypingStop, socket handlers)
apps/frontend/src/features/chat/components/MessageComposer.tsx         — modified (emit typing events)
apps/frontend/src/features/chat/components/ConversationHeader.tsx      — modified (show typing indicator)
apps/frontend/src/features/chat/components/ConversationView.tsx        — modified (pass conversationId prop to header)
apps/frontend/src/i18n/messages/*.json                                 — modified (add "typing" key)
```

### 3.8 Test Cases

**Hook tests** (`apps/frontend/tests/`):

- [ ] `emitTypingStart`: calls `socket.emit('typing.start', { conversationId })` when socket is initialised
- [ ] `emitTypingStart`: is a no-op (no throw) when socket is null (before `usePresence` mount)
- [ ] `typing.started` event: calls `useChatStore.setTyping(conversationId, userId, true)`
- [ ] `typing.stopped` event: calls `useChatStore.setTyping(conversationId, userId, false)`

**Store tests**:

- [ ] `setTyping(cid, uid, true)`: adds `uid` to `typingUsers[cid]`
- [ ] `setTyping(cid, uid, true)` called twice: array still has one entry for `uid` (no duplicates)
- [ ] `setTyping(cid, uid, false)`: removes `uid` from `typingUsers[cid]`
- [ ] `setTyping(cid, uid, false)` when uid not present: array unchanged (no error)

**Component tests** (`MessageComposer`):

- [ ] First keystroke: emits `typing.start` once
- [ ] Three keystrokes in quick succession: `typing.start` emitted exactly once (burst suppressed)
- [ ] Draft cleared: `typing.stop` emitted immediately, before 3-second timer
- [ ] Send button clicked: `typing.stop` emitted before mutation fires
- [ ] 3 000 ms idle: `typing.stop` emitted (timer fires)

**Component tests** (`ConversationHeader`):

- [ ] When `typingUsers[conversationId]` contains the other participant's userId: renders "typing…" text
- [ ] When `typingUsers[conversationId]` is empty and `isOnline` is true: renders "Online" text
- [ ] When `typingUsers[conversationId]` is empty and `isOnline` is false: renders "Offline" text

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Architecture Decisions

| #   | Decision                                | Options Considered                                          | Choice                         | Rationale                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------- | ----------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Transport for typing events             | HTTP REST, Kafka, WebSocket                                 | WebSocket only                 | Typing is ephemeral and high-frequency. REST adds ~50 ms round-trip per event. Kafka persists events to disk — wrong for transient state. WebSocket is already open; it's the correct channel for sub-100 ms, fire-and-forget events.                                                                 |
| 2   | Redis TTL for typing state              | Store `typing:{cid}:{uid}` with 5 s TTL                     | None                           | The 3 s client-side debounce provides the same auto-expiry. Redis would require a pub/sub layer (beyond the current simple key/value usage) to push state to late-joining sockets. Complexity is not justified — a user who joins a conversation doesn't need to see that someone was typing 4 s ago. |
| 3   | Where to display the indicator          | Header sub-text vs. floating bubble above composer          | Header sub-text                | `ConversationHeader` already has a status sub-text slot (`"Online"` / `"Offline"`). WhatsApp, Telegram, and iMessage all use this slot. Adding a floating bubble would require layout changes and new components.                                                                                     |
| 4   | Burst suppression on frontend           | Emit `typing.start` per keystroke vs. once per burst        | Once per burst (`isTypingRef`) | Emitting per-keystroke is a 10–30× amplification of socket traffic with zero UX benefit. `isTypingRef` tracks whether the stop timer is pending; if it is, we already told the other side the user is typing.                                                                                         |
| 5   | Who owns typing state                   | TanStack Query vs. Zustand                                  | Zustand (`useChatStore`)       | Typing state is pure client-side UI state. It is not fetched from a server, has no loading/error states, and requires no cache invalidation. TanStack Query is the wrong tool. Zustand is already used for analogous ephemeral state (`draftMessages`, `replyTargets`).                               |
| 6   | `typingUsers` shape                     | `Record<string, Set<string>>` vs `Record<string, string[]>` | `string[]`                     | `Set` is a reference type. Zustand compares old/new state by reference. Mutating a Set's contents does not produce a new reference, so React would not re-render. `Array` with explicit filter/spread always produces a new reference, ensuring correct reactivity.                                   |
| 7   | New `SubscribeMessage` handler location | New gateway file vs. extend `PresenceGateway`               | Extend `PresenceGateway`       | Typing notifications are a presence-layer concern (who is active in a conversation). `PresenceGateway` already owns the `/presence` namespace, room management, and `getUserId` resolution. A separate gateway would need its own JWT auth and namespace — unnecessary overhead.                      |

---

## 5. Open Questions

None — all decisions are resolved in Section 4.
