# Backend Spec Review: feat-chat — 2026-05-06

## Summary

### What Is Implemented

- All 8 REST endpoints from `chat.yaml` implemented in `ConversationController` with correct HTTP verbs, route paths, status codes, and guards
- Full DDD stack: 3 domain entities → 3 repository ports → 8 use cases → 3 Mongoose repositories
- `Conversation`, `ConversationParticipant`, and `Message` Mongoose schemas with all required indexes (unique compound index on participants, `lastActivityAt` DESC, `conversationId + createdAt` DESC)
- Cursor-based pagination implemented correctly in both `ListConversationsUseCase` and `GetMessagesUseCase` (limit+1 probe, `nextCursor` set to last item ID)
- `ConversationViewBuilder` correctly computes `unreadCount` and enriches each conversation with participant presence/read state
- `FriendshipCacheService` consumes `friend.request.accepted.v1` and writes O(1) Redis keys; implements `FriendshipVerifier` port
- `ChatGateway` consumes `message.sent.v1`, `message.edited.v1`, `message.deleted.v1` and fans out via `PresenceGateway.emitToRoom()`
- `KafkaProducerService` wraps raw kafkajs producer; `ChatTopics` enum used consistently (no hardcoded strings)
- All 4 Kafka events emit the correct payload interfaces from `@kafka-events` using `satisfies` for compile-time safety
- `ChatModule` registers all providers, repositories, and the controller cleanly
- `AppModule` imports `RedisModule` (global) and `ChatModule`; env vars validated via Zod
- API Gateway already routes `chat` prefix to `CHAT_SERVICE_URL`; no `messages` entry existed so no change was needed
- 7 unit test files covering 25 test cases; all pass in 48ms
- Entity pattern matches `FriendRequest` reference (Props interface, private props, typed getters, static `create()`)
- Use case pattern matches `SendFriendRequest` reference (`@Injectable`, `@Inject('Token')`, `execute(dto)`, NestJS exceptions)
- Controller pattern matches `UserController` reference (`@ApiTags`, `@ApiBearerAuth`, `@UseGuards` at class level, `@ApiOperation`/`@ApiResponse` on every method)

### What Is Pending / Incomplete

- `get-messages.use-case.spec.ts` does not exist — `GetMessagesUseCase` has no unit tests
- `EditMessageUseCase` and `DeleteMessageUseCase` receive a `conversationId` from the route but never validate that the target message actually belongs to that conversation
- The requesting user's participant record is created with `username: userId` (the UUID string) rather than their actual username — their display name in conversation lists will be their UUID
- `CreateConversationDto` exposes three undocumented optional fields (`targetUsername`, `targetFullName`, `targetAvatarUrl`) not present in `chat.yaml` — frontend generated types from `@shared-types` won't know these exist
- `message-service` directory and `libs/openapi-specs/src/v1/message.yaml` deletion (Phase 1 tasks) are not included in this branch

---

## Automated Checks

| Check                              | Result    | Notes                          |
| ---------------------------------- | --------- | ------------------------------ |
| `pnpm nx typecheck chat-service`   | ✅ Pass   | No type errors                 |
| `pnpm nx lint chat-service`        | ✅ Pass   | All files pass linting         |
| `pnpm nx format:check chat-service`| ✅ Pass   | No formatting issues           |
| `pnpm nx test chat-service`        | ✅ Pass   | 25 passing, 0 failing (48ms)   |

---

## Files Changed

| File | Type | Description |
| ---- | ---- | ----------- |
| `apps/chat-service/project.json` | Modified | Added `test` executor with mocha + ts-node |
| `apps/chat-service/src/app.module.ts` | Modified | Imports `RedisModule`, `ChatModule`; registers `ChatGateway` |
| `apps/chat-service/src/chat.module.ts` | Added | Wires all repositories, use cases, and controller |
| `apps/chat-service/src/domain/entities/conversation.entity.ts` | Added | `ConversationEntity` with `LastMessageSnapshot` |
| `apps/chat-service/src/domain/entities/conversation-participant.entity.ts` | Added | `ConversationParticipantEntity` with username/avatar fields |
| `apps/chat-service/src/domain/entities/message.entity.ts` | Added | `MessageEntity` |
| `apps/chat-service/src/application/ports/conversation.repository.ts` | Added | Port interface + input types |
| `apps/chat-service/src/application/ports/conversation-participant.repository.ts` | Added | Port interface + input types |
| `apps/chat-service/src/application/ports/message.repository.ts` | Added | Port interface + `countUnread` method |
| `apps/chat-service/src/application/ports/friendship-verifier.port.ts` | Added | `FriendshipVerifier` interface |
| `apps/chat-service/src/application/dto/conversation.dto.ts` | Added | `CreateConversationDto`, `ListConversationsQueryDto` |
| `apps/chat-service/src/application/dto/message.dto.ts` | Added | `SendMessageDto`, `EditMessageDto`, `GetMessagesQueryDto` |
| `apps/chat-service/src/application/interfaces/conversation-view.interface.ts` | Added | View types for API responses |
| `apps/chat-service/src/application/services/conversation-view.builder.ts` | Added | Enriches conversation entities with presence + unread count |
| `apps/chat-service/src/application/use-cases/create-or-get-conversation.use-case.ts` | Added | Idempotent conversation creation with friendship check |
| `apps/chat-service/src/application/use-cases/get-conversation.use-case.ts` | Added | Participant-gated single conversation fetch |
| `apps/chat-service/src/application/use-cases/list-conversations.use-case.ts` | Added | Cursor-paginated conversation list |
| `apps/chat-service/src/application/use-cases/get-messages.use-case.ts` | Added | Cursor-paginated message list |
| `apps/chat-service/src/application/use-cases/send-message.use-case.ts` | Added | Persists message and emits `message.sent.v1` |
| `apps/chat-service/src/application/use-cases/edit-message.use-case.ts` | Added | Sender-only edit, emits `message.edited.v1` |
| `apps/chat-service/src/application/use-cases/delete-message.use-case.ts` | Added | Sender-only soft-delete, emits `message.deleted.v1` |
| `apps/chat-service/src/application/use-cases/mark-conversation-read.use-case.ts` | Added | Updates read cursor, emits `message.read.v1` |
| `apps/chat-service/src/infrastructure/cache/redis.module.ts` | Added | Global `RedisModule` exporting `RedisService` |
| `apps/chat-service/src/infrastructure/cache/redis.service.ts` | Added | Wraps `redis` client with lifecycle hooks |
| `apps/chat-service/src/infrastructure/cache/redis-presence.repository.ts` | Modified | Now uses injected `RedisService` instead of ad-hoc client |
| `apps/chat-service/src/infrastructure/cache/friendship-cache.service.ts` | Added | Kafka consumer + Redis O(1) friendship lookup |
| `apps/chat-service/src/infrastructure/guards/jwt-auth.guard.ts` | Added | Thin `AuthGuard('jwt')` wrapper |
| `apps/chat-service/src/infrastructure/messaging/kafka-producer.service.ts` | Added | Raw kafkajs producer with lifecycle hooks |
| `apps/chat-service/src/infrastructure/messaging/chat.gateway.ts` | Added | Kafka consumer fan-out to Socket.IO rooms |
| `apps/chat-service/src/infrastructure/persistence/mongoose/schemas/conversation.schema.ts` | Modified | Replaced old schema with new DM conversation schema |
| `apps/chat-service/src/infrastructure/persistence/mongoose/schemas/conversation-participant.schema.ts` | Modified | Replaced old schema; added username/avatar fields |
| `apps/chat-service/src/infrastructure/persistence/mongoose/schemas/message.schema.ts` | Modified | Uses `MessageType`/`MessageStatus` enums from `@kafka-events` |
| `apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-conversation.repository.ts` | Added | `ConversationRepository` implementation |
| `apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-conversation-participant.repository.ts` | Added | `ConversationParticipantRepository` implementation |
| `apps/chat-service/src/infrastructure/persistence/mongoose/mongoose-message.repository.ts` | Added | `MessageRepository` implementation with `countUnread` |
| `apps/chat-service/src/interfaces/controllers/conversation.controller.ts` | Added | All 8 endpoints; dynamic 200/201 for POST /conversations |
| `apps/chat-service/src/interfaces/gateways/presence.gateway.ts` | Modified | Added `emitToRoom()` helper for `ChatGateway` fan-out |
| `apps/chat-service/tests/unit/create-or-get-conversation.use-case.spec.ts` | Added | 4 tests: self-message, not friends, existing, new |
| `apps/chat-service/tests/unit/get-conversation.use-case.spec.ts` | Added | 3 tests: success, not found, not participant |
| `apps/chat-service/tests/unit/list-conversations.use-case.spec.ts` | Added | 3 tests: unreadCount, hasMore=true, hasMore=false |
| `apps/chat-service/tests/unit/send-message.use-case.spec.ts` | Added | 5 tests: success, empty, not found, not participant, no Kafka on DB fail |
| `apps/chat-service/tests/unit/edit-message.use-case.spec.ts` | Added | 4 tests: success, not found, not sender, already deleted |
| `apps/chat-service/tests/unit/delete-message.use-case.spec.ts` | Added | 3 tests: success, not found, not sender |
| `apps/chat-service/tests/unit/mark-conversation-read.use-case.spec.ts` | Added | 3 tests: success, not found, not participant |
| `tsconfig.base.json` | Modified | Path alias changes (inspect if any `@kafka-events` path adjusted) |

---

## Blockers — Must Fix

> Breaks functionality, violates security, missing tests, or violates architecture. Cannot merge until resolved.

- **`apps/chat-service/tests/unit/get-messages.use-case.spec.ts`** — File does not exist. `GetMessagesUseCase` is fully implemented but has zero test coverage. The spec explicitly requires tests for: (a) requester must be participant, (b) throws `NotFoundException` when conversation not found, (c) throws `ForbiddenException` when not a participant, (d) cursor pagination returns correct `hasMore` and `nextCursor`. Create this file following the identical describe/it + Chai + sinon pattern used by the other 7 test files.

- **`apps/chat-service/src/application/use-cases/edit-message.use-case.ts:29`** — `conversationId` is accepted from the DTO (coming from the route param `/:conversationId/messages/:messageId`) but is never validated. The use case only checks `message.senderId === userId`, which means a user who authored message A in conversation X can successfully call `PATCH /chat/conversations/Y/messages/A` and edit it — the URL's conversation context is silently ignored. Fix: after fetching the message, add `if (message.conversationId !== dto.conversationId) throw new NotFoundException('Message not found');` to bind the message to the conversation claimed in the URL.

- **`apps/chat-service/src/application/use-cases/delete-message.use-case.ts:27`** — Same `conversationId` mismatch issue as `EditMessageUseCase`. The URL param `conversationId` is received in the DTO but never used. A user can soft-delete their own message from any conversation using any valid conversation URL as the path prefix. Apply the same fix: validate `message.conversationId === dto.conversationId` before proceeding.

---

## Nitpicks — Should Fix

> Non-blocking: style, minor conventions, small improvements.

- **`apps/chat-service/src/application/use-cases/create-or-get-conversation.use-case.ts:81`** — The requesting user's participant record is created with `username: userId` (the UUID string as the display name). When the conversation view is built and returned to the client, the requester will appear with their UUID as their username. The fix is to have the caller pass their own username in the DTO alongside the target's profile hints (e.g., `callerUsername?: string`) and fall back to the UUID only when absent — the same pattern already used for `targetUsername`.

- **`apps/chat-service/src/application/dto/conversation.dto.ts:13-26`** — `CreateConversationDto` exposes `targetUsername`, `targetFullName`, and `targetAvatarUrl` which are not defined in `libs/openapi-specs/src/v1/chat.yaml`'s `CreateConversationDto` schema. This means the `@shared-types` generated type doesn't include these fields, so typed frontend code won't know to pass them. Either add these three optional fields to `chat.yaml` and re-run `pnpm generate:types`, or document them as a non-contract extension.

- **`apps/chat-service/src/app.module.ts:76`** — `ChatGateway` is registered as a provider in `AppModule` but `PresenceGateway` is also in `AppModule`. `ChatGateway` depends on `PresenceGateway` (it calls `presenceGateway.emitToRoom()`). This is fine architecturally but means `ChatGateway` is fully wired at the `AppModule` level, not inside `ChatModule`. Moving it into `ChatModule` (and exporting what's needed) would keep the module boundaries cleaner.

- **`apps/chat-service/src/infrastructure/messaging/chat.gateway.ts:68`** — `fanOut` uses `payload as MessageSentEventV1` (and similar casts for other topics). These are unsafe casts on a `JSON.parse` result. Since malformed Kafka messages won't be caught here, a schema validation step (e.g., checking for required fields) or at minimum a type narrowing guard would make this more robust.

- **`apps/chat-service/src/interfaces/controllers/conversation.controller.ts:44-46`** — `RequestWithUser` is defined locally as `{ user: { id: string; email: string } }`. The same pattern is duplicated across other services. Consider extracting to a shared `libs/` type so all services use an identical definition.

- **`apps/chat-service/src/chat.module.ts:83-86`** — `PresenceRepository` is registered in both `ChatModule` (for `ConversationViewBuilder`) and `AppModule` (for `PresenceGateway`). Two separate `RedisPresenceRepository` instances are created. Because `RedisModule` is global, they share the same `RedisService`, so behaviour is identical. But it's redundant: export `PresenceRepository` from `ChatModule` or use the `AppModule` binding for both.

---

## Verdict

**Needs changes**

The implementation is comprehensive and well-structured — all 8 endpoints are present, DDD layering is correct, Kafka conventions are followed, all automated checks pass, and 25 of 26 required test cases exist. Two of the three blockers are security bugs: `EditMessageUseCase` and `DeleteMessageUseCase` accept a `conversationId` route parameter but silently ignore it in their logic, meaning a user can edit or delete their own messages through any conversation URL. This is incorrect URL-to-resource binding. The third blocker is a missing test file for `GetMessagesUseCase`. Once these three items are fixed, the implementation will be merge-ready with high confidence.
