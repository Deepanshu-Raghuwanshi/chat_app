Read the following files before doing anything else:

- docs/architecture.md
- docs/auth-architecture.md
- libs/openapi-specs/src/v1/ (list all files and read the relevant one for this feature)
- libs/kafka-events/src/index.ts
- libs/shared-types/src/index.ts
- apps/user-service/src/domain/entities/friend-request.entity.ts (entity pattern reference)
- apps/user-service/src/application/use-cases/send-friend-request.use-case.ts (use case pattern reference)
- apps/user-service/src/interfaces/controllers/user.controller.ts (controller pattern reference)
- apps/user-service/src/config/env.validation.ts (env validation pattern)

Then gather all local changes:

- Run `git status` to see all modified, added, and staged files
- Run `git diff HEAD --name-only` to list every changed file
- Read each changed file in full
- Run `git branch --show-current` to get the branch name

You are reviewing the backend implementation for: **$ARGUMENTS**

---

## Your Task

Review the local backend changes for **$ARGUMENTS** against the OpenAPI spec, the project's DDD architecture, existing patterns, and test requirements. Then write the full review to a `.md` file at:

```
reviews/backend-<branch>-<YYYY-MM-DD>.md
```

Create the `reviews/` directory if it doesn't exist.

---

## Review Dimensions

### 1. Implementation Completeness — Is it 100% done?

Compare the changed code against the OpenAPI spec for this feature (`libs/openapi-specs/src/v1/`):

- Are ALL endpoints defined in the spec implemented?
- Do all request/response shapes exactly match what the spec defines (field names, types, optional/required)?
- Are all HTTP status codes handled (200, 201, 400, 401, 403, 404, 409, etc.)?
- Are all edge cases and error paths covered in the use case logic?
- Are there any `TODO`, `FIXME`, or placeholder comments left in the code?
- Is the API gateway routing updated for new route prefixes?
- If a new Prisma/Mongoose model was needed, is the schema added and migration run?

Flag anything that is partially implemented or missing entirely.

---

### 2. Pattern & Structure Compliance

Compare each new file against the pattern reference files loaded above. Flag deviations:

**Entities** — must follow `friend-request.entity.ts` pattern:

- Interface `<Name>Props` with all fields including `createdAt`/`updatedAt`
- Class with private `props`, typed getters for every field
- Static `create()` factory method
- Zero imports from outside the domain layer

**Use Cases** — must follow `send-friend-request.use-case.ts` pattern:

- `@Injectable()` decorator
- Repository injected via `@Inject('<Name>Repository')` string token
- `execute(dto)` as the only public method
- Throws named NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.)
- Kafka events emitted using `TopicEnum` constants from `@kafka-events`

**Controllers** — must follow `user.controller.ts` pattern:

- `@ApiTags`, `@ApiBearerAuth`, `@UseGuards(JwtAuthGuard)` on the class
- `@ApiOperation`, `@ApiResponse` on every method
- `req` typed as `RequestWithUser`
- No business logic — only delegates to use case

**Repositories** — port interface in `src/application/ports/`, implementation in `src/infrastructure/persistence/`

---

### 3. DDD Layer Compliance

Check imports in each changed file:

| Layer                         | Must NOT import from                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `src/domain/`                 | NestJS, Prisma, Mongoose, Kafka, application, infrastructure |
| `src/application/use-cases/`  | Prisma, Mongoose, infrastructure layer                       |
| `src/application/ports/`      | Anything outside domain                                      |
| `src/infrastructure/`         | Other services directly                                      |
| `src/interfaces/controllers/` | Domain layer, infrastructure layer directly                  |

Flag every import that crosses a boundary.

---

### 4. No Duplicate Code

- Were existing entities, DTOs, ports, or use cases reused where applicable?
- Were shared types from `libs/shared-types` used instead of locally redefined?
- Were Kafka topic constants from `@kafka-events` used instead of hardcoded strings?

---

### 5. Test Coverage — Are all tests written?

For every new use case added, verify:

- [ ] Test file exists at `apps/<service>/tests/unit/<name>.use-case.spec.ts`
- [ ] Uses sinon stubs for all repository and Kafka dependencies (no real DB)
- [ ] Tests the success path
- [ ] Tests every failure path (each exception the use case can throw)
- [ ] Assertions use Chai (`expect(...).to.equal()` / `.to.be.true` / `.to.throw`)
- [ ] Test file follows the same describe/it structure as existing tests

If any use case is missing tests, that is a **Blocker**.

---

### 6. Security

- [ ] Every endpoint that handles user data has `@UseGuards(JwtAuthGuard)`
- [ ] No sensitive fields (password, token, secret, hash) returned in API responses
- [ ] No `console.log` calls that could print sensitive values
- [ ] No raw SQL/MongoDB queries (use Prisma/Mongoose query builders)
- [ ] New env vars have Zod validation in `src/config/env.validation.ts`
- [ ] Auth-related endpoints have rate limiting

---

### 7. TypeScript Quality

- [ ] No `any` types
- [ ] No unsafe type assertions (`as SomeType`)
- [ ] All async functions properly `await` their promises
- [ ] All errors re-thrown as named NestJS exceptions (not raw `Error`)
- [ ] No `@ts-ignore` or `@ts-nocheck`

---

### 8. Kafka Conventions (if applicable)

- [ ] Topic names from `TopicEnum` in `@kafka-events` — never hardcoded strings
- [ ] Event payload matches the interface in `libs/kafka-events/src/v1/`
- [ ] New topics end in `.v1`
- [ ] Consumer group name is descriptive and consistent with existing names

---

### 9. Module & Gateway Registration

- [ ] New providers registered in the NestJS module with correct string token
- [ ] Module imported in `AppModule`
- [ ] API gateway routing updated if new route prefix introduced

---

### 10. Automated Checks — Run All of These

Run the following commands against the changed service. Record the actual output (pass/fail + any errors) — do NOT skip any step:

```bash
# Identify the service name from the changed files (e.g. user-service, auth-service, chat-service)

# 1. Type checking
pnpm nx typecheck <service-name>

# 2. Lint
pnpm nx lint <service-name>

# 3. Prettier format check
pnpm nx format:check <service-name>

# 4. Tests
pnpm nx test <service-name>
```

If any command fails, every failure is a **Blocker**. Include the exact error output in the review file under Blockers.

---

## Output Format

Write the review to `reviews/backend-<branch>-<YYYY-MM-DD>.md` using exactly this structure:

```markdown
# Backend Spec Review: <branch> — <YYYY-MM-DD>

## Summary

### What Is Implemented

- Bullet list of everything fully complete and working as intended

### What Is Pending / Incomplete

- Bullet list of missing pieces, partial implementations, or leftover TODOs
- Write "Nothing pending" if everything is complete

---

## Automated Checks

| Check                            | Result            | Notes                   |
| -------------------------------- | ----------------- | ----------------------- |
| `pnpm nx typecheck <service>`    | ✅ Pass / ❌ Fail | error summary if failed |
| `pnpm nx lint <service>`         | ✅ Pass / ❌ Fail | error summary if failed |
| `pnpm nx format:check <service>` | ✅ Pass / ❌ Fail | error summary if failed |
| `pnpm nx test <service>`         | ✅ Pass / ❌ Fail | error summary if failed |

---

## Files Changed

| File              | Type                       | Description                          |
| ----------------- | -------------------------- | ------------------------------------ |
| `path/to/file.ts` | Added / Modified / Deleted | One-line description of what changed |

---

## Blockers — Must Fix

> Breaks functionality, violates security, missing tests, or violates architecture. Cannot merge until resolved.

- **`path/to/file.ts`** — description of problem and required fix
- _(None)_ if no blockers

---

## Nitpicks — Should Fix

> Non-blocking: style, minor conventions, small improvements.

- **`path/to/file.ts`** — description
- _(None)_ if no nitpicks

---

## Verdict

**Ready to merge / Needs changes / Major rework required**

One paragraph: completeness assessment, most critical issue, and overall confidence in the implementation quality.
```

After writing the file, print the full path so the user can open it directly.
