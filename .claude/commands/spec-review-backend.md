**Before reading any files or running any commands, do this first:**

Parse `$ARGUMENTS`. The user may have passed just a feature name, or a feature name plus a path to a requirement spec document.

- If `$ARGUMENTS` includes a file path to a requirement spec (e.g. `docs/specs/friend-search.md`, `specs/chat-feature.md`, or any `.md`/`.txt` path), read that file now and use it throughout the review.
- If `$ARGUMENTS` contains only a feature name with no spec reference, **stop and ask the user**:

  > "Do you have a requirement spec or design document for **[feature name]**? If so, paste the file path (e.g. `docs/specs/friend-search.md`) or paste its contents directly — the review will cross-check the implementation against it. If you don't have one, reply **skip** and I'll proceed using the OpenAPI spec and existing patterns only."

  Wait for the user's reply before proceeding. If they provide a spec, read it. If they reply "skip" or "no", continue without it and note "No requirement spec provided" in the review file.

---

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
- Run `git diff HEAD` to read the exact line-by-line diff of all changes — this is your primary review target
- Read each changed file **in full** (not just the diff) so you see context around changes
- Run `git branch --show-current` to get the branch name

You are reviewing the backend implementation for: **$ARGUMENTS**

---

## Your Task

Review the local backend changes for **$ARGUMENTS** against the OpenAPI spec, the project's DDD architecture, existing patterns, and test requirements. Apply maximum strictness — if something could be done better, flag it. Then write the full review to a `.md` file at:

```
reviews/backend-<branch>-<YYYY-MM-DD>.md
```

Create the `reviews/` directory if it doesn't exist.

---

## Review Dimensions

### 0. Requirement Spec Compliance (only if a spec was provided)

If the user provided a requirement spec, this is your **highest-priority dimension**. Read the spec and verify the implementation against every requirement stated in it:

- Are all features/behaviours described in the spec implemented? List each requirement and mark it as implemented, partially implemented, or missing.
- Does the implementation match the described data shapes, flows, and business rules exactly?
- Are there behaviours in the spec that the OpenAPI spec does not capture (e.g. business rules, state machine transitions, edge case handling)?
- Are there things implemented in the code that the spec explicitly says should NOT be done?
- Does error handling match what the spec prescribes (specific messages, specific codes)?

Any requirement from the spec that is missing or incorrect in the implementation is a **Blocker** — prefix it with **[SPEC]** in the Blockers section.

If no spec was provided, skip this section and write "No requirement spec provided — reviewed against OpenAPI spec and existing patterns only."

---

### 1. Implementation Completeness — Is it 100% done?

Compare the changed code against the OpenAPI spec for this feature (`libs/openapi-specs/src/v1/`):

- Are ALL endpoints defined in the spec implemented?
- Do all request/response shapes exactly match the spec (field names, types, optional/required)?
- Are all HTTP status codes handled (200, 201, 400, 401, 403, 404, 409, 422, 500)?
- Are all edge cases and error paths covered in the use case logic?
- Are there any `TODO`, `FIXME`, `HACK`, or placeholder comments left in the code?
- Is the API gateway routing updated for new route prefixes?
- If a new Prisma/Mongoose model was needed, is the schema added and migration run?
- Are all required query params, path params, and body fields validated via DTO?

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
- Each use case handles ONE responsibility — flag multi-responsibility use cases

**Controllers** — must follow `user.controller.ts` pattern:

- `@ApiTags`, `@ApiBearerAuth`, `@UseGuards(JwtAuthGuard)` on the class
- `@ApiOperation`, `@ApiResponse` on every method
- `req` typed as `RequestWithUser`
- No business logic — only delegates to use case
- No direct repository injection — only use cases

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
- Is there copy-paste between use cases that should be a shared utility?
- Are there helper methods duplicated across multiple files?

---

### 5. Test Coverage — Are all tests written?

For every new use case added, verify:

- [ ] Test file exists at `apps/<service>/tests/unit/<name>.use-case.spec.ts`
- [ ] Uses sinon stubs for all repository and Kafka dependencies (no real DB)
- [ ] Tests the success path
- [ ] Tests every failure path (each exception the use case can throw)
- [ ] Tests concurrent edge cases if the use case has race condition risk
- [ ] Assertions use Chai (`expect(...).to.equal()` / `.to.be.true` / `.to.throw`)
- [ ] Test file follows the same describe/it structure as existing tests
- [ ] Test descriptions are specific, not vague ("should work", "should succeed")
- [ ] No test depends on another test's state (each `it` is independent)

If any use case is missing tests, that is a **Blocker**.

---

### 6. Security

- [ ] Every endpoint that handles user data has `@UseGuards(JwtAuthGuard)`
- [ ] No sensitive fields (password, token, secret, hash) returned in API responses
- [ ] No `console.log` calls that could print sensitive values
- [ ] No raw SQL/MongoDB queries (use Prisma/Mongoose query builders only)
- [ ] New env vars have Zod validation in `src/config/env.validation.ts`
- [ ] Auth-related endpoints have rate limiting via `@Throttle()`
- [ ] User-supplied IDs are authorized — verify the requesting user owns the resource before acting on it
- [ ] No path traversal risk if file paths come from user input
- [ ] DTOs use class-validator decorators to reject unexpected input
- [ ] No overly-permissive CORS settings introduced

---

### 7. Performance & Query Optimization

This section is critical — flag anything that will cause slowness at scale:

- [ ] No N+1 queries: check repository implementations for loops that call the DB inside each iteration
- [ ] List/find queries use `limit`/`take` with pagination — never fetch unbounded collections
- [ ] Queries only select fields that are actually used — no `SELECT *` equivalent
- [ ] Frequently-filtered fields have corresponding database indexes in the schema
- [ ] No synchronous heavy computation inside an async request handler
- [ ] Kafka producers do not `await` message delivery on the critical path if it is not required
- [ ] Repository methods that are called in a loop are batched into a single query instead

---

### 8. Error Handling & Resilience

- [ ] Every use case that can fail has explicit error handling — no silent swallowing of errors
- [ ] Errors are caught and re-thrown as named NestJS exceptions — never raw `throw new Error()`
- [ ] External service failures (DB down, Kafka unavailable) are handled gracefully and logged
- [ ] Operations that must be atomic use a Prisma/Mongoose transaction — no partial state left on failure
- [ ] Idempotent endpoints (PUT, DELETE) handle duplicate calls without exploding
- [ ] No unhandled promise rejections (every `await` inside `try/catch` or the error propagates correctly)

---

### 9. TypeScript Quality

- [ ] No `any` types
- [ ] No unsafe type assertions (`as SomeType`)
- [ ] All async functions properly `await` their promises — no floating promises
- [ ] All errors re-thrown as named NestJS exceptions (not raw `Error`)
- [ ] No `@ts-ignore` or `@ts-nocheck`
- [ ] Return types are explicit on all public methods — no implicit `any` return
- [ ] Generic types used correctly — no `Array<any>` or `Promise<any>`

---

### 10. Code Complexity & Maintainability

Flag these code smells that make future changes risky:

- [ ] No function/method exceeds 40 lines — if it does, it likely has multiple responsibilities
- [ ] No use case `execute()` method has more than 3 levels of nesting
- [ ] No magic numbers or strings — named constants or enum values only
- [ ] Method names are verbs that describe what they do (`getUserById` not `user`)
- [ ] No commented-out code left in the diff

---

### 11. Kafka Conventions (if applicable)

- [ ] Topic names from `TopicEnum` in `@kafka-events` — never hardcoded strings
- [ ] Event payload matches the interface in `libs/kafka-events/src/v1/`
- [ ] New topics end in `.v1`
- [ ] Consumer group name is descriptive and consistent with existing names
- [ ] Kafka producers are not called inside DB transactions (publish after commit)

---

### 12. Module & Gateway Registration

- [ ] New providers registered in the NestJS module with correct string token
- [ ] Module imported in `AppModule`
- [ ] API gateway routing updated if new route prefix introduced
- [ ] No circular module dependencies introduced

---

### 13. Breaking Changes Detection

Check if any of the following changed in a backwards-incompatible way:

- [ ] Existing endpoint URLs renamed or removed
- [ ] Existing request fields made required that were previously optional
- [ ] Existing response fields removed or renamed
- [ ] Existing Kafka event payloads changed without a new topic version
- [ ] Existing shared types in `libs/shared-types` changed in a breaking way

Any breaking change without a migration plan is a **Blocker**.

---

### 14. Automated Checks — Run All of These

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

> Breaks functionality, violates security, missing tests, violates architecture, or introduces a breaking change. Cannot merge until resolved.

- **[SECURITY] `path/to/file.ts`** — description of problem and required fix
- **[PERF] `path/to/file.ts`** — N+1 query in X method — replace with batched query
- **[ARCH] `path/to/file.ts`** — domain layer imports infrastructure
- **[TEST] `path/to/file.ts`** — use case has no tests
- **[BREAKING] `path/to/file.ts`** — removed field from response without versioning
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
