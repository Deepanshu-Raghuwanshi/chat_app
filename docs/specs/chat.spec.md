# Chat Feature — Full-Stack Spec

## Feature: Direct Messaging Between Friends

---

## 1. Summary

The chat feature enables authenticated users to send and receive direct messages with their friends in real time. A conversation is a private, two-participant thread that can only be created between users who are already friends. Messages support text content, soft deletion (tombstone), and editing by the original sender. The frontend provides a split-pane chat UI — a conversation list on the left and a message thread on the right — with real-time updates delivered over the existing Socket.IO presence connection.

---

## 2. Current State

### What exists

**chat-service** (`apps/chat-service/`):

- `PresenceGateway` — WebSocket gateway on `/presence` namespace, tracks online/offline via Redis
- `RedisPresenceRepository` — reads/writes presence state to Redis
- `RedisIoAdapter` — Socket.IO adapter backed by Redis for horizontal scaling
- `JwtStrategy` — extracts JWT from cookies for WebSocket auth
- `Room` + `Participant` Mongoose schemas — old group-room model, not aligned with DM conversations
- No HTTP controllers, no conversation use cases, no message handling

**message-service** (`apps/message-service/`) — **to be deleted**:

- `Message` Mongoose schema — fields: `roomId`, `senderId`, `content`, `type`, `metadata`, `isRead`
- No controllers, no use cases, no Kafka consumers — effectively an empty scaffold
- Decision (Q3): removed in favour of chat-service owning all message persistence

**`libs/openapi-specs/src/v1/chat.yaml`** — already complete:

- `GET/POST /api/v1/chat/conversations`
- `GET /api/v1/chat/conversations/{conversationId}`
- `GET/POST /api/v1/chat/conversations/{conversationId}/messages`
- `PATCH/DELETE /api/v1/chat/conversations/{conversationId}/messages/{messageId}`
- `POST /api/v1/chat/conversations/{conversationId}/read`
- All schemas: `Conversation`, `Message`, `ConversationParticipant`, `ConversationListResponse`, `MessageListResponse`

**`libs/kafka-events/src/v1/chat-events.ts`** — already defined:

- `ChatTopics.MESSAGE_SENT = 'message.sent.v1'`
- `ChatTopics.MESSAGE_READ = 'message.read.v1'`
- `MessageSentEventV1`, `MessageReadEventV1` interfaces

**API Gateway** — `chat` prefix already mapped to `CHAT_SERVICE_URL`

**Frontend** (`apps/frontend/src/features/chat/`):

- `ChatDashboard.tsx` — placeholder "coming soon" component, no real functionality

### What does NOT exist yet

- `Conversation`, `ConversationParticipant`, and `Message` Mongoose schemas in chat-service
- Any domain entities, application use cases, or controllers for conversations/messages
- Frontend chat service, hooks, store, and full chat UI

---

## 3. Desired State

### User-facing behaviour

- A user can open a conversation with any friend from the friends list (one click opens or creates the conversation)
- The conversation list shows all DMs sorted by most recent message, with unread count badges
- Inside a conversation, messages load newest-first with infinite scroll upward for older history
- Sending a message delivers it instantly via optimistic UI and persists via REST POST
- The sender can edit or soft-delete their own messages; deleted messages show a tombstone `[deleted]`
- Opening a conversation marks it as read and clears the unread badge
- The other participant's online/offline status is shown in the conversation header (reuses existing presence socket)

### Data flow

```
Client POST /api/v1/chat/conversations/{id}/messages
  -> API Gateway (chat prefix -> port 3003)
  -> chat-service: SendMessageUseCase
      -> FriendshipCacheService.areFriends()  (Redis O(1) check)
      -> ConversationRepository.findById      (verify participant)
      -> MessageRepository.create             (persist to chat MongoDB)
      -> KafkaProducer.emit(message.sent.v1)
  -> 201 Message response

Kafka message.sent.v1
  -> chat-service: ChatGateway               (fan out via Socket.IO to conversation room)
  -> notification-service: (future)          (push to offline recipient)

Kafka friend.request.accepted.v1
  -> chat-service: FriendshipCacheService    (write Redis key friendship:<id1>:<id2>)
```

### Business rules

- Only friends can start or participate in a conversation
- A user cannot message themselves
- Only the original sender can edit or delete their own message
- Soft delete: sender's copy and recipient's copy both show `[deleted]` — content is replaced in the DB, `isDeleted: true`. The message record is never hard-deleted. Both participants see the tombstone in real time via the `message.new` socket event carrying `isDeleted: true`.
- Edited messages set `isEdited: true`; the updated content is reflected for both participants in real time. Edit history is not stored in v1.
- Cursor-based pagination: conversations ordered by `lastActivityAt` DESC; messages ordered by `createdAt` DESC
- Creating a conversation is idempotent: POST returns the existing conversation if one already exists

---

## Phase 1 — Contracts & Schema

**Goal**: All contracts and DB schemas are defined before any implementation begins.

### 1.1 OpenAPI Changes

`libs/openapi-specs/src/v1/chat.yaml` — **already complete, no changes needed.**

`libs/openapi-specs/src/v1/message.yaml` — **delete this file.** message-service is removed (Option C). All message endpoints live under `chat.yaml`. Keeping `message.yaml` would cause confusion and generate dead TypeScript types.

### 1.2 Database Schema Changes

**chat-service** — replace old `Room` + `Participant` schemas with three new schemas:

**`Conversation` schema** (`apps/chat-service/src/infrastructure/persistence/mongoose/schemas/conversation.schema.ts`):

```typescript
@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ required: true, index: true })
  participant1Id: string; // lexicographically smaller userId (enforced for dedup)

  @Prop({ required: true, index: true })
  participant2Id: string;

  @Prop({ type: Object })
  lastMessage?: {
    messageId: string;
    senderId: string;
    content: string;
    sentAt: Date;
  };

  @Prop({ default: Date.now, index: true })
  lastActivityAt: Date; // used for conversation list ordering
}

ConversationSchema.index(
  { participant1Id: 1, participant2Id: 1 },
  { unique: true },
);
ConversationSchema.index({ lastActivityAt: -1 });
```

**`ConversationParticipant` schema** (`apps/chat-service/src/infrastructure/persistence/mongoose/schemas/conversation-participant.schema.ts`):

```typescript
@Schema({ timestamps: true })
export class ConversationParticipant extends Document {
  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  lastReadAt?: Date; // read cursor for unread count computation
}

ConversationParticipantSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true },
);
```

**`Message` schema** (`apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts`):

```typescript
@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ enum: ["TEXT"], default: "TEXT" })
  type: string;

  @Prop({ enum: ["SENT", "DELIVERED", "READ"], default: "SENT" })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: false })
  isEdited: boolean;
}

MessageSchema.index({ conversationId: 1, createdAt: -1 }); // primary pagination index
```

**message-service** — **deleted entirely.** chat-service owns all three MongoDB collections: `conversations`, `conversation_participants`, `messages`. No cross-service boundary for message data.

### 1.3 Kafka Event Contracts

All events already defined in `libs/kafka-events/src/v1/chat-events.ts`. No new topics needed for v1.

| Direction | Topic                        | Producer     | Consumer(s)                                      | Payload                                                                  |
| --------- | ---------------------------- | ------------ | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Produces  | `message.sent.v1`            | chat-service | chat-service (ChatGateway), notification-service | `messageId, conversationId, senderId, receiverId, content, type, sentAt` |
| Produces  | `message.edited.v1`          | chat-service | chat-service (ChatGateway)                       | `messageId, conversationId, senderId, content, editedAt`                 |
| Produces  | `message.deleted.v1`         | chat-service | chat-service (ChatGateway)                       | `messageId, conversationId, senderId, deletedAt`                         |
| Produces  | `message.read.v1`            | chat-service | notification-service                             | `conversationId, userId, lastReadAt`                                     |
| Consumes  | `friend.request.accepted.v1` | user-service | chat-service (FriendshipCacheService)            | `requestId, senderId, receiverId`                                        |

### 1.4 Files to Create / Modify in Phase 1

```
libs/openapi-specs/src/v1/message.yaml                                           — DELETE
libs/kafka-events/src/v1/chat-events.ts                                          — add MESSAGE_EDITED, MESSAGE_DELETED topics + interfaces
libs/kafka-events/src/index.ts                                                   — already exports chat-events, no change needed
apps/chat-service/src/infrastructure/persistence/mongoose/schemas/
  conversation.schema.ts                                                          — create
  conversation-participant.schema.ts                                              — create
  message.schema.ts                                                               — create
apps/message-service/                                                             — DELETE entire directory
apps/api-gateway src/app.module.ts + gateway.controller.ts                       — remove MESSAGE_SERVICE_URL from serviceMap
```

Commands to run after Phase 1:

```bash
pnpm generate:types    # Regenerate shared-types (message.yaml removed, chat.yaml unchanged)
```

---

## Phase 2 — Backend Implementation

**Goal**: All REST endpoints from `chat.yaml` implemented in chat-service. chat-service is the sole owner of all conversation and message data.

### 2.1 Domain Layer (`apps/chat-service/src/domain/`)

**`Conversation` entity** (`src/domain/entities/conversation.entity.ts`):

- Fields: `id`, `participant1Id`, `participant2Id`, `lastMessage?`, `lastActivityAt`, `createdAt`, `updatedAt`
- Business rule enforced in `static create()`: `participant1Id` is always the lexicographically smaller userId

**`Message` entity** (`src/domain/entities/message.entity.ts`):

- Fields: `id`, `conversationId`, `senderId`, `content`, `type`, `status`, `isDeleted`, `isEdited`, `createdAt`, `updatedAt`

### 2.2 Application Layer (`apps/chat-service/src/application/`)

**Repository ports:**

`src/application/ports/conversation.repository.ts`:

```typescript
export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByParticipants(
    userId1: string,
    userId2: string,
  ): Promise<Conversation | null>;
  findByUserId(
    userId: string,
    limit: number,
    before?: string,
  ): Promise<Conversation[]>;
  create(data: CreateConversationInput): Promise<Conversation>;
  updateLastMessage(id: string, snapshot: LastMessageSnapshot): Promise<void>;
}
```

`src/application/ports/message.repository.ts`:

```typescript
export interface MessageRepository {
  findById(id: string): Promise<Message | null>;
  findByConversationId(
    conversationId: string,
    limit: number,
    before?: string,
  ): Promise<Message[]>;
  create(data: CreateMessageInput): Promise<Message>;
  update(id: string, data: UpdateMessageInput): Promise<Message>;
}
```

`src/application/ports/conversation-participant.repository.ts`:

```typescript
export interface ConversationParticipantRepository {
  findByConversationAndUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipant | null>;
  findByConversationId(
    conversationId: string,
  ): Promise<ConversationParticipant[]>;
  create(data: CreateParticipantInput): Promise<ConversationParticipant>;
  updateLastRead(
    conversationId: string,
    userId: string,
    lastReadAt: Date,
  ): Promise<void>;
}
```

`src/application/ports/friendship-verifier.port.ts`:

```typescript
export interface FriendshipVerifier {
  areFriends(userId1: string, userId2: string): Promise<boolean>;
}
```

**Use Cases** (one file each in `src/application/use-cases/`):

| Class                            | Business Rules                                          | Events Emitted    |
| -------------------------------- | ------------------------------------------------------- | ----------------- |
| `CreateOrGetConversationUseCase` | Must be friends; cannot be self; idempotent             | none              |
| `GetConversationUseCase`         | Requester must be participant                           | none              |
| `ListConversationsUseCase`       | Only conversations for requester; compute `unreadCount` | none              |
| `GetMessagesUseCase`             | Requester must be participant; cursor pagination        | none              |
| `SendMessageUseCase`             | Requester must be participant; content min 1 char       | `message.sent.v1` |
| `EditMessageUseCase`             | Only sender can edit; cannot edit deleted messages      | none              |
| `DeleteMessageUseCase`           | Only sender can delete; soft delete only                | none              |
| `MarkConversationReadUseCase`    | Requester must be participant                           | `message.read.v1` |

### 2.3 Infrastructure Layer (`apps/chat-service/src/infrastructure/`)

**Mongoose repositories** (implement each port):

- `MongooseConversationRepository`
- `MongooseMessageRepository`
- `MongooseConversationParticipantRepository`

**Friendship cache** (`src/infrastructure/cache/friendship-cache.service.ts`):
At huge scale, making a synchronous HTTP call to user-service on every `CreateOrGetConversationUseCase` invocation creates a hard latency dependency and a potential cascading failure point. The correct pattern at scale is an **event-driven Redis cache**:

- chat-service consumes `friend.request.accepted.v1` from Kafka (already defined in `@kafka-events`)
- On consumption, writes `friendship:<minId>:<maxId> = 1` to Redis with no TTL (friendship persists until explicitly removed)
- When friendship removal is added (future), emit `friendship.removed.v1` and delete the Redis key
- `CreateOrGetConversationUseCase` calls `FriendshipCacheService.areFriends(id1, id2)` — an O(1) Redis GET, no HTTP, no cross-service latency
- Eventually consistent: there is a small window (~Kafka propagation time, typically <100ms) between a friendship being accepted and the chat becoming available. This is fully acceptable for this use case.

Why this beats HTTP at scale:

- No synchronous cross-service call on the hot path (message send, conversation create)
- Zero added latency — Redis is already in the stack
- If user-service is down, chat-service still works for existing friends
- Redis can handle millions of key lookups per second
- No mTLS or service token complexity needed

```typescript
@Injectable()
export class FriendshipCacheService
  implements FriendshipVerifier, OnModuleInit
{
  private readonly PREFIX = "friendship:";

  async onModuleInit() {
    // consume friend.request.accepted.v1
    await this.consumer.subscribe({
      topic: FriendTopics.FRIEND_REQUEST_ACCEPTED,
    });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const { senderId, receiverId } = JSON.parse(
          message.value.toString(),
        ) as FriendRequestAcceptedEventV1;
        const key = this.buildKey(senderId, receiverId);
        await this.redis.set(key, "1");
      },
    });
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const key = this.buildKey(userId1, userId2);
    return (await this.redis.get(key)) === "1";
  }

  private buildKey(a: string, b: string): string {
    const [min, max] = [a, b].sort();
    return `${this.PREFIX}${min}:${max}`;
  }
}
```

Add new Kafka events to `libs/kafka-events/src/v1/chat-events.ts`:

```typescript
export enum ChatTopics {
  MESSAGE_SENT = "message.sent.v1",
  MESSAGE_EDITED = "message.edited.v1",
  MESSAGE_DELETED = "message.deleted.v1",
  MESSAGE_READ = "message.read.v1",
}

export interface MessageEditedEventV1 {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  editedAt: string;
}

export interface MessageDeletedEventV1 {
  messageId: string;
  conversationId: string;
  senderId: string;
  deletedAt: string;
}
```

**Kafka producer** via `ClientKafka` (already wired in `AppModule`):

- `SendMessageUseCase` emits `message.sent.v1`
- `EditMessageUseCase` emits `message.edited.v1`
- `DeleteMessageUseCase` emits `message.deleted.v1`
- `MarkConversationReadUseCase` emits `message.read.v1`

**Real-time fan-out — `ChatGateway`** (`src/infrastructure/messaging/chat.gateway.ts`):
A dedicated Kafka consumer that subscribes to `message.sent.v1`, `message.edited.v1`, and `message.deleted.v1` and emits Socket.IO events to connected participants.

This is the correct pattern at huge scale because:

- `SendMessageUseCase` stays pure — no WebSocket import, no coupling to the gateway
- The WebSocket server can be scaled independently from the REST API server
- Kafka acts as a guaranteed buffer between message persistence and fan-out: if the Socket.IO emit fails, the message is already in Kafka and can be replayed
- Multiple downstream consumers (ChatGateway, notification-service, message-service archive) can all process the same event without coupling to each other
- At millions of concurrent connections, you run multiple Socket.IO instances behind a load balancer; Kafka ensures every instance that has a relevant socket gets the event via the Redis Socket.IO adapter

```typescript
// Chat gateway subscribes to Kafka and fans out via Socket.IO
@Injectable()
export class ChatGateway implements OnModuleInit {
  @WebSocketServer() server: Server;

  async onModuleInit() {
    await this.consumer.subscribe([
      ChatTopics.MESSAGE_SENT,
      ChatTopics.MESSAGE_EDITED,
      ChatTopics.MESSAGE_DELETED,
    ]);
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const payload = JSON.parse(message.value.toString());
        if (topic === ChatTopics.MESSAGE_SENT) {
          this.server
            .to(`user:${payload.receiverId}`)
            .emit("message.new", payload);
          this.server
            .to(`user:${payload.senderId}`)
            .emit("message.new", payload);
        }
        if (topic === ChatTopics.MESSAGE_EDITED) {
          this.server
            .to(`conversation:${payload.conversationId}`)
            .emit("message.updated", payload);
        }
        if (topic === ChatTopics.MESSAGE_DELETED) {
          this.server
            .to(`conversation:${payload.conversationId}`)
            .emit("message.deleted", payload);
        }
      },
    });
  }
}
```

When a user connects to the presence socket, join them to a personal room `user:<userId>` and all their active conversation rooms `conversation:<conversationId>` so targeted fan-out works.

### 2.4 Interfaces Layer — `ConversationController`

Prefix: `/chat/conversations` | Guard: `JwtAuthGuard` on all routes

| Method   | Route                                  | Use Case                         |
| -------- | -------------------------------------- | -------------------------------- |
| `GET`    | `/`                                    | `ListConversationsUseCase`       |
| `POST`   | `/`                                    | `CreateOrGetConversationUseCase` |
| `GET`    | `/:conversationId`                     | `GetConversationUseCase`         |
| `GET`    | `/:conversationId/messages`            | `GetMessagesUseCase`             |
| `POST`   | `/:conversationId/messages`            | `SendMessageUseCase`             |
| `PATCH`  | `/:conversationId/messages/:messageId` | `EditMessageUseCase`             |
| `DELETE` | `/:conversationId/messages/:messageId` | `DeleteMessageUseCase`           |
| `POST`   | `/:conversationId/read`                | `MarkConversationReadUseCase`    |

### 2.5 Module Registration

New `apps/chat-service/src/chat.module.ts` — registers all providers, repositories, and `ConversationController`.

`apps/chat-service/src/app.module.ts` changes:

- Import `ChatModule`
- Register Mongoose schemas: `Conversation`, `ConversationParticipant`, `Message`
- Add Kafka consumer group for `FriendshipCacheService` and `ChatGateway`

`apps/api-gateway` changes:

- Remove `messages` entry from `serviceMap` in `gateway.controller.ts`
- Remove `MESSAGE_SERVICE_URL` from env config

### 2.6 Files to Create / Modify in Phase 2

```
apps/chat-service/src/domain/entities/conversation.entity.ts                             — create
apps/chat-service/src/domain/entities/message.entity.ts                                  — create
apps/chat-service/src/application/ports/conversation.repository.ts                       — create
apps/chat-service/src/application/ports/message.repository.ts                            — create
apps/chat-service/src/application/ports/conversation-participant.repository.ts           — create
apps/chat-service/src/application/ports/friendship-verifier.port.ts                     — create
apps/chat-service/src/application/dto/conversation.dto.ts                               — create
apps/chat-service/src/application/dto/message.dto.ts                                    — create
apps/chat-service/src/application/use-cases/create-or-get-conversation.use-case.ts      — create
apps/chat-service/src/application/use-cases/get-conversation.use-case.ts                — create
apps/chat-service/src/application/use-cases/list-conversations.use-case.ts              — create
apps/chat-service/src/application/use-cases/get-messages.use-case.ts                   — create
apps/chat-service/src/application/use-cases/send-message.use-case.ts                    — create
apps/chat-service/src/application/use-cases/edit-message.use-case.ts                   — create
apps/chat-service/src/application/use-cases/delete-message.use-case.ts                  — create
apps/chat-service/src/application/use-cases/mark-conversation-read.use-case.ts          — create
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-conversation.repository.ts              — create
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-message.repository.ts                 — create
apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-conversation-participant.repository.ts — create
apps/chat-service/src/infrastructure/cache/friendship-cache.service.ts                  — create
apps/chat-service/src/infrastructure/messaging/chat.gateway.ts                          — create
apps/chat-service/src/interfaces/controllers/conversation.controller.ts                 — create
apps/chat-service/src/chat.module.ts                                                    — create
apps/chat-service/src/app.module.ts                                                     — modify
apps/api-gateway/src/interfaces/controllers/gateway.controller.ts                       — modify (remove messages from serviceMap)
apps/message-service/                                                                   — DELETE entire directory
libs/openapi-specs/src/v1/message.yaml                                                  — DELETE
```

### 2.7 Test Cases

**Unit — chat-service** (`apps/chat-service/tests/unit/`):

- [ ] `create-or-get-conversation`: returns existing when one already exists
- [ ] `create-or-get-conversation`: creates new conversation when none exists
- [ ] `create-or-get-conversation`: throws `BadRequestException` when userId === targetUserId
- [ ] `create-or-get-conversation`: throws `ForbiddenException` when users are not friends
- [ ] `get-conversation`: throws `NotFoundException` when conversation not found
- [ ] `get-conversation`: throws `ForbiddenException` when requester is not a participant
- [ ] `send-message`: creates message and emits `message.sent.v1`
- [ ] `send-message`: throws `ForbiddenException` when requester is not a participant
- [ ] `send-message`: throws `BadRequestException` when content is empty
- [ ] `send-message`: does NOT emit Kafka event when repository throws
- [ ] `edit-message`: sets `isEdited: true` and updates content
- [ ] `edit-message`: throws `ForbiddenException` when requester is not the sender
- [ ] `edit-message`: throws `BadRequestException` when message is already deleted
- [ ] `delete-message`: sets `isDeleted: true`, replaces content with `[deleted]`
- [ ] `delete-message`: throws `ForbiddenException` when requester is not the sender
- [ ] `mark-conversation-read`: updates `lastReadAt` and emits `message.read.v1`
- [ ] `list-conversations`: includes correct `unreadCount` per conversation

Verify:

```bash
pnpm nx typecheck chat-service
pnpm nx lint chat-service
pnpm nx test chat-service
```

---

## Phase 3 — Frontend Implementation

**Goal**: Full chat UI wired to all backend endpoints.

### 3.1 Routes / Pages

| Route                    | File                                 | Purpose                                          |
| ------------------------ | ------------------------------------ | ------------------------------------------------ |
| `/chat`                  | `app/chat/page.tsx`                  | Two-pane layout: conversation list + empty state |
| `/chat/[conversationId]` | `app/chat/[conversationId]/page.tsx` | Active conversation: message thread + composer   |

The current `ChatDashboard.tsx` placeholder becomes the `EmptyConversationState` component shown in the right pane when no conversation is selected.

### 3.2 API Service (`src/features/chat/services/chat.service.ts`)

All methods use the shared `apiClient` (axios, `withCredentials: true`). Types come from `@shared-types` generated from `chat.yaml`.

```typescript
export const chatService = {
  listConversations(params?: { limit?: number; before?: string }): Promise<ConversationListResponse>
  createOrGetConversation(targetUserId: string): Promise<Conversation>
  getConversation(conversationId: string): Promise<Conversation>
  getMessages(conversationId: string, params?: { limit?: number; before?: string }): Promise<MessageListResponse>
  sendMessage(conversationId: string, content: string): Promise<Message>
  editMessage(conversationId: string, messageId: string, content: string): Promise<Message>
  deleteMessage(conversationId: string, messageId: string): Promise<Message>
  markRead(conversationId: string): Promise<{ lastReadAt: string }>
}
```

### 3.3 Hooks (`src/features/chat/hooks/useChat.ts`)

| Hook                    | TQ Type            | Query Key              | Cache behaviour                                         |
| ----------------------- | ------------------ | ---------------------- | ------------------------------------------------------- |
| `useConversations`      | `useInfiniteQuery` | `['conversations']`    | invalidate on `useSendMessage` success                  |
| `useConversation(id)`   | `useQuery`         | `['conversation', id]` | invalidate on `useMarkRead` success                     |
| `useMessages(id)`       | `useInfiniteQuery` | `['messages', id]`     | optimistic append on `useSendMessage`                   |
| `useCreateConversation` | `useMutation`      | —                      | invalidate `['conversations']` on success               |
| `useSendMessage(id)`    | `useMutation`      | —                      | optimistic update + rollback on error                   |
| `useEditMessage(id)`    | `useMutation`      | —                      | update `['messages', id]` cache in place                |
| `useDeleteMessage(id)`  | `useMutation`      | —                      | update `['messages', id]` cache in place                |
| `useMarkRead(id)`       | `useMutation`      | —                      | invalidate `['conversation', id]` + `['conversations']` |

`useSendMessage` must implement an **optimistic update**: append the pending message to `['messages', id]` immediately and rollback using the `onMutate` context on error.

### 3.4 Zustand Store (`src/features/chat/store/useChatStore.ts`)

| Field                   | Type                                             | Purpose                                                  |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| `activeConversationId`  | `string / null`                                  | Which conversation is open in the right pane             |
| `setActiveConversation` | `(id: string / null) => void`                    | Set active conversation                                  |
| `draftMessages`         | `Record<string, string>`                         | Per-conversation composer drafts (survives tab switches) |
| `setDraft`              | `(conversationId: string, text: string) => void` | Update draft                                             |

### 3.5 Components (`src/features/chat/components/`)

| Component                | Props                                   | Responsibility                                                                         |
| ------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------- |
| `ChatLayout`             | —                                       | Two-pane layout wrapper                                                                |
| `ConversationSidebar`    | —                                       | Renders list, handles selection via `useChatStore`                                     |
| `ConversationList`       | `conversations`, `activeId`, `onSelect` | `ConversationItem` list with infinite scroll trigger                                   |
| `ConversationItem`       | `conversation`, `isActive`, `onClick`   | Avatar, name, last message preview, unread badge, timestamp                            |
| `ConversationView`       | `conversationId`                        | Full message thread + composer                                                         |
| `ConversationHeader`     | `conversation`                          | Participant name, avatar, online dot (from presence socket)                            |
| `MessageList`            | `messages`, `onLoadMore`, `hasMore`     | Renders bubbles; auto-scrolls to bottom on new message                                 |
| `MessageBubble`          | `message`, `isMine`                     | Content, timestamp, status; edit/delete menu when `isMine`; tombstone when `isDeleted` |
| `MessageComposer`        | `conversationId`                        | Textarea + send button; reads/writes draft from `useChatStore`                         |
| `EmptyConversationState` | —                                       | Right-pane placeholder (replaces `ChatDashboard`)                                      |

### 3.6 Real-Time Updates

Extend the existing `usePresence` hook to listen for `message.new` Socket.IO events emitted by chat-service after `SendMessageUseCase` persists the message:

```typescript
socket.on('message.new', (data: { conversationId: string; message: Message }) => {
  // Prepend to first page of messages cache
  queryClient.setQueryData(['messages', data.conversationId], ...);
  // Refresh conversation list order/unread counts
  queryClient.invalidateQueries({ queryKey: ['conversations'] });
});
```

### 3.7 Files to Create / Modify in Phase 3

```
apps/frontend/app/chat/page.tsx                                              — replace placeholder
apps/frontend/app/chat/[conversationId]/page.tsx                             — create
apps/frontend/src/features/chat/services/chat.service.ts                     — create
apps/frontend/src/features/chat/hooks/useChat.ts                             — create
apps/frontend/src/features/chat/store/useChatStore.ts                        — create
apps/frontend/src/features/chat/components/ChatLayout.tsx                    — create
apps/frontend/src/features/chat/components/ConversationSidebar.tsx           — create
apps/frontend/src/features/chat/components/ConversationList.tsx              — create
apps/frontend/src/features/chat/components/ConversationItem.tsx              — create
apps/frontend/src/features/chat/components/ConversationView.tsx              — create
apps/frontend/src/features/chat/components/ConversationHeader.tsx            — create
apps/frontend/src/features/chat/components/MessageList.tsx                   — create
apps/frontend/src/features/chat/components/MessageBubble.tsx                 — create
apps/frontend/src/features/chat/components/MessageComposer.tsx               — create
apps/frontend/src/features/chat/components/EmptyConversationState.tsx        — replace ChatDashboard
apps/frontend/src/features/friends/components/FriendCard.tsx                 — modify (add Message button)
apps/frontend/src/features/friends/hooks/usePresence.ts                      — modify (add message.new listener)
```

### 3.8 Test Cases

**Hook tests**:

- [ ] `useConversations`: returns paginated list and exposes `fetchNextPage`
- [ ] `useSendMessage`: optimistically appends message before request resolves
- [ ] `useSendMessage`: rolls back optimistic update on request failure
- [ ] `useSendMessage`: invalidates `['conversations']` on success
- [ ] `useMarkRead`: invalidates `['conversation', id]` and `['conversations']` on success

**Component tests**:

- [ ] `MessageComposer`: send button disabled when textarea is empty
- [ ] `MessageComposer`: calls `useSendMessage` with trimmed content on submit
- [ ] `MessageComposer`: clears input after successful send
- [ ] `MessageBubble`: shows edit/delete menu only when `isMine: true`
- [ ] `MessageBubble`: renders `[deleted]` tombstone when `isDeleted: true`, hides edit/delete
- [ ] `MessageBubble`: shows `(edited)` label when `isEdited: true`
- [ ] `ConversationItem`: renders unread badge when `unreadCount > 0`
- [ ] `ConversationItem`: no badge when `unreadCount === 0`
- [ ] `ConversationList`: renders `EmptyConversationState` when list is empty

Verify:

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Decisions & Resolved Questions

| #   | Question             | Decision                                                 | Rationale                                                                                                                                      |
| --- | -------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Friendship check     | Event-driven Redis cache in chat-service                 | O(1) lookup, no cross-service HTTP on hot path, survives user-service downtime, scales to millions                                             |
| Q2  | Real-time fan-out    | Dedicated `ChatGateway` consuming Kafka                  | Use case stays pure, WebSocket servers scale independently, Kafka buffers failures, all consumers (archive, notify, realtime) decouple cleanly |
| Q3  | message-service role | **Removed entirely (Option C)**                          | No concrete requirement today; adds infra cost for zero current benefit; reintroduce as a search/analytics service when actually needed        |
| Q4  | Message deletion UX  | Both participants see `[deleted]` tombstone in real time | `DeleteMessageUseCase` replaces content in DB, emits `message.deleted.v1`; `ChatGateway` fans out to conversation room                         |
| Q5  | WebSocket routing    | Route through API Gateway in production                  | Single origin for all client traffic; Gateway handles WebSocket upgrade via `http-proxy-middleware` or nginx upstream                          |

### Future: search & analytics service

When full-text message search or analytics become a real requirement, introduce a dedicated `search-service` that:

- Consumes `message.sent.v1`, `message.edited.v1`, `message.deleted.v1` from Kafka
- Indexes into Elasticsearch or MongoDB Atlas Search
- Exposes `GET /api/v1/search/messages?q=&conversationId=`

This is cleaner than resurrecting message-service because the responsibility is explicit (search, not archive) and the data store (Elasticsearch) matches the use case.
