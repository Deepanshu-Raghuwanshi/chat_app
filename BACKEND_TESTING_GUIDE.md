# Backend Testing Guide: Standards & Patterns

This guide provides a standardized approach to writing backend tests across all microservices (Auth, User, Chat, etc.) using **Mocha**, **Chai**, and **Sinon**.

## 1. Directory Structure
Every service must follow this test structure within its `tests/` directory:

```text
tests/
├── unit/               # Business logic & Use case tests
│   └── *.spec.ts
├── integration/        # Controller & API tests
│   └── *.spec.ts
├── fixtures/           # Mock data (JSON) - use descriptive names like auth-payloads.json
│   └── *.json
├── mocks/              # Middleware & service mocks
│   └── auth.mock.ts
└── helpers/            # Test utilities
    └── test-setup.ts
```

## 2. Authentication Mocking (Middleware/Guards)
For API tests that require an authenticated user without hitting the real `auth-service`, use the following mock pattern.

### `tests/mocks/auth.mock.ts`
```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Inject a dummy user into the request object
    request.user = {
      id: 'test-user-uuid',
      email: 'test@example.com',
      isVerified: true
    };
    
    return true; // Always allow
  }
}
```

### Usage in Integration Tests
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { MockAuthGuard } from '../mocks/auth.mock';

// Inside your test setup
const moduleFixture: TestingModule = await Test.createTestingModule({
  imports: [AppModule],
})
.overrideGuard(AuthGuard('jwt')) // Override the real guard
.useValue(new MockAuthGuard())
.compile();
```

## 3. Mock Data Strategy
- Keep all mock data in `fixtures/*.json` with descriptive names (e.g., `auth-payloads.json`).
- Never hardcode user IDs or emails directly in `.spec.ts` files if they are reused.

```json
{
  "validUser": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "dev@chat-app.com",
    "password": "Password123!"
  },
  "invalidUser": {
    "email": "wrong@email.com",
    "password": "wrong"
  }
}
```

## 4. Development Guidelines

### A. Strict Typing & Linting
- **No `any`**: Never use `any` in tests. Use `unknown` with type guards or explicit interfaces/types from `@shared-types` or service-specific models.
- **Mocking**: Use `sinon.StubbedInstance<T>` or `Stubbed<T>` helper for type-safe mocks.
- **Linting**: Tests must pass all ESLint rules. Do **NOT** use `/* eslint-disable */`.
- **Assertions**: Chai property assertions (like `.to.be.true`) trigger `no-unused-expressions`. Use function-style assertions instead:
  - `expect(stub.calledOnce).to.equal(true);`
  - `expect(result).to.equal(null);`
  - `expect(array).to.have.lengthOf(1);`

### B. Writing Unit Tests
- **Focus**: Test a single class/function in isolation.
- **Rule**: Mock all external dependencies (Repositories, Kafka, Mailer).
- **Assertion**: Use `expect` from Chai.

### C. Writing Integration Tests
- **Focus**: HTTP status codes, payload validation, and database state.
- **Rule**: Use `supertest` for making requests.
- **Database**: Use a dedicated test schema or truncate tables before each test suite.

### D. Naming Conventions
- Test files: `[name].spec.ts`
- Test suites: `describe('[Service/Controller Name]', ...)`
- Test cases: `it('should [expected behavior] when [condition]', ...)`

## 5. Standard Test Template
```typescript
import { expect } from 'chai';
import * as sinon from 'sinon';
import { MyUseCase } from '../../src/application/use-cases/my.use-case';
import { MyRepository } from '../../src/application/ports/my.repository';

describe('MyUseCase Unit Test', () => {
  let useCase: MyUseCase;
  let repoMock: sinon.SinonStubbedInstance<MyRepository>;

  beforeEach(() => {
    repoMock = sinon.createStubInstance(MyRepository);
    useCase = new MyUseCase(repoMock as unknown as MyRepository);
  });

  it('should return data when record exists', async () => {
    const expectedData = { id: '1', name: 'Test' };
    repoMock.findOne.resolves(expectedData);
    
    const result = await useCase.execute('1');
    
    expect(result.name).to.equal('Test');
    expect(repoMock.findOne.calledOnce).to.equal(true);
  });
});
```

## 6. Commands
Add these to the `project.json` of each service:
```json
"test": {
  "executor": "nx:run-commands",
  "options": {
    "command": "mocha -r ts-node/register 'apps/your-service/tests/**/*.spec.ts'"
  }
}
```
