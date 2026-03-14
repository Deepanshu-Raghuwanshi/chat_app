# Frontend: Authentication Implementation
## Production-Hardened Edition — March 2026

---

## 1. Core Principles & Identity Strategy

- **Universal User ID**: Every user is uniquely identified by a UUID generated exclusively by the `auth-service`.
- **Identity Consistency**: This Universal ID is propagated via Kafka events and must be stored consistently across all downstream services (`user-service`, `chat-service`, `message-service`) in their `userId` field to maintain a single identity across boundaries.
- **Authority**: `auth-service` is the ONLY service permitted to generate user UUIDs. No service may create its own user identity.

---

## 2. Implementation Details

### 2.1 Auth Store (Zustand)
No token field in store; JWT lives in HttpOnly cookies.
```typescript
interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

### 2.2 Auth Service
- **`login(email, password)`**: `POST /api/v1/auth/login`.
- **`register(email, password)`**: `POST /api/v1/auth/register`.
- **`logout()`**: `POST /api/v1/auth/logout`.
- **`refreshTokens()`**: `POST /api/v1/auth/refresh` (silent).

All calls must include `withCredentials: true`.

### 2.3 Silent Refresh (Interceptor)
Create an interceptor that automatically calls `POST /auth/refresh` on 401 responses and retries the original request.

### 2.4 Next.js Middleware
Intercept requests to `/chat`, `/profile`, and `/settings`. Redirect to `/login` if no JWT is present.

### 2.5 UI/UX
- Use Tailwind CSS for styling.
- Handle error messages (invalid credentials, account exists).
- Redirect to login on signup success.
- Redirect to chat on login success.

---

## 3. Environment Variables
- `NEXT_PUBLIC_API_URL`: Base URL for the API Gateway.
