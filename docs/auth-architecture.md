# Global Authentication Architecture
## Production-Hardened Edition — March 2026

---

## 1. Core Principles & Identity Strategy

- **Universal User ID**: Every user is uniquely identified by a UUID generated exclusively by the `auth-service`.
- **Identity Consistency**: This Universal ID is propagated via Kafka events and must be stored consistently across all downstream services (`user-service`, `chat-service`, `message-service`) in their `userId` field to maintain a single identity across boundaries.
- **Authority**: `auth-service` is the ONLY service permitted to generate user UUIDs. No service may create its own user identity.

---

## 2. Component Roles

### 2.1 auth-service
- Source of truth for identity.
- Generates Universal User ID.
- Manages credentials (passwords, Google ID).
- Handles login, register, token rotation, and email verification.
- Emits `user.created.v1` event via Kafka.

### 2.2 user-service
- Manages user profiles (username, full name, avatar, bio).
- Consumes `user.created.v1` to create default profiles.
- Handles profile updates.

### 2.3 frontend
- Single Page Application (Next.js).
- Uses HttpOnly cookies for JWT storage.
- Implements silent refresh and route protection.

---

## 3. Communication

- **Frontend <-> API Gateway**: REST API (cookies included).
- **auth-service -> Kafka**: `USER_CREATED` events.
- **Kafka -> user-service**: `USER_CREATED` events.
- **Internal Service Communication**: Shared types generated from OpenAPI.

---

## 4. Security Highlights
- **JWT Storage**: HttpOnly cookies to mitigate XSS.
- **Refresh Tokens**: Rotating opaque tokens to mitigate session hijacking.
- **Email Verification**: Required for local registration to mitigate spam.
- **Rate Limiting**: Throttler on all auth endpoints to mitigate brute-force.
- **Universal ID**: Consistent identification across microservices.
