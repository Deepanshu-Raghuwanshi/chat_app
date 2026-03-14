# auth-service: Authentication Implementation
## Production-Hardened Edition — March 2026

---

## 1. Core Principles & Identity Strategy

- **Universal User ID**: Every user is uniquely identified by a UUID generated exclusively by the `auth-service`.
- **Identity Consistency**: This Universal ID is propagated via Kafka events and must be stored consistently across all downstream services (`user-service`, `chat-service`, `message-service`) in their `userId` field to maintain a single identity across boundaries.
- **Authority**: `auth-service` is the ONLY service permitted to generate user UUIDs. No service may create its own user identity.

---

## 2. Prisma Schema

### `apps/auth-service/prisma/schema.prisma`

```prisma
enum AuthProvider {
  LOCAL
  GOOGLE
}

model User {
  id             String        @id @default(uuid())
  email          String        @unique
  password       String?       // Nullable for OAuth users
  provider       AuthProvider  @default(LOCAL)
  googleId       String?       @unique
  isVerified     Boolean       @default(false)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  refreshTokens  RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model EmailVerification {
  id        String   @id @default(uuid())
  userId    String   @unique
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## 3. Implementation Details

### 3.1 Rate Limiting
Apply `@nestjs/throttler` globally and specifically to auth endpoints:
- Global: 100 requests / minute per IP
- `POST /auth/login`: 10 requests / minute
- `POST /auth/register`: 5 requests / minute
- `POST /auth/refresh`: 20 requests / minute

### 3.2 Dual-Token Strategy
- **Access Token (JWT)**: HttpOnly cookie, 15-minute expiry.
- **Refresh Token (opaque)**: HttpOnly cookie, 7-day expiry.
- **Token Rotation**: Refresh tokens are invalidated upon use and a new one is issued.

### 3.3 Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/register` | POST | Register + send verification email. Returns 201. |
| `/api/v1/auth/verify-email` | GET | Verify email via token. Sets `isVerified=true`. |
| `/api/v1/auth/login` | POST | Validates credentials + `isVerified`. Sets access + refresh cookies. |
| `/api/v1/auth/refresh` | POST | Rotates refresh token. Issues new access token cookie. |
| `/api/v1/auth/logout` | POST | Clears cookies + invalidates refresh token in DB. |
| `/api/v1/auth/google` | GET | Redirects to Google OAuth consent screen. |
| `/api/v1/auth/google/callback` | GET | Handles Google callback. Sets cookies. Redirects to frontend. |

### 3.4 Email Verification Flow
- User registers via `POST /auth/register`.
- `auth-service` creates user with `isVerified=false` and stores `EmailVerification` record (24h expiry).
- `auth-service` sends email with link: `https://myapp.com/verify-email?token=<UUID>`.
- User clicks link — frontend calls `GET /api/v1/auth/verify-email?token=<UUID>`.
- `auth-service` validates token, sets `isVerified=true`.

---

## 4. Kafka Events
Emit to topic: `user.created.v1`
```json
{
  "userId": "string",
  "email": "string",
  "provider": "LOCAL | GOOGLE",
  "isVerified": "boolean",
  "createdAt": "string"
}
```

---

## 5. Security Checklist
- HttpOnly + Secure + SameSite=strict cookies.
- Refresh token rotation.
- Rate limiting on login/register/refresh.
- Email verification before login.
- Password hashing with bcrypt (cost >= 12).
