# Presence System Implementation Plan: Online/Offline Status

This document outlines the phased development and testing strategy for implementing real-time user presence (online/offline status) in the chat application's friends list.

## Overview
The goal is to show a visual indicator (green/red dot) for each friend's online status. We will use **WebSockets (Socket.io)** for real-time updates and **Redis** for high-performance, volatile status storage.

---

## Phase 1: Infrastructure & Contracts
**Goal**: Define the data models and ensure all services agree on the communication protocol.

### 1.1 OpenAPI Contract Update
- **File**: `libs/openapi-specs/src/v1/user.yaml`
- **Action**: Add `isOnline` boolean property to the `UserProfile` schema (used in `/friends` and `/users/{userId}`).
- **Task**: Run `pnpm generate:types` to propagate changes.

### 1.2 Kafka Event Definition
- **File**: `libs/kafka-events/src/v1/user-events.ts`
- **Action**: Add `UserPresenceUpdatedEventV1` with `userId` and `status` ('ONLINE' | 'OFFLINE').
- **Topic**: `user.presence.updated.v1`.

### 1.3 Redis Configuration
- Ensure `user-service` and `chat-service` have access to the Redis instance defined in `docker-compose.yml`.

---

## Phase 2: Backend Implementation (Presence Logic)
**Goal**: Track user connections and expose status via API.

### 2.1 Chat Service: Presence Gateway
- **Implementation**: Create `PresenceGateway` in `apps/chat-service/src/interfaces/gateways/`.
- **Logic**:
    - `handleConnection`: Verify JWT -> Set `presence:{userId}` to `ONLINE` in Redis -> Emit Kafka event.
    - `handleDisconnect`: Set `presence:{userId}` to `OFFLINE` (or remove) in Redis -> Emit Kafka event.
- **Heartbeat**: Implement a simple heartbeat/ping-pong to handle abrupt disconnections.

### 2.2 User Service: Status Integration
- **Implementation**: Update `GetFriendsUseCase` in `apps/user-service/src/application/use-cases/`.
- **Logic**:
    - Fetch friendships from DB.
    - Batch-fetch presence status from Redis for all friend IDs using `MGET`.
    - Inject `isOnline` status into the returned profile DTOs.

---

## Phase 3: Frontend Implementation (Real-time UI)
**Goal**: Connect to the Presence Gateway and update the UI dynamically.

### 3.1 Socket.io Integration
- **Setup**: Install `socket.io-client` in the workspace.
- **Service**: Create `apps/frontend/src/shared/services/socket.service.ts` to manage the singleton connection.
- **Hook**: Create `usePresence()` hook to listen for `presence.updated` events.

### 3.2 UI Components
- **FriendCard.tsx**: 
    - Add an absolute-positioned `div` (dot) on the avatar.
    - Style: `bg-green-500` (Online) vs `bg-gray-400` (Offline).
- **Store/Cache**: Use TanStack Query's `queryClient.setQueryData` to update the `['friends']` cache when a WebSocket event is received.

---

## Phase 4: Testing Strategy

### 4.1 Backend Testing
- **Unit Tests (`chat-service`)**:
    - Mock `Socket` and `RedisService`.
    - Verify `handleConnection` sets Redis key and emits Kafka event.
    - Verify `handleDisconnect` updates Redis.
- **Integration Tests (`user-service`)**:
    - Seed Redis with dummy presence data.
    - Call `/api/v1/friends` and verify `isOnline` matches seeded data.

### 4.2 Frontend Testing
- **Unit Tests (`FriendCard.spec.tsx`)**:
    - Test rendering with `isOnline: true` (verify green dot).
    - Test rendering with `isOnline: false` (verify gray/red dot).
- **Integration Tests (`useFriends.spec.ts`)**:
    - Mock the WebSocket client.
    - Trigger a fake `presence.updated` event.
    - Assert that the TanStack Query cache is updated correctly.

---

## Development Guidelines Checklist
- [ ] Follow **DDD** patterns (Ports/Use Cases in backend).
- [ ] Ensure **Strict Typing** (no `any`).
- [ ] Use **Zod** for environment validation (`REDIS_URL`).
- [ ] Add **pino** logs for connection/disconnection events.
- [ ] Run `pnpm check-all` before submitting.
