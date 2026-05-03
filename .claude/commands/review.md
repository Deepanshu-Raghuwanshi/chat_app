Read the following files before doing anything else:
- docs/architecture.md
- docs/auth-architecture.md

Then read the git diff for the current branch:
Run: `git diff master...HEAD --name-only` to see changed files, then read each changed file in full.

You are reviewing: **$ARGUMENTS**

If $ARGUMENTS is a PR number, run: `gh pr diff $ARGUMENTS`
If $ARGUMENTS is empty, review all changes on the current branch vs master.

---

## Your Task

Perform a thorough code review against this project's architecture, DDD principles, and coding conventions.

---

## Review Dimensions

### 1. Architecture & DDD Layer Compliance

Check each changed file for layer violations:

| File location | Allowed imports |
|---|---|
| `src/domain/` | Only other domain files, no NestJS, no Prisma, no Kafka |
| `src/application/use-cases/` | Domain layer + application ports, no Prisma/Mongoose directly |
| `src/application/ports/` | Domain types only |
| `src/infrastructure/` | Application ports + domain + NestJS/Prisma/Mongoose/Kafka |
| `src/interfaces/controllers/` | Application use cases + NestJS decorators only |

Flag any import that crosses layer boundaries.

### 2. OpenAPI Contract Alignment

If controllers are changed:
- Are new endpoints also reflected in the spec at `libs/openapi-specs/src/v1/`?
- Do request/response shapes match what the spec defines?
- Were types regenerated via `pnpm generate:types`?

### 3. Kafka Event Conventions

If Kafka producers/consumers are changed:
- Are topic names imported from `@kafka-events` enum? (never hardcoded strings)
- Do event payloads match the interface in `libs/kafka-events/src/v1/`?
- Do new topics end in `.v1`?
- Is the consumer group name meaningful and consistent?

### 4. Security

Check for:
- [ ] Any endpoint missing `@UseGuards(JwtAuthGuard)` that handles user data
- [ ] Any sensitive field (password, token, secret) returned in an API response
- [ ] Any `console.log` or logger call that might print sensitive values
- [ ] Direct SQL or MongoDB queries that could allow injection (Prisma/Mongoose prevent this, but raw queries don't)
- [ ] CORS or cookie settings changed without good reason
- [ ] New env vars added without corresponding Zod validation in `src/config/env.validation.ts`
- [ ] Rate limiting missing on new auth-related endpoints

### 5. TypeScript Quality

- [ ] No `any` type (ESLint enforces this but check manually too)
- [ ] No type assertions (`as SomeType`) that bypass type safety
- [ ] All async functions `await` their promises (not fire-and-forget without justification)
- [ ] All errors caught and re-thrown as proper NestJS exceptions

### 6. Controller Quality

Controllers should be thin wrappers. Flag if a controller:
- Contains business logic (validation beyond parsing, calculations, state decisions)
- Queries the database directly (bypassing use cases)
- Returns raw Prisma/Mongoose objects instead of domain objects or DTOs
- Is missing Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)

### 7. Use Case Quality

Use cases should be the single orchestration point. Flag if a use case:
- Imports Prisma or Mongoose directly (should use port interfaces)
- Contains HTTP-specific logic (`Response`, `Request` objects)
- Has hardcoded Kafka topic strings
- Swallows exceptions without re-throwing

### 8. Test Coverage

For every new use case, check:
- Is there a corresponding test in `apps/<service>/tests/unit/`?
- Does the test use sinon stubs (not real DB connections)?
- Does it test the success path AND at least one failure path?
- Are assertions using Chai (`expect(...).to.equal()` not Jest `expect`)?

### 9. Frontend (if applicable)

- [ ] Hooks use `useMutation` for writes and `useQuery` for reads
- [ ] Mutations invalidate relevant query cache keys on success
- [ ] Axios client uses `withCredentials: true`
- [ ] No direct API calls outside of feature service files
- [ ] Types come from `@shared-types`, not manually defined duplicates
- [ ] Zustand store mutations are atomic (one concern per action)

### 10. Nx Constraints

Run: `pnpm nx graph` mentally — check that no service imports directly from another service. All cross-service communication must be via:
- Shared libs (`@kafka-events`, `@shared-types`, `@shared-exceptions`, `@shared-logger`)
- Kafka events (async)
- HTTP via the API gateway (from frontend only)

---

## Output Format

Structure the review as:

### Blockers (must fix before merge)
- File: `path/to/file.ts` — issue description

### Warnings (should fix, not blocking)
- File: `path/to/file.ts` — issue description

### Suggestions (nice to have)
- File: `path/to/file.ts` — suggestion

### Praise (what's done well)
- Note any particularly clean patterns, good test coverage, or solid DDD adherence

### Summary
One paragraph: overall quality, readiness to merge, and the most important thing to address.
