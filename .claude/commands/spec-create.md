Read the following files before doing anything else:
- docs/architecture.md
- docs/auth-architecture.md
- libs/openapi-specs/src/v1/auth.yaml
- libs/openapi-specs/src/v1/user.yaml
- libs/kafka-events/src/index.ts
- libs/shared-types/src/index.ts
- apps/frontend/src/features/ (list all feature directories to understand existing frontend structure)

You are creating a full-stack feature spec for: **$ARGUMENTS**

---

## Your Task

Produce two output files:

1. `libs/openapi-specs/src/v1/<name>.yaml` — the OpenAPI contract
2. `docs/specs/<name>.spec.md` — the full-stack feature spec document

Write the OpenAPI YAML file first, then write the spec document.

---

## Output 1 — OpenAPI YAML (`libs/openapi-specs/src/v1/<name>.yaml`)

Use `auth.yaml` and `user.yaml` as the canonical format. Cover:

- Every HTTP endpoint: method, path (prefixed `/api/v1/<service>/`), summary, request body, responses (200/201, 400, 401, 403, 404, 409)
- JWT auth on protected routes: `security: [{ bearerAuth: [] }]`
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
What already exists that is relevant to this feature:
- Which services, files, and modules are already in place
- Which DB models/tables already exist
- Which Kafka topics or events are already defined
- Any stub or partial implementations that will be replaced

### 3. Desired State
What the system looks like once the feature is fully implemented:
- User-facing behaviour (what the user can do)
- Data flow (client → gateway → service → DB → Kafka)
- Business rules and constraints (e.g. "only friends can message", "only sender can delete")

---

### Phase 1 — Contracts & Schema

**Goal**: Define all contracts and database changes before any implementation begins. Nothing is implemented in this phase — only designed and declared.

#### 1.1 OpenAPI Changes
List every endpoint being added or modified, with method, path, and purpose:
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/v1/... | JWT | ... |

#### 1.2 Database Schema Changes

**New Prisma models** (for PostgreSQL services — auth, user):
```prisma
model <Name> {
  id        String   @id @default(uuid())
  // ...all fields with types and relations
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@schema("<service_schema>")
}
```

**New Mongoose schemas** (for MongoDB services — chat, message):
```typescript
export const <Name>Schema = new Schema({
  // ...all fields
}, { timestamps: true });
```

**Changes to existing models** (add fields, relations, indexes):
- `ExistingModel`: add field `x` of type `y`, add index on `[a, b]`

#### 1.3 Kafka Event Contracts
New topics to add to `libs/kafka-events/src/v1/`:

| Direction | Topic | Payload Interface |
|-----------|-------|-------------------|
| Produces | `<domain>.<action>.v1` | `{ id, field1, field2, occurredAt }` |
| Consumes | `<other>.<action>.v1` | existing interface |

#### 1.4 Files to Create / Modify in This Phase
```
libs/openapi-specs/src/v1/<name>.yaml        — OpenAPI contract (created)
libs/kafka-events/src/v1/<name>-events.ts    — New event interfaces (created if needed)
libs/kafka-events/src/index.ts               — Export new interfaces (modified)
apps/<service>/prisma/schema.prisma          — New models (modified)
```

Commands to run after this phase:
```bash
pnpm generate:types                          # Regenerate shared-types from OpenAPI
pnpm prisma:migrate:<service>                # Apply DB migrations
pnpm prisma:generate                         # Regenerate Prisma client
```

---

### Phase 2 — Backend Implementation

**Goal**: Implement all backend use cases, repository, and controller following the DDD layer order.

#### 2.1 Domain Layer (`src/domain/`)
New entities and value objects to create:

**`<Name>` entity** (`src/domain/entities/<name>.entity.ts`):
- Fields: list all with types
- Business rules enforced here: list any invariants

#### 2.2 Application Layer (`src/application/`)

**Repository port** (`src/application/ports/<name>.repository.ts`):
- Methods needed: `findById`, `create`, `update`, `findByUser`, etc.

**DTOs** (`src/application/dto/`):
- `Create<Name>Dto`: fields required to create
- `Update<Name>Dto`: fields that can be updated

**Use cases** (one file each in `src/application/use-cases/`):
| Use Case Class | Trigger | Business Rules | Events Emitted |
|----------------|---------|----------------|----------------|
| `Create<Name>UseCase` | POST endpoint | rule 1, rule 2 | `<topic>.v1` |
| `Get<Name>UseCase` | GET endpoint | ownership check | none |
| `Update<Name>UseCase` | PATCH endpoint | rule 1 | none |
| `Delete<Name>UseCase` | DELETE endpoint | only owner | none |

#### 2.3 Infrastructure Layer (`src/infrastructure/`)

**Repository implementation** (`src/infrastructure/persistence/prisma-<name>.repository.ts` or `mongoose-<name>.repository.ts`):
- Implements the port defined in 2.2
- List any non-trivial queries (joins, aggregations, compound filters)

**Kafka producer** (if events are emitted):
- Which use cases call the producer
- Payload mapping

**Kafka consumer** (if events are consumed):
- Topic subscribed to
- Consumer group: `<service>-group`
- Which use case it calls

#### 2.4 Interfaces Layer (`src/interfaces/controllers/`)

**Controller**: `<Name>Controller` at prefix `/<resource>`
- List every route method, its guard, decorator, and which use case it calls

#### 2.5 Module Registration
- New module file: `src/<name>.module.ts`
- Changes to `AppModule`: import the new module
- Changes to API Gateway routing: new path prefix → service URL

#### 2.6 Files to Create / Modify in This Phase
```
apps/<service>/src/domain/entities/<name>.entity.ts
apps/<service>/src/application/ports/<name>.repository.ts
apps/<service>/src/application/dto/<name>.dto.ts
apps/<service>/src/application/use-cases/create-<name>.use-case.ts
apps/<service>/src/application/use-cases/get-<name>.use-case.ts
apps/<service>/src/application/use-cases/update-<name>.use-case.ts
apps/<service>/src/application/use-cases/delete-<name>.use-case.ts
apps/<service>/src/infrastructure/persistence/<impl>-<name>.repository.ts
apps/<service>/src/infrastructure/messaging/<name>-producer.service.ts  (if events)
apps/<service>/src/infrastructure/messaging/<name>-consumer.service.ts  (if consuming)
apps/<service>/src/interfaces/controllers/<name>.controller.ts
apps/<service>/src/<name>.module.ts
apps/<service>/src/app.module.ts                                        (modified)
apps/api-gateway/src/interfaces/controllers/gateway.controller.ts       (modified if new prefix)
```

#### 2.7 Test Cases

**Unit — Use Cases** (`apps/<service>/tests/unit/`):
- [ ] `create-<name>`: happy path returns created entity
- [ ] `create-<name>`: throws `BadRequestException` when — describe condition
- [ ] `create-<name>`: throws `ConflictException` when — describe condition
- [ ] `get-<name>`: throws `NotFoundException` when not found
- [ ] `get-<name>`: throws `ForbiddenException` when not owner
- [ ] `update-<name>`: updates only provided fields
- [ ] `delete-<name>`: throws `ForbiddenException` when not owner
- [ ] Kafka event emitted with correct topic and payload
- [ ] Kafka event NOT emitted when operation fails

Commands to verify this phase:
```bash
pnpm nx typecheck <service-name>
pnpm nx lint <service-name>
pnpm nx test <service-name>
```

---

### Phase 3 — Frontend Implementation

**Goal**: Wire the frontend to the completed backend endpoints.

#### 3.1 Routes / Pages
New or modified pages in `apps/frontend/app/`:

| Route | Page File | Purpose |
|-------|-----------|---------|
| `/feature/[id]` | `app/feature/[id]/page.tsx` | View detail |
| `/feature/new` | `app/feature/new/page.tsx` | Create form |

#### 3.2 API Service (`src/features/<feature>/services/<feature>.service.ts`)
New axios functions to add (all use `withCredentials: true`):
```typescript
create<Name>(dto: Create<Name>Dto): Promise<<Name>>
get<Name>(id: string): Promise<<Name>>
update<Name>(id: string, dto: Update<Name>Dto): Promise<<Name>>
delete<Name>(id: string): Promise<void>
```

Types come from `@shared-types` (auto-generated from the OpenAPI spec in Phase 1).

#### 3.3 Hooks (`src/features/<feature>/hooks/use<Feature>.ts`)

| Hook | Type | Query Key | Purpose |
|------|------|-----------|---------|
| `useGet<Name>` | `useQuery` | `['<name>', id]` | Fetch single |
| `useList<Name>` | `useQuery` | `['<name>s']` | Fetch list |
| `useCreate<Name>` | `useMutation` | — | Create, then invalidate `['<name>s']` |
| `useUpdate<Name>` | `useMutation` | — | Update, then invalidate `['<name>', id]` |
| `useDelete<Name>` | `useMutation` | — | Delete, then invalidate `['<name>s']` |

#### 3.4 Zustand Store Changes (`src/features/<feature>/store/`)
Describe any client state that needs to live in Zustand (not server state — that goes in TanStack Query):
- State field: type, default value, purpose
- Actions needed

#### 3.5 Components (`src/features/<feature>/components/`)
List UI components to create, with their props and responsibility:

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `<Name>Card` | `item: <Name>` | Display a single item |
| `<Name>Form` | `onSubmit`, `defaultValues?` | Create / edit form |
| `<Name>List` | `items: <Name>[]` | Render list of cards |

#### 3.6 Files to Create / Modify in This Phase
```
apps/frontend/app/<feature>/page.tsx                              (created)
apps/frontend/app/<feature>/[id]/page.tsx                        (created if needed)
apps/frontend/src/features/<feature>/services/<feature>.service.ts (created)
apps/frontend/src/features/<feature>/hooks/use<Feature>.ts        (created)
apps/frontend/src/features/<feature>/store/use<Feature>Store.ts   (created if needed)
apps/frontend/src/features/<feature>/components/<Name>Card.tsx    (created)
apps/frontend/src/features/<feature>/components/<Name>Form.tsx    (created)
apps/frontend/src/features/<feature>/components/<Name>List.tsx    (created)
apps/frontend/src/shared/components/Navbar.tsx                    (modified if new nav link)
```

#### 3.7 Test Cases

**Hook tests** (`apps/frontend/src/features/<feature>/hooks/`):
- [ ] `useGet<Name>`: returns data when query succeeds
- [ ] `useCreate<Name>`: invalidates `['<name>s']` on success
- [ ] `useCreate<Name>`: shows error toast on failure

**Component tests** (`apps/frontend/src/features/<feature>/components/`):
- [ ] `<Name>Form`: submits with correct payload
- [ ] `<Name>Form`: shows validation error when required field is empty
- [ ] `<Name>List`: renders empty state when list is empty

Commands to verify this phase:
```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

### 4. Open Questions
List any decisions not yet made or assumptions needing confirmation before implementation starts.

---

## Final Output Checklist

- [ ] `libs/openapi-specs/src/v1/<name>.yaml` written
- [ ] `libs/kafka-events/src/v1/<name>-events.ts` written (if new events)
- [ ] `docs/specs/<name>.spec.md` written with all three phases filled out
- [ ] Remind user to run `pnpm generate:types` after Phase 1
