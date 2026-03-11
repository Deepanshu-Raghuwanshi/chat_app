# user-service: User Profile Implementation
## Production-Hardened Edition — March 2026

---

## 1. Core Principles & Identity Strategy

- **Universal User ID**: Every user is uniquely identified by a UUID generated exclusively by the `auth-service`.
- **Identity Consistency**: This Universal ID is propagated via Kafka events and must be stored consistently across all downstream services (`user-service`, `chat-service`, `message-service`) in their `userId` field to maintain a single identity across boundaries.
- **Authority**: `auth-service` is the ONLY service permitted to generate user UUIDs. No service may create its own user identity.

---

## 2. Prisma Schema

### `apps/user-service/prisma/schema.prisma`

```prisma
model UserProfile {
  id        String   @id // Universal User ID from auth-service
  username  String   @unique
  fullName  String?
  avatarUrl String?
  bio       String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 3. Implementation Details

### 3.1 Kafka Consumer — USER_CREATED
Listen to `user.created.v1` topic. On receipt:
- Check if `UserProfile` already exists for this `userId` (idempotency guard).
- If not: create default `UserProfile` with `userId` as the primary key.
- If `isVerified=false`: create profile but mark it as pending (optional enhancement).

### 3.2 Profile API
| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/profile` | GET | Fetch own profile. Extracts `userId` from cookie. |
| `/api/v1/profile` | PATCH | Update `fullName`, `avatarUrl`, `bio`. |

---

## 4. Security Considerations
- The `user-service` `JwtStrategy` reads from the HttpOnly `access_token` cookie.
- Ensure `cookie-parser` middleware is configured.
- Idempotency guard on `USER_CREATED` consumption.
