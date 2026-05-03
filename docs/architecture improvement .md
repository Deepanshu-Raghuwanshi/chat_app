# Chat App — Complete Architecture Document
## Updated: May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Microservices](#4-microservices)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Data Layer](#6-data-layer)
7. [Communication Patterns](#7-communication-patterns)
8. [Shared Libraries](#8-shared-libraries)
9. [Security Model](#9-security-model)
10. [Infrastructure & DevOps](#10-infrastructure--devops)
11. [What Is Working Well](#11-what-is-working-well)
12. [Improvements & Gaps](#12-improvements--gaps)

---

## 1. System Overview

**chat-system** is a production-grade real-time chat application built as a **microservices monorepo**. It follows Domain-Driven Design (DDD) and a contract-first API approach. All backend services are independently deployable NestJS applications coordinated via an API Gateway. The frontend is a Next.js 15 app using App Router.

**Key properties:**
- Contract-first: OpenAPI specs define the API before code is written
- Event-driven: Services communicate asynchronously via Kafka
- Strict DDD layers: domain → application → infrastructure → interfaces
- Type-safe: Shared types auto-generated from OpenAPI specs
- Security-first: HttpOnly cookies, rotating refresh tokens, rate limiting

**Tech snapshot:**

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11 |
| Frontend framework | Next.js 15 (App Router) |
| Language | TypeScript 5.9 (strict) |
| Build / monorepo | Nx 22, pnpm 9 |
| Relational DB | PostgreSQL 15 + Prisma 7 |
| Document DB | MongoDB 6 + Mongoose 9 |
| Cache / sessions | Redis 7 |
| Message broker | Apache Kafka 3.7 (KRaft) |
| Real-time | Socket.IO 4 |
| File storage | Cloudinary |
| Logging | Pino 10 (structured JSON) |
| Validation | Zod 4 |
| Testing (backend) | Jest 30 |
| Testing (frontend) | Vitest 4 + React Testing Library |
| CSS | Tailwind CSS 4 |

---

## 2. Repository Structure

```
chat_app/
├── apps/
│   ├── api-gateway/          # Unified entry point  (port 3000)
│   ├── auth-service/         # Identity & JWT        (port 3001)
│   ├── user-service/         # Profiles & friends    (port 3002)
│   ├── chat-service/         # Rooms & WebSocket     (port 3003)
│   ├── message-service/      # Message persistence   (port 3004)
│   ├── notification-service/ # Async notifications   (port 3005)
│   └── frontend/             # Next.js client        (port 4200)
│
├── libs/
│   ├── openapi-specs/        # YAML contract files (source of truth)
│   ├── shared-types/         # TS types auto-generated from OpenAPI
│   ├── kafka-events/         # Event contracts & topic constants
│   ├── shared-config/        # Config utilities
│   ├── shared-logger/        # Pino structured logging
│   ├── shared-validation/    # Zod env-var schemas + NestJS pipes
│   └── shared-exceptions/    # GlobalExceptionFilter, custom errors
│
├── docs/
│   ├── architecture.md       # This document
│   └── auth-architecture.md  # Auth-specific deep-dive
│
├── docker-compose.yml        # Local infra (Postgres, Mongo, Redis, Kafka)
├── .github/workflows/ci.yml  # GitHub Actions CI
└── package.json              # Root scripts (pnpm workspaces)
```

Each backend service follows this internal layering:

```
src/
├── domain/           # Entities, value objects, domain services (no deps)
├── application/      # Use cases + ports (interfaces for external deps)
├── infrastructure/   # Prisma/Mongoose repos, Kafka producers, Redis, Cloudinary
└── interfaces/       # NestJS controllers, WebSocket gateways
```

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser / Client                          │
│                       Next.js 15 (port 4200)                        │
│         Zustand (local state) + TanStack Query (server state)       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTP (REST + cookies)
                               │  WebSocket (/presence namespace)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API Gateway (port 3000)                     │
│           NestJS  —  Reverse Proxy via Axios + serviceMap           │
│                         /api/v1/* → services                        │
└──────┬────────────┬────────────┬────────────┬──────────────────────┘
       │            │            │            │
  /auth/*      /user/*      /chat/*     /message/*
       │            │            │            │
       ▼            ▼            ▼            ▼
┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────────┐  ┌─────────────────┐
│  auth-   │  │  user-   │ │  chat-   │ │  message-    │  │ notification-   │
│ service  │  │ service  │ │ service  │ │  service     │  │   service       │
│ :3001    │  │ :3002    │ │ :3003    │ │  :3004       │  │   :3005         │
│          │  │          │ │          │ │              │  │                 │
│PostgreSQL│  │PostgreSQL│ │ MongoDB  │ │  MongoDB     │  │  (Redis cache)  │
│ (Prisma) │  │ (Prisma) │ │(Mongoose)│ │ (Mongoose)   │  │                 │
└────┬─────┘  └────┬─────┘ └────┬─────┘ └──────────────┘  └─────────────────┘
     │              │            │
     └──────────────┴────────────┘
                    │
                    ▼
     ┌──────────────────────────────┐
     │       Apache Kafka           │
     │  (KRaft, no Zookeeper)       │
     │                              │
     │  Topics (versioned .v1):     │
     │  • user.created              │
     │  • user.updated              │
     │  • user.presence.updated     │
     │  • friend.request.sent       │
     │  • friend.request.accepted   │
     └──────────────────────────────┘

     ┌──────────────────────────────┐
     │           Redis              │
     │  • JWT refresh token cache   │
     │  • User presence state       │
     │  • Socket.IO adapter         │
     └──────────────────────────────┘
```

---

## 4. Microservices

### 4.1 API Gateway (port 3000)

**Responsibility:** Single entry point for all client requests. Routes HTTP traffic to the correct downstream service by extracting the service name from the URL path (`/api/v1/<service>/...`).

**Key design decisions:**
- Uses Axios for proxying, forwarding cookies and all headers
- Aggregates Swagger docs at `/api/docs`
- Enforces CORS (only allows requests from `FRONTEND_URL`)
- Body size limit: 50 MB (supports file upload flows)
- No business logic — pure routing

**Improvement opportunity:** The gateway currently proxies blindly without authentication verification. Adding a lightweight JWT check at the gateway level would centralize auth enforcement and protect downstream services even if they omit validation.

---

### 4.2 Auth Service (port 3001)

**Responsibility:** The sole source of user identity. Generates and owns all UUIDs. Manages credentials, tokens, and email flows.

**Database:** PostgreSQL (`auth` schema via Prisma)

**Models:**
- `User` — email, hashed password, OAuth provider, Google ID, verification status
- `RefreshToken` — rotating opaque tokens (7-day TTL)
- `EmailVerification` — one-time tokens for email confirmation
- `PasswordReset` — time-limited reset tokens (30-min TTL)
- `EmailChange` — verification tokens for email address changes

**Token strategy:**
- Access token: 15-min JWT stored in HttpOnly cookie
- Refresh token: 7-day opaque token, rotated on every use (stored in DB + HttpOnly cookie)

**Auth flows:**
1. Local register → send verification email → user confirms → can log in
2. Local login → issue access + refresh tokens
3. Refresh → validate opaque token → rotate and issue new pair
4. Logout → invalidate refresh token in DB
5. Google OAuth → Passport Google strategy → callback → issue tokens
6. Password reset → email link → validate → update hash
7. Email change → verify current credentials → send confirmation to new address

**Events produced:**
- `user.created.v1` — on any successful registration (local or Google)
- `user.updated.v1` — on profile field changes

**Rate limits:** 5/min (register), 10/min (login), 20/min (refresh)

---

### 4.3 User Service (port 3002)

**Responsibility:** Manages public user profiles and the friend graph.

**Database:** PostgreSQL (`user_service` schema via Prisma)

**Models:**
- `UserProfile` — username, fullName, avatarUrl, bio, phoneNumber, countryCode, onlineStatus
- `FriendRequest` — senderId, receiverId, status (PENDING | ACCEPTED | REJECTED)
- `Friendship` — bidirectional record (userId1 < userId2 enforced for deduplication)

**Use cases:**
- Get own profile / get profile by ID
- Update profile fields
- Upload avatar (Cloudinary)
- Send / respond to friend requests
- List friends, incoming requests, outgoing requests
- Friend recommendations (suggested friends)

**Events consumed:** `user.created.v1` → automatically creates a default profile row

**External integrations:** Cloudinary (avatar storage), Redis (presence state read)

---

### 4.4 Chat Service (port 3003)

**Responsibility:** Room lifecycle management and real-time presence via WebSockets.

**Database:** MongoDB (`chat` database via Mongoose)

**Models:**
- `Room` — name, description, isGroup flag, createdBy, timestamps
- `Participant` — roomId, userId, role (owner | admin | member), joinedAt

**Real-time layer:**
- Socket.IO server on `/presence` namespace
- JWT extracted from WebSocket handshake for authentication
- Redis adapter enables horizontal scaling (multiple chat-service instances share socket state)
- Emits `user.presence.updated.v1` to Kafka when users go online/offline

**Improvement opportunity:** Room CRUD via HTTP is present, but WebSocket events for room membership changes (user added/removed) should also emit Kafka events so notification-service can alert members.

---

### 4.5 Message Service (port 3004)

**Responsibility:** Durable storage of all chat messages.

**Database:** MongoDB (`chat_messages` database via Mongoose)

**Models:**
- `Message` — roomId, senderId, content, type (text | image | file), metadata (JSON), isRead, timestamps
- Index: `{ roomId: 1, createdAt: -1 }` for efficient cursor-based pagination

**Improvement opportunity:** Message delivery acknowledgment and read receipts are stored but there is no Kafka event for `message.read.v1`. Adding this would let notification-service clear pending "unread" notifications and let the frontend update read states in real time without polling.

---

### 4.6 Notification Service (port 3005)

**Responsibility:** Asynchronous notification delivery (email alerts, push notifications) triggered by Kafka events.

**Database:** Redis (ephemeral notification state)

**Current state:** Service scaffold is in place but Kafka consumer handlers are minimal. This is the least mature service.

**Improvement opportunity:** Wire Kafka consumers for:
- `friend.request.sent.v1` → email/push to recipient
- `message.received.v1` → push notification when recipient is offline
- `user.presence.updated.v1` → notify friend list of status changes

---

## 5. Frontend Architecture

**Framework:** Next.js 15 with App Router (React 19)

**State management:**
- **Zustand** — ephemeral client state (auth user, UI flags)
- **TanStack Query v5** — all server state with caching, background refetch, and optimistic updates

**Structure (feature-based):**

```
src/
├── core/
│   └── providers/
│       └── TanstackProvider.tsx   # Query client + global interceptors
├── features/
│   ├── auth/
│   │   ├── components/            # LoginForm, SignupForm, VerifyEmail, etc.
│   │   ├── hooks/                 # useLogin, useLogout, useSignup, ...
│   │   ├── services/              # authService (axios), refresh interceptor
│   │   └── store/                 # useAuthStore (Zustand)
│   ├── chat/                      # Chat room UI, message list, composer
│   ├── friends/                   # Friend list, requests, recommendations
│   └── profile/                   # Profile view, edit form, avatar upload
└── shared/
    ├── components/                # Navbar, AnimatedBackground, shared UI
    └── utils/                     # Common helpers
```

**Routing (Next.js App Router pages):**

| Route | Purpose |
|---|---|
| `/login` | Login form |
| `/signup` | Registration form |
| `/forgot-password` | Initiate password reset |
| `/reset-password` | Complete password reset |
| `/verify-email` | Email verification callback |
| `/set-password` | Set password after OAuth signup |
| `/chat` | Main chat interface |
| `/friends` | Friends list and requests |
| `/profile/[id]` | Public profile view |
| `/auth/success` | OAuth redirect landing |

**Auth flow:**
1. Backend sets `access_token` + `refresh_token` as HttpOnly cookies on login
2. All Axios requests use `credentials: 'include'` to send cookies automatically
3. On any 401 response, the refresh interceptor silently calls `/auth/refresh`
4. Backend rotates tokens and sets new cookies; original request is retried
5. On refresh failure, user is redirected to `/login`

**Internationalization:** `next-intl` is integrated with translation files in `messages/`. Currently English. Ready to add more locales.

**Key libraries:**
- `axios` — HTTP client with interceptors
- `sonner` — toast notification system
- `lucide-react` — icon library
- `tailwind-merge` + `clsx` — conditional class utilities
- `react-hook-form` — form state (in auth components)

---

## 6. Data Layer

### 6.1 PostgreSQL

Used by auth-service and user-service. Both share the same PostgreSQL instance (`chat_db`) but are isolated in separate schemas (`auth`, `user_service`).

Each service generates its own Prisma client to a separate output path to avoid conflicts:
- Auth: `node_modules/@prisma/client-auth`
- User: `node_modules/@prisma/client-user`

### 6.2 MongoDB

Used by chat-service and message-service. Separate databases:
- `chat` — rooms and participants
- `chat_messages` — message documents

Mongoose models have appropriate compound indexes for query performance.

### 6.3 Redis

Shared by all services for:
- Refresh token validation cache (auth-service)
- User presence state (chat-service reads/writes)
- Socket.IO distributed adapter (chat-service)

### 6.4 Kafka Topics

All topics are versioned with `.v1` suffix to allow breaking-change evolution without disrupting consumers.

| Topic | Producer | Consumer(s) |
|---|---|---|
| `user.created.v1` | auth-service | user-service, notification-service |
| `user.updated.v1` | auth-service | user-service, notification-service |
| `user.presence.updated.v1` | chat-service | notification-service |
| `friend.request.sent.v1` | user-service | notification-service |
| `friend.request.accepted.v1` | user-service | notification-service |

**Consumer groups:**
- `user-service-group` — consumes user lifecycle events
- `notification-service-group` — consumes all events for alerting

---

## 7. Communication Patterns

### 7.1 Frontend → API Gateway

Plain HTTP/REST with cookies. All requests go to `http://localhost:3000/api/v1/*`. The frontend never talks to individual services directly.

### 7.2 API Gateway → Services

Axios-based reverse proxy. The gateway strips the `/api/v1/<service>` prefix and forwards to the matching service URL. Headers and cookies are forwarded.

```
/api/v1/auth/login    →  AUTH_SERVICE_URL/api/v1/auth/login
/api/v1/user/profile  →  USER_SERVICE_URL/api/v1/user/profile
```

### 7.3 Service → Service (Async, via Kafka)

Services do not call each other directly over HTTP. All cross-service side effects are event-driven via Kafka. This achieves:
- Temporal decoupling (consumer can be offline temporarily)
- No synchronous cascading failures
- Audit trail via Kafka topic retention

### 7.4 Real-Time (WebSocket)

The frontend connects a Socket.IO client to `chat-service` for presence updates. The connection passes through the API gateway or connects directly in development (this should be unified via the gateway in production).

---

## 8. Shared Libraries

### `libs/openapi-specs`
YAML files are the single source of truth for all API contracts. Services implement what the spec defines — not the other way around. This prevents contract drift between frontend and backend.

### `libs/shared-types`
TypeScript types are auto-generated from the OpenAPI YAML files using `openapi-typescript`. Both backend DTOs and frontend API call types derive from the same source, eliminating manual type duplication.

### `libs/kafka-events`
Central registry of Kafka topic name constants and TypeScript event payload interfaces. Any service that produces or consumes events imports from here. Topic names are never hardcoded in service code.

### `libs/shared-exceptions`
`GlobalExceptionFilter` is registered in every service's `main.ts`. Provides a consistent error response shape across the whole system:
```json
{ "statusCode": 400, "message": "Validation failed", "error": "Bad Request" }
```

### `libs/shared-logger`
Pino-based logger with `nestjs-pino` integration. Pretty-printed in development, plain JSON in production. All services use this instead of NestJS's built-in logger.

### `libs/shared-validation`
Zod schemas validate environment variables at process startup. If a required variable is missing or malformed, the service refuses to start with a clear error message.

### `libs/shared-config`
Reusable NestJS ConfigModule setup. Reduces boilerplate in each service's `AppModule`.

---

## 9. Security Model

### Authentication
- Access tokens are 15-minute JWTs stored in HttpOnly, SameSite=Strict cookies — immune to XSS token theft
- Refresh tokens are opaque, rotate on every use, and are stored hashed in the database
- A compromised refresh token is invalidated on the next legitimate use (rotation detects reuse)

### Authorization
- JWT payload carries the userId; controllers extract it from the validated token
- Friend and profile access is checked at the use-case layer within each service
- No service trusts another service's word about identity — all tokens flow from the client through the gateway

### Input Validation
- All HTTP request bodies are validated with Zod schemas before reaching use cases
- Environment variables are validated at startup — no undefined config silently propagates

### Endpoint Protection
- Rate limiting on all auth endpoints (5–20 req/min depending on sensitivity)
- Email verification required before a local account can authenticate
- Password reset tokens expire in 30 minutes

### Data Security
- Passwords are hashed (bcrypt) — never stored in plain text
- Sensitive fields are excluded from API responses via class-transformer decorators
- SMTP credentials and API secrets are loaded from environment variables, never committed

### Improvement opportunities
- Add request signing or mTLS between gateway and services (currently any process with network access can call services directly)
- Add input sanitization for message content to prevent stored XSS if HTML rendering is ever added
- Consider adding a Content Security Policy header at the gateway level

---

## 10. Infrastructure & DevOps

### Local Development

```bash
# Start infrastructure
pnpm start:infra          # docker-compose up (Postgres, Mongo, Redis, Kafka)

# Database setup
pnpm db:setup             # Prisma migrate dev + generate clients

# Start all services
pnpm start:all            # Parallel start of all NestJS services

# Start individual services
pnpm start:api-gateway
pnpm start:auth-service
pnpm start:user-service
pnpm start:frontend

# Run tests
pnpm nx test auth-service
pnpm check-all            # Lint + typecheck + test all
```

### Docker Compose

All infrastructure dependencies run locally via Docker Compose on a bridge network (`chat-network`). Services have health checks defined. Data persists via named Docker volumes.

| Container | Image | Port |
|---|---|---|
| chat-postgres | postgres:15.7 | 5432 |
| chat-mongo | mongo:6.0.14 | 27017 |
| chat-redis | redis:7.2.5 | 6379 |
| chat-kafka | confluentinc/cp-kafka:7.6.0 | 9092 |

### CI/CD (GitHub Actions)

Triggered on: push to `main`, PRs targeting `main`.

Pipeline steps (Nx affected — only runs what changed):
1. Install deps (frozen lockfile via pnpm)
2. `nx affected --target=lint`
3. `nx affected --target=typecheck`
4. `nx affected --target=test`
5. `nx affected --target=build`

All steps run in parallel with `--parallel=3`.

### Nx Constraints

Dependency rules are enforced at lint time:
- `domain` layer cannot import from `application`, `infrastructure`, or `interfaces`
- `application` layer cannot import from `infrastructure` or `interfaces`
- Services cannot import directly from other services (must go through shared libs or Kafka)

---

## 11. What Is Working Well

### Contract-First Design
OpenAPI specs in `libs/openapi-specs` act as the contract. Types flow from YAML → `shared-types` → backend DTOs and frontend hooks. This is the single strongest architectural decision in this codebase — it prevents type drift and makes the API self-documenting.

### Strict DDD Layering
Every service has explicit domain, application, infrastructure, and interfaces layers. Business logic in the domain layer has zero infrastructure dependencies. This makes it straightforward to swap out Prisma for another ORM or Kafka for another broker without touching business rules.

### Kafka-Mediated Event Flow
Services never call each other synchronously. The `user.created.v1` flow (auth-service produces → user-service consumes → creates default profile) is a clean example of eventual consistency without coupling. If user-service is temporarily down, the event waits in Kafka.

### Versioned Kafka Topics
All topics end in `.v1`. When a breaking schema change is needed, produce to `.v2` while keeping `.v1` running during the migration window. No big-bang upgrades needed.

### Monorepo with Nx Affected
The affected build system means CI only re-tests changed services. For a six-service system this saves significant CI time as the codebase grows.

### Shared Libraries
Shared logger, exceptions, validation, and config eliminate repetition and ensure every service behaves consistently. New services get sensible defaults for free by importing from these libs.

### Security Defaults
HttpOnly cookies, refresh token rotation, email verification, and rate limiting are all in place before the app is even feature-complete. Security is not an afterthought here.

### Prisma Schema Isolation
Both auth-service and user-service use PostgreSQL but generate separate Prisma clients to separate output paths. This prevents cross-service model leakage while still sharing the same database instance in development.

---

## 12. Improvements & Gaps

### Critical

**1. Gateway-level authentication**
The API Gateway proxies all requests without verifying the JWT. Individual services validate tokens, but a misconfigured or compromised service could accept unauthenticated requests. Add a lightweight JWT guard at the gateway to reject invalid tokens before they reach any service.

**2. Notification Service is incomplete**
The service scaffold exists but Kafka consumer handlers are not wired. `friend.request.sent.v1` events go unhandled, so users receive no notifications for friend requests. This is the highest-priority feature gap.

**3. No service-to-service mTLS or network policy**
Any process on the same network can call `localhost:3001` and bypass the gateway entirely. In production, services should only accept connections from the gateway (or other authorized services) via network policies or mTLS.

### High Priority

**4. WebSocket connection should go through the API Gateway**
The frontend currently connects Socket.IO directly to chat-service in development. In production this means a separate WebSocket endpoint that clients must discover separately. Route WebSocket upgrades through the gateway to maintain a single origin.

**5. No integration or end-to-end tests**
CI runs unit tests per service in isolation. There are no tests that verify cross-service flows (e.g., register in auth-service → profile appears in user-service). Add at least one integration test suite that boots the infrastructure and exercises the full user creation flow.

**6. Message read receipts lack a Kafka event**
`Message.isRead` is stored in MongoDB but there is no `message.read.v1` Kafka event. Without this, the notification-service cannot clear pending notifications and the frontend cannot update read states reactively.

**7. No production Docker build**
`docker-compose.yml` runs infrastructure only. There are no `Dockerfile`s for the NestJS services or the Next.js frontend. Add multi-stage Dockerfiles for each app so the entire system can run containerized in staging and production.

### Medium Priority

**8. Redis connection is not shared / pooled efficiently**
Each service creates its own Redis connection. For services on the same host this is fine, but if connection count becomes a concern a Redis connection pool or a shared Redis client module would help.

**9. OpenAPI specs completeness**
Auth and user specs appear complete. Chat and message service specs should be audited to ensure all endpoints are documented. Undocumented endpoints will not appear in the auto-generated Swagger UI and will not have generated TypeScript types.

**10. Avatar upload goes directly to Cloudinary from user-service**
This works but bypasses the gateway's 50 MB body limit enforcement. If the upload is large, it could also hold a NestJS thread. Consider a signed-upload flow where user-service issues a Cloudinary signed URL and the frontend uploads directly to Cloudinary — this offloads bandwidth from the backend entirely.

**11. No Kubernetes manifests**
Nx + Docker support horizontal scaling, but there are no Helm charts or Kubernetes manifests. As the project matures, add a `k8s/` or `helm/` directory with deployment configs.

**12. Rate limiting is only on auth endpoints**
Profile update, avatar upload, and friend request endpoints have no rate limiting. Add Throttler guards to mutation endpoints in user-service and chat-service.

### Low Priority

**13. Google OAuth callback routes through the gateway**
OAuth callback at `/api/v1/auth/google/callback` goes through the gateway → auth-service. This is fine, but the `GOOGLE_CALLBACK_URL` environment variable must always match the gateway's public URL, not the auth-service URL. This is already correctly set up but should be explicitly documented so it is not accidentally changed.

**14. i18n translation files are minimal**
`next-intl` is integrated and ready, but only English translations exist. The infrastructure is correct — translation files just need to be populated as the UI matures.

**15. No database migrations in CI**
CI runs tests against mocked/in-memory stores. A migration smoke-test (apply all Prisma migrations against a real PostgreSQL container) would catch migration regressions before they reach staging.

---

## Appendix: Port Reference

| Service | Port |
|---|---|
| API Gateway | 3000 |
| Auth Service | 3001 |
| User Service | 3002 |
| Chat Service | 3003 |
| Message Service | 3004 |
| Notification Service | 3005 |
| Frontend (Next.js) | 4200 |
| PostgreSQL | 5432 |
| MongoDB | 27017 |
| Redis | 6379 |
| Kafka | 9092 |

## Appendix: Environment Variables

All variables are defined in the root `.env` file and validated per-service via Zod schemas on startup.

| Variable | Used By |
|---|---|
| `JWT_ACCESS_SECRET` | auth-service |
| `DATABASE_URL` | auth-service (Prisma) |
| `USER_DATABASE_URL` | user-service (Prisma) |
| `MONGODB_URL` | chat-service, message-service |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | all backend services |
| `KAFKA_BROKERS` | auth-service, user-service, chat-service, notification-service |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | auth-service |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | auth-service |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | user-service |
| `AUTH_SERVICE_URL` … `NOTIFICATION_SERVICE_URL` | api-gateway |
| `NEXT_PUBLIC_API_URL` | frontend |
| `CORS_ORIGIN` / `FRONTEND_URL` | all backend services |
