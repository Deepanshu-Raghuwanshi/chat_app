Read the following files before doing anything else:
- apps/user-service/tests/unit/get-profile.use-case.spec.ts
- apps/user-service/tests/unit/update-profile.use-case.spec.ts
- apps/user-service/tests/unit/update-avatar.use-case.spec.ts
- apps/user-service/src/application/use-cases/ (list all use cases in this directory)

Then read the use case(s) you are about to test.

You are writing tests for: **$ARGUMENTS**

---

## Your Task

Write comprehensive unit tests for the use case(s) or module described above.

---

## Testing Stack

- **Test runner**: Jest (configured per service in `jest.config.ts`)
- **Stubs**: Sinon (`sinon.stub()`, `sinon.SinonStubbedInstance`)
- **Assertions**: Chai (`expect(...).to.equal()`, `.to.deep.equal()`, `.to.be.instanceOf()`)
- **File location**: `apps/<service>/tests/unit/<use-case-name>.spec.ts`

---

## Test File Structure

```typescript
import { expect } from 'chai';
import sinon from 'sinon';
import { <ExceptionType> } from '@nestjs/common';
import { <UseCase> } from '../../src/application/use-cases/<use-case>.use-case';
import type { <RepositoryPort> } from '../../src/application/ports/<repository>.port';
// Import entity types if needed
import type { <Entity> } from '../../src/domain/entities/<entity>.entity';

describe('<UseCase>', () => {
  let useCase: <UseCase>;
  let repoStub: Record<string, sinon.SinonStub>;
  let kafkaStub: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    repoStub = {
      findById: sinon.stub(),
      create: sinon.stub(),
      update: sinon.stub(),
      // ... all methods the use case calls
    };

    kafkaStub = {
      emit: sinon.stub().resolves(),
    };

    useCase = new <UseCase>(
      repoStub as unknown as <RepositoryPort>,
      kafkaStub as unknown as KafkaProducerService, // omit if no Kafka
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  // --- SUCCESS PATHS ---

  describe('execute — success', () => {
    it('should return <expected result> when <condition>', async () => {
      // Arrange
      const mockInput = { userId: 'user-uuid-1', /* ... */ };
      const mockEntity = { id: 'entity-uuid-1', /* ... */ } as <Entity>;
      repoStub.findById.resolves(mockEntity);
      repoStub.update.resolves(mockEntity);

      // Act
      const result = await useCase.execute(mockInput);

      // Assert
      expect(result).to.deep.equal(mockEntity);
      expect(repoStub.findById.calledOnceWith(mockInput.userId)).to.equal(true);
    });

    it('should emit <kafka topic> event when <action> succeeds', async () => {
      // Arrange
      const mockInput = { senderId: 'user-1', receiverId: 'user-2' };
      repoStub.create.resolves({ id: 'req-1', ...mockInput });

      // Act
      await useCase.execute(mockInput);

      // Assert
      expect(kafkaStub.emit.calledOnce).to.equal(true);
      const [topic, payload] = kafkaStub.emit.firstCall.args;
      expect(topic).to.equal('expected.topic.v1');
      expect(payload.senderId).to.equal(mockInput.senderId);
    });
  });

  // --- FAILURE PATHS ---

  describe('execute — failures', () => {
    it('should throw NotFoundException when entity does not exist', async () => {
      repoStub.findById.resolves(null);

      try {
        await useCase.execute({ userId: 'nonexistent' });
        expect.fail('Should have thrown NotFoundException');
      } catch (error: unknown) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect((error as Error).message).to.equal('<expected error message>');
      }
    });

    it('should throw ConflictException when <duplicate condition>', async () => {
      repoStub.findById.resolves({ id: 'existing' });

      try {
        await useCase.execute({ /* conflicting input */ });
        expect.fail('Should have thrown ConflictException');
      } catch (error: unknown) {
        expect(error).to.be.instanceOf(ConflictException);
      }
    });

    it('should throw BadRequestException when <invalid input>', async () => {
      const invalidInput = { userId: 'user-1', targetId: 'user-1' }; // same user

      try {
        await useCase.execute(invalidInput);
        expect.fail('Should have thrown BadRequestException');
      } catch (error: unknown) {
        expect(error).to.be.instanceOf(BadRequestException);
      }
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      repoStub.findById.resolves({ id: 'record-1', ownerId: 'other-user' });

      try {
        await useCase.execute({ userId: 'requester', recordId: 'record-1' });
        expect.fail('Should have thrown ForbiddenException');
      } catch (error: unknown) {
        expect(error).to.be.instanceOf(ForbiddenException);
      }
    });
  });

  // --- SIDE EFFECTS ---

  describe('execute — side effects', () => {
    it('should NOT emit Kafka event when <operation> fails', async () => {
      repoStub.create.rejects(new Error('DB error'));

      try {
        await useCase.execute({ /* input */ });
      } catch {
        // ignore
      }

      expect(kafkaStub.emit.called).to.equal(false);
    });

    it('should call repository with correct arguments', async () => {
      const dto = { userId: 'user-1', name: 'Updated Name' };
      repoStub.findById.resolves({ id: 'user-1' });
      repoStub.update.resolves({ id: 'user-1', name: 'Updated Name' });

      await useCase.execute(dto);

      expect(repoStub.update.calledWith('user-1', { name: 'Updated Name' })).to.equal(true);
    });
  });
});
```

---

## What to Cover for Every Use Case

For each use case, write tests for ALL of these:

### Success paths
- [ ] Happy path: valid input, entity exists, returns expected result
- [ ] Edge case: optional fields omitted, still works
- [ ] Kafka event is emitted with correct topic and payload (if applicable)

### Failure paths
- [ ] `NotFoundException` — entity not found
- [ ] `BadRequestException` — invalid input (self-referential action, missing field, wrong format)
- [ ] `ConflictException` — duplicate record, state conflict
- [ ] `ForbiddenException` — user does not own the resource

### Side effects
- [ ] Repository method called with exact expected arguments
- [ ] Kafka event NOT emitted if the operation fails
- [ ] No extra repository calls made beyond what is necessary

---

## Rules

- **No real database** — all repositories are sinon stubs
- **No NestJS DI** — instantiate the use case directly with `new UseCase(stub, stub)`
- **Sinon stubs** for all dependencies (repos, kafka, redis, cloudinary)
- **Chai assertions**: `expect(...).to.equal()` not Jest's `expect(...).toBe()`
- **afterEach**: always call `sinon.restore()` to clean up stubs between tests
- **Test file name**: matches the use case file name with `.spec.ts` suffix
- **No `any` types** in test files either

---

## After Writing Tests

Run:
```bash
pnpm nx test <service-name>
```

All tests must pass. Fix any failures before reporting done.
