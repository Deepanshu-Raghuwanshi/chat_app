# Quoted Reply Feature Spec

## 1. Summary

The quoted-reply feature lets a user reply to a specific message in a conversation, embedding a preview of the original message above their new message — identical to the UX in WhatsApp and Telegram. The backend stores an immutable snapshot of the quoted content at send time so the preview is always available even if the original message is later deleted. This feature extends the existing send-message flow with a single optional field; it requires no new endpoints, no new Kafka topics, and no schema migration.

---

## 2. Current State

Verified by reading the actual source files listed below.

### Backend — `apps/chat-service`

| File                                                                     | Relevant current state                                                                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/infrastructure/persistence/mongoose/schemas/message.schema.ts`      | `Message` schema has `conversationId`, `senderId`, `content`, `type`, `status`, `isDeleted`, `isEdited`, `reactions[]`. **No `replyTo` field.** |
| `src/domain/entities/message.entity.ts`                                  | `MessageProps` and `MessageEntity` match the schema exactly. **No `replyTo`.**                                                                  |
| `src/application/interfaces/conversation-view.interface.ts`              | `MessageView` interface has same fields. **No `replyTo`.**                                                                                      |
| `src/application/ports/message.repository.ts`                            | `CreateMessageInput` has `conversationId`, `senderId`, `content`, `type`. **No `replyTo`.**                                                     |
| `src/application/use-cases/send-message.use-case.ts`                     | `SendMessageDto` has `userId`, `conversationId`, `content`, `type`. **No `quotedMessageId`.**                                                   |
| `src/application/dto/message.dto.ts`                                     | Controller-level `SendMessageDto` has `content` and optional `type`. **No `quotedMessageId`.**                                                  |
| `src/application/mappers/message.mapper.ts`                              | `toMessageView` maps all current fields. **No `replyTo` mapping.**                                                                              |
| `src/infrastructure/persistence/mongoose/mongoose-message.repository.ts` | `create()` passes `conversationId`, `senderId`, `content`, `type` to Mongoose. **No `replyTo`.**                                                |
| `src/interfaces/controllers/conversation.controller.ts`                  | `send()` handler passes `content` and `type` to use case. **No `quotedMessageId`.**                                                             |

### Shared libraries

| File                                      | Relevant current state                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `libs/openapi-specs/src/v1/chat.yaml`     | `Message` schema and `SendMessageDto` have no `replyTo` / `quotedMessageId`. **Updated by this spec's Phase 1.** |
| `libs/kafka-events/src/v1/chat-events.ts` | `MessageSentEventV1` has no `replyTo`. `ChatTopics` enum is complete — no new topics needed.                     |
| `libs/shared-types/src/index.ts`          | Exports `Message`, `SendMessageDto` etc. **No `QuotedMessage` type.**                                            |

### Frontend — `apps/frontend`

| File                                               | Relevant current state                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/features/chat/services/chat.service.ts`       | `sendMessage(conversationId, content)` posts `{ content, type }`. **No `quotedMessageId`.**             |
| `src/features/chat/hooks/useChat.ts`               | `useSendMessage` mutation takes `content: string`. Optimistic update builds message without `replyTo`.  |
| `src/features/chat/store/useChatStore.ts`          | State has `activeConversationId` and `draftMessages`. **No reply target state.**                        |
| `src/features/chat/components/MessageBubble.tsx`   | Renders content, reactions, status indicator, edit/delete menu. **No quoted preview, no Reply button.** |
| `src/features/chat/components/MessageComposer.tsx` | Shows textarea + emoji picker + send button. **No reply strip UI.**                                     |

### What does NOT exist yet

- `replyTo` field anywhere in the message data path (DB, entity, view, OpenAPI)
- `quotedMessageId` in any send DTO
- `QuotedMessage` type in shared-types
- Reply state in the Zustand store
- Reply button in `MessageBubble`
- Reply strip preview in `MessageComposer`
- Quoted-reply preview block rendered inside `MessageBubble`

---

## 3. Desired State

### User-facing behaviour

1. User hovers over any non-deleted message bubble → a **Reply** button (↩ icon) appears alongside the existing Smile/MoreVertical controls.
2. User clicks Reply → a **reply strip** appears above the composer textarea showing: the quoted sender's name and the first ~80 chars of their message content.
3. User types their reply and presses Send or Enter → the new message is persisted with an embedded `replyTo` snapshot.
4. The new message is rendered with a **quoted bubble** above the main content showing the original sender's name and the (possibly truncated) snapshot content.
5. User can click **✕** on the reply strip to cancel and return the composer to normal mode.
6. If the original message was later deleted, the quoted bubble still renders the snapshot (the snapshot is immutable).

### Data flow

**Send a reply:**

```
Client (POST /api/v1/chat/conversations/{id}/messages + { content, quotedMessageId })
→ API Gateway (proxy, no change)
→ chat-service ConversationController.send()
→ SendMessageUseCase.execute({ ..., quotedMessageId })
  1. Validate content non-empty
  2. Fetch conversation → 404 if missing
  3. Verify caller is participant → 403 if not
  4. Verify friendship still active → 403 if not
  5. If quotedMessageId: fetch quoted message → 404 if missing or wrong conversation
                                              → 400 if isDeleted
     Build snapshot: { messageId, senderId, content: content.slice(0, 200) }
  6. MessageRepository.create({ ..., replyTo: snapshot | undefined })
  7. ConversationRepository.updateLastMessage(...)
  8. KafkaProducer.emit(MESSAGE_SENT, { ..., replyTo: snapshot | undefined })
← Returns full Message (with replyTo populated)
→ Kafka → ChatGateway fanOut → PresenceGateway.emitToRoom("user:{receiverId}", "message.new", event)
→ Frontend WS handler → invalidates ["messages", conversationId] TQ cache
→ Both participants' MessageList re-renders with new message including quoted bubble
```

**Render a quoted reply (read path):**
No additional endpoint. `replyTo` is embedded in every `Message` document; the existing `GET .../messages` endpoint returns it as part of the normal message payload.

### Business rules and constraints

- `quotedMessageId` is optional. Omitting it creates a normal message.
- The quoted message **must** belong to the same `conversationId`. Violation → `NotFoundException("Quoted message not found")`. (This prevents cross-conversation quote-injection.)
- The quoted message **must not** be deleted (`isDeleted: true`). Violation → `BadRequestException("Cannot reply to a deleted message")`.
- `replyTo.content` is a snapshot truncated to 200 chars at write time and is **never updated** — not by subsequent edits of the original, not by deletion.
- Any non-deleted message in the conversation can be quoted, regardless of sender.
- Quoting a reply is allowed (no nesting limit; depth is a UI concern).
- A reply can itself be edited and deleted; the `replyTo` snapshot is unaffected.

---

## Phase 1 — Contracts & Schema

**Goal:** Define all contracts and database changes before any implementation begins.

### 1.1 OpenAPI Changes

Editing existing `libs/openapi-specs/src/v1/chat.yaml`. The feature belongs entirely to the chat service; no new yaml file is needed.

| Method | Path                                                   | Auth | Change                                             |
| ------ | ------------------------------------------------------ | ---- | -------------------------------------------------- |
| POST   | `/api/v1/chat/conversations/{conversationId}/messages` | JWT  | Add optional `quotedMessageId` to `SendMessageDto` |

New schemas added to `components/schemas`:

- `QuotedMessage` — embedded snapshot stored on `Message.replyTo`

Existing schemas modified:

- `Message` — add optional `replyTo: $ref QuotedMessage`
- `SendMessageDto` — add optional `quotedMessageId: string (uuid)`

### 1.2 Database Schema Changes

**MongoDB — `apps/chat-service` (Mongoose):**

```typescript
// New subdocument — add above MessageSchema in message.schema.ts
@Schema({ _id: false })
export class ReplyToDocument {
  @Prop({ required: true })
  messageId!: string; // _id.toString() of the quoted Message document

  @Prop({ required: true })
  senderId!: string;

  @Prop({ required: true, maxlength: 200 })
  content!: string; // snapshot; immutable after creation
}

const ReplyToDocumentSchema = SchemaFactory.createForClass(ReplyToDocument);
```

**Changes to the existing `Message` schema:**

```typescript
// Add this field to the existing Message class:
@Prop({ type: ReplyToDocumentSchema, default: null })
replyTo?: ReplyToDocument | null;
```

**Why this schema design:**

- **Embedded subdocument over foreign key**: Every call to `GET .../messages` returns all messages in one query. Storing only a `quotedMessageId` reference would require a second lookup per replied message to populate the preview content. An embedded snapshot adds ~300 bytes per reply document but eliminates that lookup entirely — the correct MongoDB tradeoff for read-heavy data.
- **No new index**: `replyTo.messageId` is used by the frontend only for "scroll to original" — a local TQ cache lookup, not a server query. There is no server-side query pattern of the form "find all messages that reply to X", so an index would add write overhead with no query benefit.
- **No migration needed**: MongoDB is schemaless; existing `Message` documents simply have no `replyTo` field, which Mongoose resolves as `null`. No migration step is required.

### 1.3 Kafka Event Contracts

| Direction | Topic             | Change                    | Payload addition                                          |
| --------- | ----------------- | ------------------------- | --------------------------------------------------------- |
| Produces  | `message.sent.v1` | Existing — extend payload | Add optional `replyTo?: { messageId, senderId, content }` |

No new topics. The `message.new` WebSocket event that the `ChatGateway` fans out to both participants already carries the full `MessageSentEventV1` payload. Consumers that do not care about `replyTo` safely ignore the new optional field.

### 1.4 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/chat.yaml                                             — modified ✓ (done above)
libs/kafka-events/src/v1/chat-events.ts                                         — modified (add replyTo? to MessageSentEventV1)
apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts — modified (add ReplyToDocument + replyTo field)
```

Commands to run after this phase:

```bash
pnpm generate:types   # Regenerate shared-types from updated chat.yaml
```

---

## Phase 2 — Backend Implementation

**Goal:** Implement backend logic in strict DDD layer order. No new infrastructure — extend what exists.

### 2.1 Domain Layer (`src/domain/`)

No new entities. `MessageEntity` is extended to carry the optional reply snapshot.

**Changes to `apps/chat-service/src/domain/entities/message.entity.ts`:**

Add `ReplyToProps` interface and `replyTo` to `MessageProps`:

```typescript
export interface ReplyToProps {
  messageId: string;
  senderId: string;
  content: string;
}

export interface MessageProps {
  // ...existing fields unchanged...
  replyTo?: ReplyToProps; // add
}
```

Add getter to `MessageEntity`:

```typescript
get replyTo(): ReplyToProps | undefined {
  return this.props.replyTo;
}
```

### 2.2 Application Layer (`src/application/`)

**Repository port** — extend `CreateMessageInput` in `apps/chat-service/src/application/ports/message.repository.ts`:

```typescript
export interface ReplyToInput {
  messageId: string;
  senderId: string;
  content: string;
}

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  replyTo?: ReplyToInput; // add
}
```

**Interface** — extend `MessageView` in `apps/chat-service/src/application/interfaces/conversation-view.interface.ts`:

```typescript
export interface ReplyToView {
  messageId: string;
  senderId: string;
  content: string;
}

export interface MessageView {
  // ...existing fields...
  replyTo?: ReplyToView; // add
}
```

**Use cases:**

| Use Case                        | HTTP Trigger   | Business Rules Added                                                                         | Events                       |
| ------------------------------- | -------------- | -------------------------------------------------------------------------------------------- | ---------------------------- |
| `SendMessageUseCase` (modified) | POST /messages | Validate quoted message exists, belongs to same conversation, is not deleted; build snapshot | `message.sent.v1` (extended) |

Exact execution sequence for `SendMessageUseCase.execute()` with `quotedMessageId`:

1. Validate `content` non-empty (existing)
2. Fetch conversation by `conversationId` → `NotFoundException` if missing (existing)
3. Verify caller is a participant → `ForbiddenException` if not (existing)
4. Resolve `receiverId` from conversation (existing)
5. Verify friendship → `ForbiddenException` if not (existing)
6. **NEW** — if `quotedMessageId` is present:
   - `const quoted = await this.messageRepository.findById(quotedMessageId)`
   - if `!quoted || quoted.conversationId !== conversationId` → `NotFoundException("Quoted message not found")`
   - if `quoted.isDeleted` → `BadRequestException("Cannot reply to a deleted message")`
   - build `replyTo: { messageId: quoted.id, senderId: quoted.senderId, content: quoted.content.slice(0, 200) }`
7. `MessageRepository.create({ conversationId, senderId, content, type, replyTo })` (extended)
8. `ConversationRepository.updateLastMessage(...)` (existing)
9. `KafkaProducer.emit(MESSAGE_SENT, { ..., replyTo })` (extended)
10. Return `toMessageView(message)`

**DTO** — extend `SendMessageDto` in `apps/chat-service/src/application/use-cases/send-message.use-case.ts`:

```typescript
export interface SendMessageDto {
  userId: string;
  conversationId: string;
  content: string;
  type?: string;
  quotedMessageId?: string; // add
}
```

### 2.3 Infrastructure Layer (`src/infrastructure/`)

**Repository implementation** — extend `MongooseMessageRepository.create()` in `apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-message.repository.ts`:

```typescript
async create(data: CreateMessageInput): Promise<MessageEntity> {
  const doc = await this.model.create({
    conversationId: data.conversationId,
    senderId: data.senderId,
    content: data.content,
    type: data.type,
    ...(data.replyTo ? { replyTo: data.replyTo } : {}),
  });
  return this.toEntity(doc);
}
```

Extend `toEntity()` to map `replyTo`:

```typescript
private toEntity(doc: Message): MessageEntity {
  return MessageEntity.create({
    // ...existing fields...
    replyTo: doc.replyTo
      ? { messageId: doc.replyTo.messageId, senderId: doc.replyTo.senderId, content: doc.replyTo.content }
      : undefined,
  });
}
```

**Mapper** — extend `toMessageView` in `apps/chat-service/src/application/mappers/message.mapper.ts`:

```typescript
export function toMessageView(message: MessageEntity): MessageView {
  return {
    // ...existing fields...
    replyTo: message.replyTo
      ? {
          messageId: message.replyTo.messageId,
          senderId: message.replyTo.senderId,
          content: message.replyTo.content,
        }
      : undefined,
  };
}
```

**Kafka producer** — extend the `MESSAGE_SENT` emission in `SendMessageUseCase`:

```typescript
await this.kafkaProducer.emit(ChatTopics.MESSAGE_SENT, {
  messageId: message.id,
  conversationId,
  senderId: userId,
  receiverId,
  content: content.trim(),
  type: (dto.type ?? MessageType.TEXT) as MessageType,
  sentAt: message.createdAt.toISOString(),
  ...(replyTo ? { replyTo } : {}),
} satisfies MessageSentEventV1);
```

No new consumers, no caching changes.

### 2.4 Interfaces Layer (`src/interfaces/controllers/`)

Extending the existing `ConversationController` — no new controller.

**Controller DTO** — extend `SendMessageDto` in `apps/chat-service/src/application/dto/message.dto.ts`:

```typescript
export class SendMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @ApiPropertyOptional({ enum: MessageType })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({
    format: "uuid",
    description: "ID of the message being replied to",
  })
  @IsOptional()
  @IsString()
  quotedMessageId?: string; // add
}
```

**Controller handler** — extend `ConversationController.send()`:

```typescript
return this.sendMessage.execute({
  userId: req.user.id,
  conversationId,
  content: dto.content,
  type: dto.type,
  quotedMessageId: dto.quotedMessageId, // add
});
```

### 2.5 Module Registration

No new providers. `SendMessageUseCase` and `MongooseMessageRepository` are already registered in `ChatModule`. No changes to `chat.module.ts` or `app.module.ts`.

### 2.6 Files to Create / Modify in This Phase

```
apps/chat-service/src/domain/entities/message.entity.ts                              — modified (add ReplyToProps + replyTo getter)
apps/chat-service/src/application/ports/message.repository.ts                        — modified (add ReplyToInput to CreateMessageInput)
apps/chat-service/src/application/interfaces/conversation-view.interface.ts          — modified (add ReplyToView + replyTo to MessageView)
apps/chat-service/src/application/mappers/message.mapper.ts                          — modified (map replyTo)
apps/chat-service/src/application/use-cases/send-message.use-case.ts                 — modified (accept quotedMessageId, validate, build snapshot)
apps/chat-service/src/application/dto/message.dto.ts                                 — modified (add quotedMessageId to SendMessageDto)
apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts  — modified (add ReplyToDocument + replyTo field)
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-message.repository.ts — modified (pass replyTo in create; map in toEntity)
apps/chat-service/src/interfaces/controllers/conversation.controller.ts              — modified (pass quotedMessageId)
libs/kafka-events/src/v1/chat-events.ts                                               — modified (add replyTo? to MessageSentEventV1)
```

### 2.7 Test Cases

**Unit — `SendMessageUseCase`** (`apps/chat-service/tests/unit/`):

- [ ] Happy path without reply: creates message with `replyTo = undefined`; Kafka event has no `replyTo`
- [ ] Happy path with `quotedMessageId`: creates message with `replyTo = { messageId, senderId, content: 'abc' }`; Kafka event includes `replyTo`
- [ ] Content longer than 200 chars: `replyTo.content` in snapshot is truncated to exactly 200 chars
- [ ] Throws `NotFoundException("Quoted message not found")` when `quotedMessageId` maps to no document
- [ ] Throws `NotFoundException("Quoted message not found")` when quoted message's `conversationId` differs from the request `conversationId`
- [ ] Throws `BadRequestException("Cannot reply to a deleted message")` when `quoted.isDeleted === true`
- [ ] Kafka event NOT emitted when `messageRepository.create` throws (existing behaviour unchanged)
- [ ] All existing `SendMessageUseCase` tests remain passing (no regression)

```bash
pnpm nx typecheck chat-service
pnpm nx lint chat-service
pnpm nx test chat-service
```

---

## Phase 3 — Frontend Implementation

**Goal:** Wire the frontend to the completed backend. Reuse existing patterns; no new state management approach.

### 3.1 Routes / Pages

No page-level changes. All UI modifications are within the existing chat feature components.

### 3.2 API Service

Extending `apps/frontend/src/features/chat/services/chat.service.ts`:

```typescript
async sendMessage(
  conversationId: string,
  content: string,
  quotedMessageId?: string,
): Promise<Message> {
  const { data } = await apiClient.post<Message>(
    `/chat/conversations/${conversationId}/messages`,
    { content, type: "TEXT", ...(quotedMessageId ? { quotedMessageId } : {}) },
  );
  return data;
}
```

### 3.3 Hooks

Extending `useSendMessage` in `apps/frontend/src/features/chat/hooks/useChat.ts`.

| Hook             | Change                                                                                                 | Cache Strategy                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `useSendMessage` | `mutationFn` accepts `{ content: string; quotedMessageId?: string }` instead of bare `content: string` | Optimistic update includes `replyTo` snapshot; `onSuccess` invalidates as before |

Optimistic message extended:

```typescript
const replyTarget =
  useChatStore.getState().replyTargets[conversationId] ?? null;

const optimisticMessage: Message = {
  id: `optimistic-${Date.now()}`,
  conversationId,
  senderId: user?.id ?? "",
  content: vars.content,
  type: "TEXT",
  status: "SENT",
  isDeleted: false,
  isEdited: false,
  reactions: [],
  replyTo: replyTarget
    ? {
        messageId: replyTarget.id,
        senderId: replyTarget.senderId,
        content: replyTarget.content.slice(0, 200),
      }
    : undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

All existing `onError` / `onSuccess` behaviour is unchanged.

### 3.4 Zustand Store Changes

Adding reply state to `apps/frontend/src/features/chat/store/useChatStore.ts`:

| Field            | Type                                                         | Default | Purpose                                          |
| ---------------- | ------------------------------------------------------------ | ------- | ------------------------------------------------ |
| `replyTargets`   | `Record<string, Message \| null>`                            | `{}`    | Per-conversation "currently replying to" message |
| `setReplyTarget` | `(conversationId: string, message: Message \| null) => void` | —       | Set or clear the reply target                    |

The reply target is client-side UI state — it controls whether the composer shows a reply strip and what `quotedMessageId` is sent. It lives in Zustand (not TQ) for the same reason `draftMessages` does: both `MessageBubble` (writes) and `MessageComposer` (reads and clears) need access to it without prop drilling through `MessageList`.

### 3.5 Components

| Component         | New or Modified | Changes                                                                                                                                |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `MessageBubble`   | modified        | Add Reply button (↩) on hover; render `QuotedPreview` block above content when `message.replyTo` is set                                |
| `MessageComposer` | modified        | Read `replyTarget` from store; show `ReplyStrip` above textarea; pass `quotedMessageId` on send; clear reply target on successful send |

**Reply button in `MessageBubble`** — placed between the Smile reaction button and the MoreVertical menu button (same hover-opacity pattern that already exists):

```tsx
{
  /* Reply button — visible on hover for both mine and others' messages */
}
<button
  type="button"
  onClick={() => setReplyTarget(conversationId, message)}
  aria-label={t("reply")}
  className="p-1 rounded-full hover:bg-secondary text-foreground/40 hover:text-foreground transition-colors"
>
  <Reply className="w-4 h-4" />
</button>;
```

**Quoted preview block in `MessageBubble`** — rendered above the message content bubble when `message.replyTo` is present:

```tsx
{
  message.replyTo && (
    <div
      className={cn(
        "mb-1 px-3 py-1.5 rounded-xl text-xs border-l-2 border-primary/50 bg-primary/5",
        "max-w-full overflow-hidden cursor-pointer",
        isMine ? "self-end" : "self-start",
      )}
    >
      <p className="font-medium text-primary/70 truncate">
        {/* Resolve senderId to username via conversation.participants */}
        {resolvedSenderName}
      </p>
      <p className="truncate text-foreground/60">{message.replyTo.content}</p>
    </div>
  );
}
```

The `resolvedSenderName` is derived from the `conversation` prop (the `ConversationParticipant[]` already contains `userId` and `username`). `MessageBubble` currently receives `conversationId: string`; it needs to also receive `participants: ConversationParticipant[]` (passed from `MessageList` which already has access to the conversation object) to do this lookup without a new query.

**Reply strip in `MessageComposer`** — shown above the textarea when `replyTarget` is non-null:

```tsx
{
  replyTarget && (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/40 rounded-t-2xl text-xs">
      <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-primary truncate">
          {replyTarget.senderId}
        </p>
        <p className="text-foreground/60 truncate">
          {replyTarget.content.slice(0, 80)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setReplyTarget(conversationId, null)}
        aria-label={t("cancel_reply")}
        className="p-1 rounded-full hover:bg-foreground/10 text-foreground/40 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

The reply strip sits above the textarea, inside the same outer `div` boundary. On successful send, `setReplyTarget(conversationId, null)` is called in `onSuccess`.

Note: `replyTarget.senderId` is shown in the strip as a raw ID until the `participants` resolution pattern is also applied here. The implementation should resolve it to `username` using the same lookup from `MessageComposer`'s context.

### 3.6 Files to Create / Modify in This Phase

```
apps/frontend/src/features/chat/services/chat.service.ts                        — modified (sendMessage accepts quotedMessageId)
apps/frontend/src/features/chat/hooks/useChat.ts                                — modified (useSendMessage mutationFn + optimistic update)
apps/frontend/src/features/chat/store/useChatStore.ts                           — modified (add replyTargets + setReplyTarget)
apps/frontend/src/features/chat/components/MessageBubble.tsx                    — modified (Reply button + quoted preview block)
apps/frontend/src/features/chat/components/MessageComposer.tsx                  — modified (reply strip + pass quotedMessageId on send + clear on success)
apps/frontend/src/features/chat/components/MessageList.tsx                      — modified (pass participants to MessageBubble for sender name resolution)
libs/shared-types/src/index.ts                                                   — modified (export QuotedMessage type after pnpm generate:types)
```

### 3.7 Test Cases

**Hook tests** (`apps/frontend/tests/unit/`):

- [ ] `useSendMessage`: optimistic update includes `replyTo` snapshot when reply target is set in store
- [ ] `useSendMessage`: optimistic update has no `replyTo` when reply target is null
- [ ] `useSendMessage`: calls `chatService.sendMessage` with `quotedMessageId` when reply target is set
- [ ] `useSendMessage`: clears reply target on success

**Component tests**:

- [ ] `MessageBubble`: renders quoted preview block when `message.replyTo` is present
- [ ] `MessageBubble`: does not render quoted preview when `message.replyTo` is `undefined`
- [ ] `MessageBubble`: Reply (↩) button is present in the hover controls
- [ ] `MessageBubble`: clicking Reply button calls `setReplyTarget` with the message
- [ ] `MessageComposer`: renders reply strip when store has a reply target for this conversation
- [ ] `MessageComposer`: does not render reply strip when reply target is null
- [ ] `MessageComposer`: ✕ button in reply strip calls `setReplyTarget(conversationId, null)`
- [ ] `MessageComposer`: sends `quotedMessageId` equal to `replyTarget.id` when replying

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Architecture Decisions

| #   | Decision                                                | Options Considered                                                                                             | Choice                 | Rationale                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Store reply context as embedded snapshot vs foreign key | Foreign key only (`replyTo: { messageId }`) vs embedded snapshot (`replyTo: { messageId, senderId, content }`) | **Embedded snapshot**  | `GET .../messages` already returns all messages in one query. A foreign-key-only approach requires a second `findById` per replied message to populate the preview content. The snapshot adds ~300 bytes per reply document but eliminates the lookup. Also matches WhatsApp: deleted originals still show preview context. Same pattern as `reactions[]` already in this codebase. |
| 2   | New endpoint vs extend existing SendMessageDto          | New `POST .../messages/reply` vs optional `quotedMessageId` on existing `POST .../messages`                    | **Extend existing**    | A reply is semantically a message send with extra metadata. A separate endpoint would duplicate all auth guards, participant checks, friendship checks, and Kafka emission logic for no benefit. An optional field is fully backward-compatible.                                                                                                                                    |
| 3   | New Kafka topic vs extend existing `message.sent.v1`    | `message.reply.v1` (new topic) vs optional `replyTo` on `message.sent.v1`                                      | **Extend existing**    | `replyTo` is optional; consumers that don't handle it ignore the extra field safely. The `ChatGateway` already fans out `message.sent.v1` as `message.new` to both WebSocket rooms — no gateway changes needed. A dedicated topic would add infrastructure with no benefit.                                                                                                         |
| 4   | Content snapshot truncation length                      | 100 / 200 / 500 chars                                                                                          | **200 chars**          | 100 is too short for messages containing CJK or Arabic text. 500 doubles the per-document overhead of the snapshot for marginal UI value (the preview is always truncated visually anyway). 200 is a common industry value (Slack, Discord also use ~200).                                                                                                                          |
| 5   | Allow replying to a deleted message                     | Allow (show tombstone quote) vs Block at send time                                                             | **Block at send time** | A deleted message has replaced its content with `isDeleted: true`; we have no original content to snapshot. Storing a quote with empty content or a hard-coded string like "[deleted]" would be misleading. Blocking with `BadRequestException` is the cleaner contract.                                                                                                            |
| 6   | Reply state location (Zustand vs local component state) | `useState` in `ConversationView` vs Zustand per-conversation                                                   | **Zustand store**      | `MessageBubble` (writer) and `MessageComposer` (reader + clearer) are siblings under `ConversationView`, not in a parent-child relationship. Lifting state to `ConversationView` works but adds two prop-drilling levels. The `draftMessages` pattern in the existing store is the exact precedent for this pattern in this codebase.                                               |

---

## 5. Open Questions

None — all decisions are resolved in Section 4.
