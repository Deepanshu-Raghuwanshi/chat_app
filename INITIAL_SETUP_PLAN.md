# INITIAL SETUP PLAN: PRODUCTION-GRADE CHAT APPLICATION

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Phase 1: Monorepo Bootstrap & Nx Enforcement](#phase-1-monorepo-bootstrap--nx-enforcement)
3. [Phase 2: Docker & Infrastructure Setup](#phase-2-docker--infrastructure-setup)
4. [Phase 3: Backend Base Setup (Strict DDD)](#phase-3-backend-base-setup-strict-ddd)
5. [Phase 3.5: Database Strategy & Migrations](#phase-35-database-strategy--migrations)
6. [Phase 4: OpenAPI Integration & Shared Types](#phase-4-openapi-integration--shared-types)
7. [Phase 5: Frontend Architecture & Setup](#phase-5-frontend-architecture--setup)
8. [Phase 6: Kafka Integration & Schema Strategy](#phase-6-kafka-integration--schema-strategy)
9. [Phase 7: Redis, WebSockets & Scaling](#phase-7-redis-websockets--scaling)
10. [Phase 8: Logging, Observability & Auth](#phase-8-logging-observability--auth)
11. [Phase 9: Testing Strategy & CI/CD](#phase-9-testing-strategy--cicd)
12. [Risks & Mitigation](#risks--mitigation)
13. [Final Validation Checklist](#final-validation-checklist)

---

## Architecture Overview
A microservices-based chat application built on **Nx Monorepo** with **pnpm**.
- **Backend**: NestJS services following strict DDD (Domain, Application, Infrastructure, Interfaces).
- **Frontend**: Next.js App Router with shared types from OpenAPI and feature-based architecture.
- **Communication**: REST (OpenAPI enforced) and WebSockets (Chat).
- **Event Mesh**: Kafka for asynchronous, inter-service communication with versioned contracts.
- **Data**: PostgreSQL (structured via Prisma), MongoDB (chat logs via Mongoose), Redis (scaling/cache).
- **Auth**: JWT-based with Refresh Tokens and RBAC.

---

## Phase 1: Monorepo Bootstrap & Nx Enforcement
**Goal**: Initialize Nx with strict dependency boundaries and unified targets.

### Implementation
- Configure `nx.json` with `dependencyConstraints`.
- Add `typecheck` target to all projects.
- Tag projects in `project.json`.

### Configuration (`nx.json`)
```json
{
  "targetDefaults": {
    "typecheck": {
      "executor": "@nx/js:tsc"
    }
  },
  "dependencyConstraints": [
    {
      "sourceTag": "layer:domain",
      "onlyDependOnLibsWithTags": ["layer:domain"]
    },
    {
      "sourceTag": "layer:application",
      "onlyDependOnLibsWithTags": ["layer:domain", "layer:application"]
    },
    {
      "sourceTag": "layer:infrastructure",
      "onlyDependOnLibsWithTags": ["layer:domain", "layer:application", "layer:infrastructure"]
    }
  ]
}
```

### Validation Checklist
- [x] `nx graph` shows correct dependency flow.
- [x] Circular dependencies trigger lint errors.

---

## Phase 2: Docker & Infrastructure Setup
**Goal**: Spin up local infrastructure including Redis and Kafka.

### Configuration (`docker-compose.yml`)
Add Redis and Zookeeper/Kafka as defined previously, ensuring health checks are included.

---

## Phase 3: Backend Base Setup (Strict DDD)
**Goal**: Create microservices with strict layering, validation pipes, and **Zod** environment validation.

### Implementation
- Generate NestJS apps.
- Implement `apps/service-name/src/config/env.validation.ts` using Zod.
- Configure Global Error Filters and Pipes in each service.
- Implement **Health Checks** using `@nestjs/terminus`.
- Define **Secrets Strategy**: Use `.env` locally, Docker secrets for staging, and **AWS Secrets Manager / Vault** for production.

### Example Global Setup (`main.ts`)
```typescript
app.setGlobalPrefix('api'); // Routes: /api/v1/...
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
```

### Health Check Setup (Prisma Example)
```typescript
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private prisma: PrismaService) {}
  async isHealthy(key: string) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch {
      throw new HealthCheckError('Prisma failed', this.getStatus(key, false));
    }
  }
}
```

### Validation Checklist
- [x] `/health` endpoint returns 200 OK across all services.
- [x] ValidationPipe correctly rejects non-whitelisted properties.
- [x] Error shapes are consistent via `libs/shared-exceptions`.

---

## Phase 3.5: Database Strategy & Migrations
**Goal**: Define ORM usage and migration workflows.

### Implementation
- **PostgreSQL**: Use **Prisma** for structured services (Auth, User).
- **MongoDB**: Use **Mongoose** for Chat/Message services.
- Define migration scripts in `package.json`.

### Commands
```bash
pnpm add @prisma/client
pnpm add -D prisma
# Initialize Prisma in auth-service
cd apps/auth-service && npx prisma init
```

### Validation Checklist
- [x] `npx prisma migrate dev` successfully updates Postgres.
- [x] Mongoose models are versioned and typed.

---

## Phase 4: OpenAPI Integration & Shared Types
**Goal**: Enforce contract-first development and versioning.

### Implementation
- Version REST endpoints (e.g., `/v1/auth`, `/v1/chat`).
- Export OpenAPI JSON per version.
- Update `libs/shared-types` to reflect versioned endpoints.

---

## Phase 5: Frontend Architecture & Setup
**Goal**: Setup Next.js with a scalable **Feature-based** structure.

### Implementation
```text
apps/frontend/src/
├── features/        # chat/, auth/, profile/
│     ├── components/
│     ├── hooks/
│     ├── services/
│     └── store/
├── shared/          # components/, utils/, types/
└── core/            # providers/, layouts/
```

---

## Phase 6: Kafka Integration & Schema Strategy
**Goal**: Prevent schema drift in event-driven communication.

### Implementation
- Use versioned event contracts in `libs/kafka-events`.
- Implement **Protobuf** or strict TS interfaces with versioning.

### Example Contract
```typescript
export interface UserCreatedV1 {
  version: 1;
  payload: { id: string; email: string };
}
```

---

## Phase 7: Redis, WebSockets & Scaling
**Goal**: Scale WebSockets across multiple instances and implement secure authentication.

### Implementation
- Use NestJS `IoAdapter` with `socket.io-redis`.
- **WebSocket Auth Strategy**:
  - Authenticate during the **handshake phase**.
  - Validate JWT in `handleConnection`.
  - Attach the authenticated user to the **socket context**.
  - Disconnect unauthorized connection attempts immediately.
- Implement **Redis-based Rate Limiting** using `ThrottlerModule`.
- Define **Caching Strategy**:
  - **User Profile Cache**: 5m TTL.
  - **Chat Room Metadata Cache**: 1h TTL.
  - No message caching in Redis (managed by MongoDB).

### Rate Limiting Configuration
```typescript
ThrottlerModule.forRoot({
  ttl: 60,
  limit: 20, // 20 requests per minute
});
```

---

## Phase 8: Logging, Observability & Auth
**Goal**: Production-grade monitoring and secure authentication with token rotation.

### Implementation
- **Logging**: Use **Pino** for structured logging in `libs/shared-logger`.
- **Auth & JWT Rotation Strategy**:
  - **Short-lived Access Token**: 15m duration.
  - **Long-lived Refresh Token**: 7d duration, stored in HttpOnly cookies.
  - **Storage Strategy**:
    - Store **hashed** refresh tokens in the database (never raw).
    - Use **Redis** for short-term blacklisting of invalidated tokens.
    - Use **DB** for persistent token tracking and auditing.
  - **Refresh Token Rotation**: Issue a new refresh token on every successful refresh; invalidate/black-list the old one.
  - **Logout**: Explicitly invalidate and black-list the refresh token.
  - Implement RBAC (Role-Based Access Control).
- **Observability**: Integrate **OpenTelemetry** for tracing.

---

## Phase 9: Testing Strategy & CI/CD
**Goal**: Ensure code quality via Nx affected and CI type checking.

### Implementation
- Configure GitHub Actions or GitLab CI.
- Run `typecheck` as part of CI.

### CI Workflow Snippet
```yaml
- name: Run CI
  run: |
    pnpm nx affected --target=lint --parallel=3
    pnpm nx affected --target=typecheck --parallel=3
    pnpm nx affected --target=test --parallel=3
    pnpm nx affected --target=build --parallel=3
```

---

## Risks & Mitigation
- **Kafka Drift**: Mitigation through strict schema registry or versioned contracts.
- **WS Performance**: Mitigation through Redis adapter and horizontal scaling.

---

## Final Validation Checklist
- [x] **Nx Tags**: Layers are strictly enforced.
- [x] **Env**: All variables validated on startup.
- [x] **DB**: Migrations are automated and tracked.
- [x] **Scaling**: Redis adapter configured for WebSockets.
- [x] **Auth**: Secure JWT flow implemented.
