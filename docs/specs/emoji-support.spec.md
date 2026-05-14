# Emoji Support Spec

## 1. Summary

This feature adds emoji support to the chat experience in two distinct phases. Phase 1 is a **pure frontend** change: an emoji picker button added to the message composer so users can browse and insert emoji into their messages. No backend or API changes are needed because the `content` field is already a UTF-8 string that natively stores emoji. Phase 2 adds **emoji reactions** — the ability to tap a quick-reaction button on any message to add or remove an emoji reaction (e.g. 👍 ❤️ 😂), which is a full-stack change requiring a schema update, new endpoint, and new Kafka event.

---

## 2. Current State

Verified by reading source files — no assumptions.

### Backend (chat-service)

- **Message schema** (`apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts`): `content: string`, `type: MessageType`, `status: MessageStatus`, `isDeleted`, `isEdited`. No `reactions` field exists.
- **MessageEntity** (`apps/chat-service/src/domain/entities/message.entity.ts`): mirrors the schema props; no reactions.
- **MessageView** (`apps/chat-service/src/application/interfaces/conversation-view.interface.ts`): no reactions field.
- **MessageRepository port** (`apps/chat-service/src/application/ports/message.repository.ts`): methods `findById`, `findByConversationId`, `create`, `update`, `countUnread`. No `toggleReaction`.
- **MongooseMessageRepository** (`apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-message.repository.ts`): implements all port methods; the `toEntity` mapper does not map reactions.
- **SendMessageDto** (`apps/chat-service/src/application/dto/message.dto.ts`): `content` (1–4000 chars), optional `type`. No emoji-specific validation.
- **Kafka events** (`libs/kafka-events/src/v1/chat-events.ts`): `MESSAGE_SENT`, `MESSAGE_EDITED`, `MESSAGE_DELETED`, `MESSAGE_READ`. No reaction topic.
- **ConversationController** (`apps/chat-service/src/interfaces/controllers/conversation.controller.ts`): no reaction endpoint.

### Frontend (chat feature)

- **MessageComposer** (`apps/frontend/src/features/chat/components/MessageComposer.tsx`): textarea + send button. No emoji button.
- **MessageBubble** (`apps/frontend/src/features/chat/components/MessageBubble.tsx`): renders `message.content` as plain text. No reaction display or button.
- **chat.service.ts** (`apps/frontend/src/features/chat/services/chat.service.ts`): `sendMessage`, `editMessage`, `deleteMessage`, `markRead`, etc. No reaction method.
- **useChat.ts** (`apps/frontend/src/features/chat/hooks/useChat.ts`): `useSendMessage` with optimistic updates, `useEditMessage`, `useDeleteMessage`. No reaction hook.
- **useChatStore** (`apps/frontend/src/features/chat/store/useChatStore.ts`): `activeConversationId`, `draftMessages`. No reaction state.
- **shared-types** (`libs/shared-types/src/index.ts`): exports `Message` type generated from `chat.yaml`. `Message` has no `reactions` field yet.

### What does NOT exist yet

- Emoji picker UI in the composer
- Reaction data model (schema, entity props, view)
- Reaction endpoint (`POST .../reactions`)
- Kafka topic `message.reaction.toggled.v1`
- Reaction display in `MessageBubble`

---

## 3. Desired State

### User-facing behaviour

**Phase 1 — Emoji in message text:**

1. User opens a conversation.
2. User clicks the 😊 button next to the message input.
3. An emoji picker popover appears (search, recently used, all categories).
4. User selects an emoji; it is inserted at the current cursor position in the textarea.
5. User submits the message normally. The emoji is stored as UTF-8 text content.

**Phase 2 — Emoji reactions:**

1. User hovers over any (non-deleted) message.
2. A faint reaction button (😊 +) appears on the appropriate side.
3. Clicking shows a quick-picker with 6 common emoji (👍 ❤️ 😂 😮 😢 🔥) plus a "more" button that opens the full emoji picker.
4. Selecting an emoji adds the user's reaction under that message.
5. If the user already reacted with that emoji, selecting it again removes it (toggle).
6. Each unique emoji shows a pill with the emoji and count below the message bubble.
7. Clicking a reaction pill on a message also toggles the user's reaction.

### Data flow

**Phase 1 (frontend-only, no server round-trip for the picker itself):**

```
User clicks emoji → EmojiPickerPopover opens
  → user selects emoji
  → emoji inserted into Zustand draft (useChatStore.setDraft)
  → user sends message normally via existing POST /chat/conversations/{id}/messages
```

**Phase 2 — Add/remove reaction:**

```
User taps reaction button
  → useToggleReaction.mutate({ messageId, emoji })
  → optimistic: update MessageListResponse cache immediately
  → chatService.toggleReaction(conversationId, messageId, emoji)
  → POST /api/v1/chat/conversations/{conversationId}/messages/{messageId}/reactions
  → API Gateway → chat-service ConversationController
  → ToggleReactionUseCase:
      1. load conversation (exists check)
      2. load participant (access check)
      3. check message exists in conversation
      4. check message is not deleted
      5. messageRepository.toggleReaction(messageId, emoji, userId)
         → MongoDB: $pull if (emoji+userId) exists, else $push
      6. kafkaProducer.emit(message.reaction.toggled.v1)
      7. return updated MessageEntity
  → MessageView (with updated reactions array)
  → TQ: replace message in ['messages', conversationId] cache
```

### Business rules

- Only participants of the conversation may react.
- Deleted messages (`isDeleted: true`) cannot be reacted to — returns `400`.
- A user may react with any given emoji at most once per message (toggle enforces this).
- Reacting with an emoji the user already used removes that reaction.
- Multiple users may have the same emoji reaction on the same message.
- Emoji validation: 1–10 UTF-16 chars (accommodates ZWJ sequences like 👨‍👩‍👧); must be non-empty after trim.
- No limit on number of distinct emoji per message for DM use case.
- Reactions are returned in all message-fetch responses (embedded in message document).

---

## Phase 1 — Emoji Picker in Composer (Frontend Only)

**Goal**: Add an emoji picker button to `MessageComposer`. Zero backend, zero OpenAPI, zero Kafka changes.

### 1.1 OpenAPI Changes

**None.** The `SendMessageDto.content` field is already `type: string, minLength: 1, maxLength: 4000` and fully accepts emoji characters as UTF-8 text.

### 1.2 Database Schema Changes

**None.** Emoji are stored as regular UTF-8 characters in `content`. MongoDB's BSON and the existing Mongoose schema require no changes.

### 1.3 Kafka Event Contracts

**None.**

### 1.4 New Dependency

```bash
pnpm --filter frontend add @emoji-mart/react @emoji-mart/data
```

`@emoji-mart/react` is the standard React emoji picker used by Slack, Linear, and others. The `@emoji-mart/data` package is the emoji dataset (~750 KB gzipped lazily). It works with React 19 and Next.js 15 App Router. No alternative is as complete and actively maintained.

### 1.5 Components to Create / Modify

#### `EmojiPickerPopover.tsx` — created

```
apps/frontend/src/features/chat/components/EmojiPickerPopover.tsx
```

**Props:**

```typescript
interface EmojiPickerPopoverProps {
  onEmojiSelect: (emoji: string) => void;
}
```

Wraps `@emoji-mart/react`'s `Picker` in a click-outside-dismissible popover. The popover opens upward from the trigger button. Uses `useRef` + `useEffect` for click-outside detection (no external library needed — same pattern used in `MessageBubble`'s `showMenu`).

Lazy-loads `@emoji-mart/data` via dynamic `import()` inside a `useEffect` so the 750 KB dataset is not included in the initial page bundle.

**Key implementation note:** `@emoji-mart/react`'s `Picker` uses a Web Component internally and must be rendered with `dynamic({ ssr: false })` in Next.js to avoid hydration errors.

#### `MessageComposer.tsx` — modified

```
apps/frontend/src/features/chat/components/MessageComposer.tsx
```

Changes:

1. Import and render `EmojiPickerPopover`.
2. Add `emojiPickerOpen: boolean` to local component state (no Zustand — it's ephemeral UI state scoped to a single component instance).
3. Add `textareaRef` cursor position tracking: when an emoji is selected, insert it at `textareaRef.current.selectionStart` and update the draft in Zustand.
4. Add the 😊 icon button between the textarea and the send button.

Cursor-insert logic:

```typescript
const handleEmojiSelect = (emoji: string) => {
  const textarea = textareaRef.current;
  if (!textarea) return;
  const start = textarea.selectionStart ?? draft.length;
  const end = textarea.selectionEnd ?? draft.length;
  const newValue = draft.slice(0, start) + emoji + draft.slice(end);
  setDraft(conversationId, newValue);
  setEmojiPickerOpen(false);
  // Restore focus and cursor position after emoji insert
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + emoji.length, start + emoji.length);
  });
};
```

### 1.6 Files to Create / Modify in Phase 1

```
apps/frontend/src/features/chat/components/EmojiPickerPopover.tsx  — created
apps/frontend/src/features/chat/components/MessageComposer.tsx      — modified
```

No commands to run after this phase (no type generation, no migrations).

### 1.7 Test Cases

**Component tests** (`apps/frontend/src/features/chat/components/`):

- [ ] `EmojiPickerPopover`: calls `onEmojiSelect` with the correct emoji string when an emoji is clicked
- [ ] `EmojiPickerPopover`: closes when user clicks outside the popover
- [ ] `MessageComposer`: emoji button renders and is accessible (aria-label)
- [ ] `MessageComposer`: clicking emoji button toggles the picker open/closed
- [ ] `MessageComposer`: after selecting an emoji, draft contains the inserted emoji at the correct position
- [ ] `MessageComposer`: selecting emoji while cursor is mid-text inserts at cursor (not at end)

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## Phase 2 — Emoji Reactions (Full-Stack)

**Goal**: Users can react to messages with emoji. Reactions are stored in MongoDB embedded on the message document, toggleable via a single endpoint, and broadcast via Kafka.

### Phase 2, Section 1 — Contracts & Schema

#### 2.1.1 OpenAPI Changes

Editing the existing `libs/openapi-specs/src/v1/chat.yaml` (reactions belong to chat-service which owns messages). **Already written above by this spec.**

New endpoint added:

| Method | Path                                                                         | Auth | Purpose                           |
| ------ | ---------------------------------------------------------------------------- | ---- | --------------------------------- |
| POST   | `/api/v1/chat/conversations/{conversationId}/messages/{messageId}/reactions` | JWT  | Toggle a reaction (add or remove) |

New schemas added:

- `Reaction` — `{ emoji: string, userId: uuid, createdAt: date-time }`
- `ToggleReactionDto` — `{ emoji: string (1–10 chars) }`

`Message` schema modified: `reactions` optional array of `Reaction` added (default `[]`).

#### 2.1.2 Database Schema Changes

**Modify the existing `Message` Mongoose schema** — add an embedded `reactions` subdocument array.

```typescript
// apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts

@Schema({ _id: false })
export class ReactionDocument {
  @Prop({ required: true })
  emoji!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ default: () => new Date() })
  createdAt!: Date;
}

const ReactionDocumentSchema = SchemaFactory.createForClass(ReactionDocument);

// In Message class:
@Prop({ type: [ReactionDocumentSchema], default: [] })
reactions!: ReactionDocument[];
```

**Why embedded array over separate collection**: DMs are 1:1 — at most 2 users can react per message. Document growth is bounded. Embedding means message + reactions are fetched in a single read, which matches the `findByConversationId` access pattern exactly. No join, no additional query.

**No new indexes needed**: reactions are always accessed through their parent message document (never queried independently). The existing `{ conversationId: 1, createdAt: -1 }` compound index is sufficient.

#### 2.1.3 Kafka Event Contracts

| Direction | Topic                         | Producer     | Consumer(s)          | Payload                                                                                            |
| --------- | ----------------------------- | ------------ | -------------------- | -------------------------------------------------------------------------------------------------- |
| Produces  | `message.reaction.toggled.v1` | chat-service | notification-service | `{ messageId, conversationId, senderId, reactorId, emoji, action: 'added'\|'removed', toggledAt }` |

This is a **new** topic. `notification-service` will eventually consume it to notify the message sender when someone reacts.

`action` field (`added` | `removed`) lets the consumer know whether to send a notification (added) or suppress it (removed), without needing to diff state.

#### 2.1.4 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/chat.yaml                                  — modified (already done above)
libs/kafka-events/src/v1/chat-events.ts                              — modified (add reaction topic + event)
apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts — modified (add reactions)
apps/chat-service/src/domain/entities/message.entity.ts             — modified (add reactions prop)
apps/chat-service/src/application/interfaces/conversation-view.interface.ts — modified (add reactions to MessageView)
apps/chat-service/src/application/ports/message.repository.ts       — modified (add toggleReaction method)
apps/chat-service/src/application/use-cases/toggle-reaction.use-case.ts — created
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-message.repository.ts — modified (implement toggleReaction + update toEntity)
apps/chat-service/src/interfaces/controllers/conversation.controller.ts — modified (add reaction route)
apps/chat-service/src/chat.module.ts                                 — modified (register ToggleReactionUseCase)
apps/chat-service/src/application/dto/message.dto.ts                — modified (add ToggleReactionDto)
```

Commands to run after this phase:

```bash
pnpm generate:types   # Regenerate shared-types from updated chat.yaml
```

No Prisma migration needed (MongoDB schema is schema-less; existing documents will have `reactions: undefined`, the Mongoose schema default handles it as `[]` on read).

---

### Phase 2, Section 2 — Backend Implementation

#### 2.2.1 Domain Layer

**No new entities.** Reactions are a value type embedded in `MessageEntity`. Extend `MessageProps` and `MessageEntity`:

```typescript
// apps/chat-service/src/domain/entities/message.entity.ts
export interface ReactionProps {
  emoji: string;
  userId: string;
  createdAt: Date;
}

export interface MessageProps {
  // ... existing fields ...
  reactions: ReactionProps[];
}

// Add to MessageEntity:
get reactions() { return this.props.reactions; }
```

No factory method needed — `MessageEntity.create()` already accepts `MessageProps`; just extend the interface.

#### 2.2.2 Application Layer

**`ToggleReactionDto`** — add to `apps/chat-service/src/application/dto/message.dto.ts`:

```typescript
export class ToggleReactionDto {
  @ApiProperty({ minLength: 1, maxLength: 10 })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  emoji!: string;
}
```

**`MessageRepository` port** — add method:

```typescript
// apps/chat-service/src/application/ports/message.repository.ts
toggleReaction(messageId: string, emoji: string, userId: string): Promise<MessageEntity>;
```

**`MessageView` interface** — add reactions:

```typescript
// apps/chat-service/src/application/interfaces/conversation-view.interface.ts
export interface ReactionView {
  emoji: string;
  userId: string;
  createdAt: string;
}

export interface MessageView {
  // ... existing fields ...
  reactions: ReactionView[];
}
```

**`ToggleReactionUseCase`** — new file `apps/chat-service/src/application/use-cases/toggle-reaction.use-case.ts`:

| Use Case                | HTTP Trigger         | Business Rules                                         | Events                        |
| ----------------------- | -------------------- | ------------------------------------------------------ | ----------------------------- |
| `ToggleReactionUseCase` | POST `.../reactions` | participant check, not-deleted check, toggle semantics | `message.reaction.toggled.v1` |

Exact execution sequence:

1. Load conversation by `conversationId` — throw `NotFoundException` if missing.
2. Load participant by `(conversationId, userId)` — throw `ForbiddenException` if not a participant.
3. Load message by `messageId` — throw `NotFoundException` if missing or `message.conversationId !== conversationId`.
4. If `message.isDeleted` — throw `BadRequestException("Cannot react to a deleted message")`.
5. Call `messageRepository.toggleReaction(messageId, emoji, userId)` — returns updated entity.
6. Determine `action`: `'added'` if the reaction now exists for this user+emoji, `'removed'` otherwise.
7. Emit `ChatTopics.MESSAGE_REACTION_TOGGLED` with payload.
8. Return `toView(updatedMessage)`.

#### 2.2.3 Infrastructure Layer

**`MongooseMessageRepository`** — add `toggleReaction`:

```typescript
async toggleReaction(messageId: string, emoji: string, userId: string): Promise<MessageEntity> {
  if (!Types.ObjectId.isValid(messageId)) {
    throw new NotFoundException(`Message ${messageId} not found`);
  }

  // Check if this user's reaction for this emoji already exists
  const exists = await this.model.exists({
    _id: messageId,
    reactions: { $elemMatch: { userId, emoji } },
  }).exec();

  const updated = exists
    ? await this.model
        .findByIdAndUpdate(
          messageId,
          { $pull: { reactions: { userId, emoji } } },
          { new: true },
        )
        .exec()
    : await this.model
        .findByIdAndUpdate(
          messageId,
          { $push: { reactions: { emoji, userId, createdAt: new Date() } } },
          { new: true },
        )
        .exec();

  if (!updated) throw new NotFoundException(`Message ${messageId} not found`);
  return this.toEntity(updated);
}
```

**Why `$exists` + two-step**: MongoDB lacks a single atomic "add if not exists, remove if exists" operator for array subdocuments. The two-step approach (exists check → conditional update) is clean and correct for DMs where the race window is negligible (at most 2 users, low contention). Full atomicity would require a custom `$function` aggregation pipeline update, which adds complexity without benefit.

**Update `toEntity` mapper** to include reactions:

```typescript
private toEntity(doc: Message): MessageEntity {
  return MessageEntity.create({
    // ... existing fields ...
    reactions: (doc.reactions ?? []).map((r) => ({
      emoji: r.emoji,
      userId: r.userId,
      createdAt: r.createdAt,
    })),
  });
}
```

**Kafka producer** — `ToggleReactionUseCase` calls existing `KafkaProducerService.emit()` (no changes to the producer itself).

**No caching** — reactions are a low-frequency, low-latency DB write. Caching reactions would add invalidation complexity without measurable benefit in a DM context.

#### 2.2.4 Interfaces Layer

**Add route to existing `ConversationController`** — do not create a new controller:

```typescript
@Post(":conversationId/messages/:messageId/reactions")
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: "Toggle an emoji reaction on a message" })
@ApiParam({ name: "conversationId", format: "uuid" })
@ApiParam({ name: "messageId", format: "uuid" })
@ApiBody({ type: ToggleReactionDto })
@ApiResponse({ status: 200, description: "Updated message with current reactions" })
async toggleReaction(
  @Req() req: RequestWithUser,
  @Param("conversationId") conversationId: string,
  @Param("messageId") messageId: string,
  @Body() dto: ToggleReactionDto,
) {
  return this.toggleReaction.execute({
    userId: req.user.id,
    conversationId,
    messageId,
    emoji: dto.emoji,
  });
}
```

#### 2.2.5 Module Registration

Add to `ChatModule` providers in `apps/chat-service/src/chat.module.ts`:

```typescript
ToggleReactionUseCase,
```

No new repository bindings — `ToggleReactionUseCase` injects the existing `'MessageRepository'` token.

#### 2.2.6 Files to Create / Modify

```
apps/chat-service/src/application/use-cases/toggle-reaction.use-case.ts      — created
apps/chat-service/src/application/dto/message.dto.ts                          — modified (add ToggleReactionDto)
apps/chat-service/src/application/ports/message.repository.ts                 — modified (add toggleReaction signature)
apps/chat-service/src/application/interfaces/conversation-view.interface.ts   — modified (add ReactionView, reactions to MessageView)
apps/chat-service/src/domain/entities/message.entity.ts                       — modified (add ReactionProps, reactions getter)
apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts   — modified (add ReactionDocument + reactions array)
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-message.repository.ts — modified (toggleReaction + toEntity update)
apps/chat-service/src/interfaces/controllers/conversation.controller.ts       — modified (add toggleReaction route)
apps/chat-service/src/chat.module.ts                                           — modified (register ToggleReactionUseCase)
libs/kafka-events/src/v1/chat-events.ts                                        — modified (add topic + event interface)
```

#### 2.2.7 Test Cases

**Unit — `ToggleReactionUseCase`** (`apps/chat-service/tests/unit/toggle-reaction.use-case.spec.ts`):

- [ ] Happy path (add): returns updated message with reaction in `reactions` array; emits `message.reaction.toggled.v1` with `action: 'added'`
- [ ] Happy path (remove): calling with same emoji twice removes it; emits with `action: 'removed'`
- [ ] Throws `NotFoundException` when `conversationId` does not exist
- [ ] Throws `ForbiddenException` when user is not a participant
- [ ] Throws `NotFoundException` when `messageId` does not exist
- [ ] Throws `BadRequestException` when message is deleted (`isDeleted: true`)
- [ ] Kafka event NOT emitted when repository throws

```bash
pnpm nx typecheck chat-service
pnpm nx lint chat-service
pnpm nx test chat-service
```

---

### Phase 2, Section 3 — Frontend Implementation

#### 2.3.1 Routes / Pages

No new routes. All changes are within the existing `/chat` page's component tree.

#### 2.3.2 API Service

Add to `apps/frontend/src/features/chat/services/chat.service.ts`:

```typescript
async toggleReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<Message> {
  const { data } = await apiClient.post<Message>(
    `/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    { emoji },
  );
  return data;
}
```

#### 2.3.3 Hooks

Add to `apps/frontend/src/features/chat/hooks/useChat.ts`:

```typescript
export const useToggleReaction = (conversationId: string) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatService.toggleReaction(conversationId, messageId, emoji),

    onMutate: async ({ messageId, emoji }) => {
      await queryClient.cancelQueries({
        queryKey: ["messages", conversationId],
      });
      const snapshot = queryClient.getQueryData<
        InfiniteData<MessageListResponse>
      >(["messages", conversationId]);

      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((msg) => {
                if (msg.id !== messageId) return msg;
                const reactions = msg.reactions ?? [];
                const existingIdx = reactions.findIndex(
                  (r) => r.emoji === emoji && r.userId === user?.id,
                );
                const updatedReactions =
                  existingIdx >= 0
                    ? reactions.filter((_, i) => i !== existingIdx)
                    : [
                        ...reactions,
                        {
                          emoji,
                          userId: user?.id ?? "",
                          createdAt: new Date().toISOString(),
                        },
                      ];
                return { ...msg, reactions: updatedReactions };
              }),
            })),
          };
        },
      );

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(
          ["messages", conversationId],
          context.snapshot,
        );
      }
    },
    onSuccess: (updatedMessage) => {
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg,
              ),
            })),
          };
        },
      );
    },
  });
};
```

| Hook                                | TQ Type       | Query Key                      | Optimistic Update                                                  |
| ----------------------------------- | ------------- | ------------------------------ | ------------------------------------------------------------------ |
| `useToggleReaction(conversationId)` | `useMutation` | `['messages', conversationId]` | Yes — toggle local reactions array immediately, roll back on error |

#### 2.3.4 Zustand Store Changes

**None.** Reaction state is server state that belongs in TanStack Query. The optimistic update pattern (snapshot + rollback) already used by `useSendMessage` handles consistency.

#### 2.3.5 Components

| Component            | New or Modified | Responsibility                                                                  |
| -------------------- | --------------- | ------------------------------------------------------------------------------- |
| `ReactionBar.tsx`    | created         | Displays reaction pills below message; handles click-to-toggle                  |
| `ReactionPicker.tsx` | created         | Quick-picker (6 common emoji) + "more" button opening full `EmojiPickerPopover` |
| `MessageBubble.tsx`  | modified        | Add reaction button on hover, render `ReactionBar`, wire `useToggleReaction`    |

**`ReactionBar` props:**

```typescript
interface ReactionBarProps {
  reactions: Reaction[]; // from message
  currentUserId: string;
  onToggle: (emoji: string) => void;
}
```

Groups reactions by emoji, renders pills with count. Pills the current user has reacted to are highlighted (primary color ring). Clicking a pill calls `onToggle(emoji)`.

**`ReactionPicker` props:**

```typescript
interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
}
```

Six preset emoji (👍 ❤️ 😂 😮 😢 🔥) as quick-tap buttons, then a small "+" button that opens `EmojiPickerPopover`. Reuses `EmojiPickerPopover` from Phase 1.

**`MessageBubble` changes:**

- Add `useToggleReaction(conversationId)` mutation.
- Show `ReactionPicker` on hover (in a `group-hover:opacity-100` div), positioned opposite the `MoreVertical` menu.
  - `isMine` messages: picker appears to the left of the bubble.
  - Other's messages: picker appears to the right.
- Render `<ReactionBar>` below the bubble (above the timestamp row) when `message.reactions?.length > 0`.

#### 2.3.6 Files to Create / Modify in Phase 2 Frontend

```
apps/frontend/src/features/chat/services/chat.service.ts           — modified (add toggleReaction)
apps/frontend/src/features/chat/hooks/useChat.ts                   — modified (add useToggleReaction)
apps/frontend/src/features/chat/components/MessageBubble.tsx       — modified (add reaction UI)
apps/frontend/src/features/chat/components/ReactionBar.tsx         — created
apps/frontend/src/features/chat/components/ReactionPicker.tsx      — created
libs/shared-types/src/index.ts                                      — modified (add Reaction export after pnpm generate:types)
```

#### 2.3.7 Test Cases

**Hook tests:**

- [ ] `useToggleReaction`: optimistic update adds reaction immediately before server response
- [ ] `useToggleReaction`: optimistic update removes reaction when same emoji+userId already present
- [ ] `useToggleReaction`: on error, rolls back to snapshot state
- [ ] `useToggleReaction`: on success, replaces optimistic entry with server-confirmed message

**Component tests:**

- [ ] `ReactionBar`: groups multiple reactions by emoji and shows correct counts
- [ ] `ReactionBar`: highlights reactions the current user has made (reacted pill has distinct style)
- [ ] `ReactionBar`: clicking a pill calls `onToggle` with the correct emoji
- [ ] `ReactionPicker`: clicking a preset emoji calls `onSelect` with correct emoji string
- [ ] `ReactionPicker`: "+" button opens the full `EmojiPickerPopover`
- [ ] `MessageBubble`: does not show `ReactionBar` when `reactions` is empty
- [ ] `MessageBubble`: shows `ReactionBar` when message has reactions

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Architecture Decisions

| #   | Decision                              | Options Considered                                       | Choice                                  | Rationale                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------- | -------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Where to store reactions              | Separate collection vs embedded array on Message         | Embedded array                          | DMs are 1:1 — max 2 distinct users per message, bounded doc growth. Reactions always fetched with their message, so embedding avoids a second query entirely. Separate collection only wins for group chats with many participants.                                                                                      |
| 2   | Reaction toggle — one endpoint or two | POST (add) + DELETE (remove) vs single POST (toggle)     | Single POST toggle                      | Simpler client API: no need to track whether a reaction exists before deciding which verb to call. Matches the UX (single tap to add/remove). Idempotent semantics via toggle.                                                                                                                                           |
| 3   | Emoji picker library                  | `emoji-mart`, `emoji-picker-react`, OS keyboard only     | `@emoji-mart/react`                     | Industry standard (used in Slack, Linear). Supports search, recently-used, skin tones. Works with React 19. `emoji-picker-react` is smaller but less feature-complete. OS keyboard alone has no picker UI.                                                                                                               |
| 4   | Emoji picker SSR handling             | Render server-side vs dynamic no-SSR                     | `dynamic({ ssr: false })`               | `@emoji-mart` uses Web Components internally which aren't SSR-compatible in Next.js App Router. `ssr: false` is the documented approach and avoids hydration errors.                                                                                                                                                     |
| 5   | Race condition on toggle              | Atomic Mongo update vs exists-check + conditional update | Two-step (check + update)               | MongoDB lacks a single atomic "upsert into subdoc array or remove if present" operator. The two-step approach is clean. For 1:1 DMs the race window is negligible; a duplicate reaction at worst is corrected on the next toggle. Full atomicity would require a `$function` update pipeline which adds read complexity. |
| 6   | Reactions in existing message fetch   | Separate endpoint vs included in message payload         | Included in existing `Message` schema   | Reactions are embedded in the document. Returning them with every message fetch adds zero query cost and zero round-trips on the client.                                                                                                                                                                                 |
| 7   | Reaction Kafka event                  | New topic vs reuse existing                              | New topic `message.reaction.toggled.v1` | Distinct semantic — a reaction event has a different payload shape (emoji, action) and different consumers (notify sender) than `message.sent.v1`. Reusing would conflate unrelated event semantics.                                                                                                                     |

---

## 5. Open Questions

None — all decisions are resolved in Section 4.
