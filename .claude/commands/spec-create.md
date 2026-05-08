# Spec Create — Senior Engineer Edition

## Role & Mindset

You are a **senior full-stack engineer** who has built and maintained this codebase from day one. You know every service, every design decision, every pattern, and every existing abstraction. You do not guess — you read the code and state facts. You do not copy-paste boilerplate — you design the leanest, most correct solution given what already exists.

Before writing a single line of the spec, you must deeply understand the current codebase. Your spec must reflect actual reality, not assumptions. Every design decision you make must be the **best possible approach** for this codebase — leveraging existing infrastructure, avoiding redundancy, and choosing the right trade-offs at scale.

---

## Step 0 — Full Codebase Audit (Do This Before Writing Anything)

**Read every file listed below. Do not skip any. Do not start writing until this is complete.**

### Architecture & Contracts
- `docs/architecture.md`
- `docs/auth-architecture.md`
- `libs/openapi-specs/src/v1/auth.yaml`
- `libs/openapi-specs/src/v1/user.yaml`
- `libs/openapi-specs/src/v1/chat.yaml` (if it exists)
- `libs/kafka-events/src/index.ts`
- `libs/kafka-events/src/v1/` — read ALL event files
- `libs/shared-types/src/index.ts`

### Existing Service Code (for the service(s) this feature touches)
- `apps/<service>/src/app.module.ts` — understand what's already registered
- `apps/<service>/src/interfaces/controllers/` — all existing controllers
- `apps/<service>/src/application/use-cases/` — all existing use cases
- `apps/<service>/src/application/ports/` — all existing repository ports
- `apps/<service>/src/infrastructure/persistence/` — all existing repository implementations
- `apps/<service>/src/infrastructure/messaging/` — existing Kafka consumers/producers
- `apps/<service>/prisma/schema.prisma` OR relevant Mongoose schema files
- `apps/api-gateway/src/interfaces/controllers/gateway.controller.ts`

### Frontend (for the feature area this touches)
- `apps/frontend/src/features/` — list all feature directories
- Read the entire feature folder for the relevant feature (services, hooks, store, components)
- `apps/frontend/app/` — read the relevant pages

### After reading, answer these questions in your head before writing:
1. What already exists that I can reuse instead of recreating?
2. Which service owns this data — and is that already wired in the gateway?
3. What DB/cache infrastructure is already in place (Redis, Postgres, Mongo)?
4. What Kafka topics already exist — do I need new ones or can I consume existing ones?
5. What is the most efficient DB query strategy for this feature (index usage, compound filters, pagination)?
6. Does any part of this feature already have a stub or partial implementation?
7. What patterns does this codebase use (DDD layers, optimistic updates, presence via Redis, etc.) and am I following them consistently?

---

## Feature Being Specced

You are creating a full-stack feature spec for: **$ARGUMENTS**

---

## Your Task

Produce two output files:

1. `libs/openapi-specs/src/v1/<name>.yaml` — the OpenAPI contract (add to existing service yaml if the endpoints belong to an existing service; create a new file only for a new service)
2. `docs/specs/<name>.spec.md` — the full-stack feature spec document

Write the OpenAPI YAML file first, then write the spec document.

---

## Output 1 — OpenAPI YAML

If the feature's endpoints belong to an existing service (e.g. user-service, chat-service), **edit the existing yaml file** (`user.yaml`, `chat.yaml`, etc.) rather than creating a new one. Only create a new yaml file if this is a new service.

Use `auth.yaml` and `user.yaml` as the canonical format. Cover:

- Every HTTP endpoint: method, path (prefixed `/api/v1/<service>/`), summary, request body, responses (200/201, 400, 401, 403, 404, 409)
- JWT auth on all protected routes: `security: [{ bearerAuth: [] }]`
- All schemas in `components/schemas` using `$ref` — no inline duplication
- Required fields listed explicitly in `required: [...]`
- `format: uuid` for IDs, `format: email`, `format: date-time` for timestamps
- `enum` for fixed string sets (status, role fields)
- Kafka events as a comment block at the bottom:
  ```yaml
  # Kafka Events
  # Produces: feature.action.v1
  # Consumes: other.action.v1
  ```
- Shared `ErrorResponse` schema reused via `$ref` in all error responses:
  ```yaml
  ErrorResponse:
    type: object
    properties:
      statusCode: { type: integer }
      timestamp: { type: string, format: date-time }
      path: { type: string }
      method: { type: string }
      error: { type: string }
      message: { type: string }
  ```

---

## Output 2 — Feature Spec Document (`docs/specs/<name>.spec.md`)

The document must follow this exact structure:

---

### 1. Summary

3–5 sentences: what the feature does, who uses it, and why it exists.

### 2. Current State

**State only what you actually verified by reading the code.** No assumptions.

- Which services, files, and modules are already in place (with exact file paths)
- Which DB models/tables/indexes already exist
- Which Kafka topics or events are already defined
- Which frontend components, hooks, and services already exist for this area
- Any stub, partial, or placeholder implementation that will be extended or replaced
- Explicitly call out what does NOT exist yet

### 3. Desired State

What the system looks like once the feature is fully implemented:

**User-facing behaviour**: What the user can do, step by step.

**Data flow**:
```
Client → API Gateway → Service → DB/Cache → Kafka → (downstream consumers)
```
Write the actual flow for each major operation (create, read, update, delete, real-time event).

**Business rules and constraints** — be specific and exhaustive:
- Access rules (who can do what)
- Validation rules (what is required, what lengths, what formats)
- Idempotency rules (what happens if called twice)
- Exclusion rules (what must be filtered out)
- Ordering and pagination rules

---

### Phase 1 — Contracts & Schema

**Goal**: Define all contracts and database changes before any implementation begins. Nothing is implemented in this phase — only designed and declared.

#### 1.1 OpenAPI Changes

State whether you are editing an existing yaml or creating a new one, and why.

List every endpoint being added or modified:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/v1/... | JWT | ... |

#### 1.2 Database Schema Changes

For each change, explain **why** this is the right schema choice (index strategy, normalization decision, field type choice).

**New Prisma models** (for PostgreSQL services — auth, user):

```prisma
model <Name> {
  id        String   @id @default(uuid())
  // ...all fields with types and relations
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([field1, field2])  // explain why this index
  @@schema("<service_schema>")
}
```

**New Mongoose schemas** (for MongoDB services — chat):

```typescript
export const <Name>Schema = new Schema({
  // ...all fields
}, { timestamps: true });

<Name>Schema.index({ field1: 1, field2: -1 }); // explain why
```

**Changes to existing models** — only add what is truly needed:

- `ExistingModel`: add field `x` of type `y` — reason: ...

If no schema changes are needed, state that explicitly and explain why.

#### 1.3 Kafka Event Contracts

For each event, explain whether it is new or existing, who produces it, and who consumes it.

| Direction | Topic | Producer | Consumer(s) | Payload |
|-----------|-------|----------|-------------|---------|
| Produces | `<domain>.<action>.v1` | service | service | `{ id, field1, occurredAt }` |
| Consumes | `<other>.<action>.v1` | other-service | this service | existing interface |

If no Kafka events are needed, state that explicitly.

#### 1.4 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/<name>.yaml          — created or modified
libs/kafka-events/src/v1/<name>-events.ts      — created (only if new events)
libs/kafka-events/src/index.ts                 — modified (only if new events)
apps/<service>/prisma/schema.prisma            — modified (only if schema changes)
```

Commands to run after this phase:

```bash
pnpm generate:types          # Regenerate shared-types from OpenAPI
pnpm prisma:migrate:<service> # Only if schema changed
pnpm prisma:generate          # Only if schema changed
```

---

### Phase 2 — Backend Implementation

**Goal**: Implement all backend logic in strict DDD layer order. Reuse existing infrastructure wherever possible. Every design choice must be the optimal one for this codebase.

**Before writing this phase**: Re-read the existing use cases and repositories in this service to understand the established patterns. Your implementation must be consistent with them.

#### 2.1 Domain Layer (`src/domain/`)

Only create new entities/value objects if this feature introduces genuinely new domain concepts. If you can reuse existing entities, say so and explain how.

**`<Name>` entity** (if needed):
- Fields: list all with types
- Business invariants enforced at the domain level (not at the controller)
- Static factory method pattern if applicable

If no new domain entities are needed, state that and explain which existing entities cover this feature.

#### 2.2 Application Layer (`src/application/`)

**Repository port** — add methods to an existing port if this feature extends an existing aggregate. Only create a new port file for a genuinely new aggregate.

New methods needed (with exact signatures):
```typescript
search(query: string, excludeIds: string[]): Promise<Entity[]>
```

**DTOs** — only create what is actually needed:
- `<Action><Name>Dto`: list fields, their types, and validation constraints

**Use cases** — one per user action, following the single-responsibility principle already established in this codebase:

| Use Case Class | HTTP Trigger | Business Rules Enforced | Events Emitted |
|----------------|-------------|------------------------|----------------|
| `<Action><Name>UseCase` | METHOD /path | rule 1, rule 2 | `topic.v1` or none |

For each use case, describe the **exact execution sequence**:
1. Guard check (ownership, existence)
2. Business rule validation
3. Repository call
4. Event emission (if any)
5. Return value

#### 2.3 Infrastructure Layer (`src/infrastructure/`)

**Repository implementation** — explain the key query and why it is written this way:

```typescript
// For Prisma:
async search(query: string, excludeIds: string[]): Promise<UserProfile[]> {
  return this.prisma.entity.findMany({
    where: {
      AND: [
        { id: { notIn: excludeIds } },
        { OR: [
          { field1: { contains: query, mode: 'insensitive' } },
          { field2: { contains: query, mode: 'insensitive' } },
        ]},
      ],
    },
    take: 20,
    orderBy: { field: 'asc' },
  });
}
```

Explain any non-obvious query decisions: why `mode: 'insensitive'` over a full-text index, why `take: 20`, why compound `AND`/`OR`.

**Kafka producer** (only if events are emitted):
- Which use case calls it
- Exact payload mapping

**Kafka consumer** (only if events are consumed):
- Topic, consumer group, which use case it invokes
- Why this is the right consumer placement (not HTTP, not inline)

**Caching** (only if a performance argument exists):
- What is cached, what key structure, what TTL, what invalidation strategy
- Why caching is worth the complexity here

#### 2.4 Interfaces Layer (`src/interfaces/controllers/`)

State whether you are adding routes to an **existing controller** or creating a new one. Prefer extending an existing controller if the routes belong to the same resource.

| Method | Route | Guard | Use Case Called |
|--------|-------|-------|----------------|
| GET | /resource/action | JwtAuthGuard | `<Action>UseCase` |

Include the `@Query()` / `@Body()` / `@Param()` decorators and any validation pipes.

#### 2.5 Module Registration

List only the changes that are actually needed — do not include a step if nothing changes for it:

- New providers to add to `AppModule` providers array
- New use cases to inject
- New repository bindings (`provide: 'Token', useClass: Impl`)
- API Gateway changes (only if a new prefix/service is introduced)

#### 2.6 Files to Create / Modify in This Phase

Be precise — list every file with "created" or "modified":

```
apps/<service>/src/application/ports/<name>.repository.ts          — modified (add search method)
apps/<service>/src/application/use-cases/<action>-<name>.use-case.ts — created
apps/<service>/src/infrastructure/persistence/prisma-<name>.repository.ts — modified
apps/<service>/src/interfaces/controllers/<name>.controller.ts     — modified (add route) or created
apps/<service>/src/app.module.ts                                   — modified (register use case)
```

#### 2.7 Test Cases

Write test cases that reflect the actual business rules of this feature, not generic placeholders:

**Unit — Use Cases** (`apps/<service>/tests/unit/`):

- [ ] Happy path: describe exact inputs and expected output
- [ ] Throws `BadRequestException` when — describe the exact condition
- [ ] Throws `NotFoundException` when — describe the exact condition
- [ ] Throws `ForbiddenException` when — describe the exact condition
- [ ] Throws `ConflictException` when — describe the exact condition
- [ ] Kafka event emitted with correct topic and payload shape
- [ ] Kafka event NOT emitted when repository throws

```bash
pnpm nx typecheck <service-name>
pnpm nx lint <service-name>
pnpm nx test <service-name>
```

---

### Phase 3 — Frontend Implementation

**Goal**: Wire the frontend to the completed backend. Reuse existing components, hooks, and patterns. Do not introduce new state management patterns unless genuinely necessary.

**Before writing this phase**: Re-read the existing feature folder (service, hooks, store, components) to ensure your additions follow the same patterns.

#### 3.1 Routes / Pages

State whether you are modifying existing pages or adding new ones:

| Route | Page File | New or Modified | Purpose |
|-------|-----------|-----------------|---------|
| `/feature` | `app/feature/page.tsx` | modified | Add search tab |

#### 3.2 API Service

State whether you are adding to an existing service file or creating a new one.

New functions to add (types from `@shared-types`, all via `apiClient`):

```typescript
async searchUsers(query: string): Promise<UserProfile[]> {
  const response = await apiClient.get<UserProfile[]>('/friends/search', { params: { q: query } });
  return response.data;
}
```

#### 3.3 Hooks

State whether you are adding to an existing hooks file or creating a new one.

| Hook | TQ Type | Query Key | Enabled Condition | Cache Strategy |
|------|---------|-----------|-------------------|----------------|
| `useSearchUsers(query)` | `useQuery` | `['user-search', debouncedQuery]` | `query.length >= 2` | `staleTime: 30s` |

For any hook with debouncing, show the exact debounce pattern used:

```typescript
// Debounce inside the hook — no external library needed
const [debouncedQuery, setDebouncedQuery] = useState(query);
useEffect(() => {
  const t = setTimeout(() => setDebouncedQuery(query), 300);
  return () => clearTimeout(t);
}, [query]);
```

For any mutation with optimistic update, show the exact `onMutate` / `onError` / `onSettled` pattern consistent with existing hooks in this codebase.

#### 3.4 Zustand Store Changes

Only add store state if it is genuinely client-side UI state that cannot live in TanStack Query. Server state always goes in TQ.

If no store changes are needed, state that explicitly.

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `searchQuery` | `string` | `''` | Controlled input value for the search bar |

#### 3.5 Components

State whether you are modifying existing components or creating new ones. Prefer extending existing components with new props over creating new ones.

| Component | New or Modified | Props | Responsibility |
|-----------|-----------------|-------|----------------|
| `SubNavbar` | modified | add `'search'` to tab union | third tab with Search icon |
| `UserSearchPanel` | created | `onSendRequest` | search input + debounced results |

For each new component, list its exact props interface.

#### 3.6 Files to Create / Modify in This Phase

```
apps/frontend/app/<feature>/page.tsx                               — modified
apps/frontend/src/features/<feature>/services/<feature>.service.ts — modified (add searchUsers)
apps/frontend/src/features/<feature>/hooks/use<Feature>.ts         — modified (add useSearchUsers)
apps/frontend/src/features/<feature>/components/SubNavbar.tsx      — modified (add search tab)
apps/frontend/src/features/<feature>/components/UserSearchPanel.tsx — created
```

#### 3.7 Test Cases

Write test cases specific to this feature's actual behaviour:

**Hook tests**:
- [ ] `useSearchUsers`: does NOT fire when query is fewer than 2 characters
- [ ] `useSearchUsers`: debounces — only calls API after 300ms idle
- [ ] `useSearchUsers`: returns empty array when API returns no results

**Component tests**:
- [ ] `UserSearchPanel`: shows loading spinner while query is in flight
- [ ] `UserSearchPanel`: shows empty state when results array is empty
- [ ] `UserSearchPanel`: calls `onSendRequest` with correct userId on button click

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

### 4. Architecture Decisions

For every non-obvious design choice, document the decision and the rationale. This is the most important section for future maintainers.

| # | Decision | Options Considered | Choice | Rationale |
|---|----------|--------------------|--------|-----------|
| 1 | Where does this endpoint live? | New service vs extend existing | Extend user-service | Avoids new infra; data is already in user-service |
| 2 | Cache vs DB for X check? | Redis O(1) vs Postgres query | Redis | Already in stack; O(1) lookup on hot path |
| 3 | New Kafka topic needed? | Yes vs reuse existing | No — reuse `x.action.v1` | Payload is identical; new topic adds no value |

### 5. Open Questions

List any decisions not yet made or assumptions needing confirmation before implementation starts. If there are none, state "None — all decisions are resolved in Section 4."

---

## Final Output Checklist

- [ ] Step 0 audit complete — all relevant files read before writing
- [ ] `libs/openapi-specs/src/v1/<service>.yaml` updated (or new file created with justification)
- [ ] `libs/kafka-events/src/v1/<name>-events.ts` written (only if new events needed)
- [ ] `docs/specs/<name>.spec.md` written with all sections filled with real, verified information
- [ ] Every design decision in Section 4 is justified against the actual codebase
- [ ] Remind user to run `pnpm generate:types` after Phase 1
