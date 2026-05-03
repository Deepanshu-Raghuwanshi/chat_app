Read the following files before doing anything else:
- docs/architecture.md
- libs/shared-exceptions/src/ (all files — understand the error response format)

You are fixing a bug: **$ARGUMENTS**

---

## Your Task

Diagnose and fix the bug described above. Follow the structured approach below.

---

## Step 1 — Understand the Bug

Ask yourself (or confirm from the description):
1. Which service is affected? (api-gateway / auth-service / user-service / chat-service / message-service / notification-service / frontend)
2. Which layer is the bug in? (domain / application / infrastructure / interfaces / frontend hook / frontend service)
3. Is it a runtime error, a wrong response, a data integrity issue, or a UI issue?
4. Can it be reproduced consistently?

Search the relevant service for the failing code:
- If it's an HTTP error → check the controller, use case, then repository
- If it's a Kafka event issue → check the producer topic name, consumer handler, and event interface
- If it's a frontend issue → check the hook, the axios service, and the Zustand store

---

## Step 2 — Locate the Bug

Use the layering to narrow down fast:

| Symptom | Where to look |
|---|---|
| 400/422 on valid input | DTO class-validator decorators, ValidationPipe |
| 401 on authenticated requests | JwtAuthGuard, JWT secret env var, cookie name |
| 404 when record exists | Repository `findById` query, Prisma where clause |
| 500 Internal Server Error | Use case throwing unhandled exception, missing null check |
| Kafka event not consumed | Consumer group ID, topic name mismatch, offset reset policy |
| Frontend shows stale data | TanStack Query cache key mismatch, missing `invalidateQueries` |
| CORS error in browser | `CORS_ORIGIN` env var, `credentials: true` on both sides |
| Cookie not being sent | `withCredentials: true` on axios, `SameSite` / `HttpOnly` settings |

---

## Step 3 — Fix the Bug

Apply the minimal fix that solves the root cause. Do not:
- Refactor surrounding code unrelated to the bug
- Add catch-all `try/catch` blocks as a bandaid
- Change the error handling architecture

The fix must:
- Stay within the correct DDD layer (don't put business logic in the controller)
- Use the project's error types (`BadRequestException`, `NotFoundException`, etc. from `@nestjs/common`)
- Not introduce `any` types
- Not bypass `GlobalExceptionFilter` by crafting raw response objects in controllers

---

## Step 4 — Add or Update a Test

After the fix, write or update the unit test that would have caught this bug:

**File location**: `apps/<service>/tests/unit/<use-case>.spec.ts`

**Pattern** (Jest + Sinon + Chai):
```typescript
import { expect } from 'chai';
import sinon from 'sinon';
import { NotFoundException } from '@nestjs/common';

describe('<UseCase> — bug regression', () => {
  let useCase: <UseCase>;
  let repoMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    repoMock = {
      findById: sinon.stub(),
      // ... other methods
    };
    useCase = new <UseCase>(repoMock as unknown as <RepositoryPort>);
  });

  afterEach(() => sinon.restore());

  it('should <reproduce the bug condition>', async () => {
    // Arrange: set up the exact state that caused the bug
    repoMock.findById.resolves(null);

    // Act + Assert
    try {
      await useCase.execute({ userId: 'test-id' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
    }
  });
});
```

---

## Step 5 — Verify

Run these commands and fix any failures:
```bash
pnpm nx test <service-name>        # All tests pass
pnpm nx typecheck <service-name>   # No TypeScript errors
pnpm nx lint <service-name>        # No lint errors
```

If the bug is in the frontend:
```bash
pnpm nx typecheck frontend
pnpm nx test frontend
```

---

## Step 6 — Report

Summarize:
1. **Root cause**: what was wrong and which file/line
2. **Fix**: what was changed and why
3. **Test added**: file path and what it verifies
4. **Layer discipline**: confirm the fix stayed in the correct DDD layer
