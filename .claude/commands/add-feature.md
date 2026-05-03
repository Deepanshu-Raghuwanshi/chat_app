Read the following files before doing anything else:
- docs/architecture.md
- docs/auth-architecture.md
- Identify which service owns this feature, then read:
  - apps/<service>/src/app.module.ts
  - apps/<service>/src/domain/ (list all entities)
  - apps/<service>/src/application/use-cases/ (list all use cases)
  - apps/<service>/src/interfaces/controllers/ (list all controllers)
- libs/openapi-specs/src/v1/<service>.yaml (the contract for this service)

You are adding a feature: **$ARGUMENTS**

---

## Your Task

Add a new feature to an existing service. This is a scoped task — work within one service only, following the full DDD implementation flow.

---

## Step 1 — Check the Spec First

Before writing any code, check `libs/openapi-specs/src/v1/<service>.yaml`:
- Is this feature already defined in the spec?
- If **yes**: implement exactly what the spec describes. Do not change the spec.
- If **no**: run `/spec-create $ARGUMENTS` first to define the contract, then come back here.

---

## Step 2 — Plan the Implementation

Map out:
1. **New entities or changes to existing ones?** (domain layer)
2. **New repository methods needed?** (ports + infrastructure)
3. **How many use cases?** (one per business operation — get, create, update, delete are separate)
4. **New controller methods or a new controller?** (interfaces layer)
5. **Database changes?** (new Prisma model / Mongoose schema / migration)
6. **Kafka events?** (if yes, run `/add-kafka-event` for each new topic)

---

## Step 3 — Implement (in DDD order)

Follow the exact same order as `/spec-implement`:

### Domain layer first
- Add or update entities in `src/domain/entities/`
- No imports from outside the domain layer

### Application layer second
- Add repository port methods to `src/application/ports/`
- Create DTOs in `src/application/dto/`
- Create use cases in `src/application/use-cases/` — one file per operation

### Infrastructure layer third
- Implement new repository methods in `src/infrastructure/persistence/`
- Add Kafka producer calls where events are emitted

### Interfaces layer last
- Add route methods to the existing controller, OR create a new controller
- Keep controllers thin — delegate everything to use cases

### Module last
- Register new providers and controllers in the NestJS module

---

## Step 4 — Write Tests

For every new use case, write a unit test at `apps/<service>/tests/unit/<use-case>.spec.ts`.

Each test must cover:
- [ ] Success path
- [ ] Relevant failure paths (NotFoundException, ConflictException, BadRequestException, ForbiddenException)
- [ ] Kafka event emitted correctly (if applicable)
- [ ] Repository called with correct arguments

Pattern reference: see `/write-tests` command.

---

## Step 5 — Verify

```bash
pnpm nx typecheck <service-name>    # Zero TypeScript errors
pnpm nx lint <service-name>         # Zero lint errors
pnpm nx test <service-name>         # All tests pass
```

If the feature also requires frontend changes, address those after the backend is verified:
- Add the API call to `apps/frontend/src/features/<feature>/services/<feature>.service.ts`
- Add the hook to `apps/frontend/src/features/<feature>/hooks/use<Feature>.ts`
- Use `useMutation` for writes, `useQuery` for reads
- Invalidate relevant query cache keys on mutation success

---

## Layer Discipline Reminders

- Domain layer: ZERO imports from NestJS, Prisma, Mongoose, or Kafka
- Use cases: inject repositories via port interfaces, not concrete classes
- Controllers: no business logic, no direct DB calls
- Repository binding: always use string token `provide: '<Name>Repository'`
- Exception types: always from `@nestjs/common` (`NotFoundException`, `BadRequestException`, etc.)
- Kafka topics: always from `@kafka-events` enum, never hardcoded strings
