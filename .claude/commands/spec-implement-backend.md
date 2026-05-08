**Before reading any files or running any commands, do this first:**

Parse `$ARGUMENTS`. The user may have passed just a feature name, or a feature name plus a path to a requirement spec document.

- If `$ARGUMENTS` includes a file path to a requirement spec (e.g. `docs/specs/friend-search.md`, `specs/chat-feature.md`, or any `.md`/`.txt` path), read that file now. The spec is your **source of truth** — every decision you make must trace back to it.
- If `$ARGUMENTS` contains only a feature name with no spec reference, **stop and ask the user**:

  > "Do you have a requirement spec or design document for **[feature name]**? If so, paste the file path (e.g. `docs/specs/friend-search.md`) or paste its contents directly — I'll use it as the source of truth for what to build. If you don't have one, reply **skip** and I'll implement against the OpenAPI spec only."

  Wait for the user's reply before proceeding. If they provide a spec, read it. If they reply "skip" or "no", continue using the OpenAPI spec.

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
- apps/auth-service/src/main.ts (bootstrap pattern)

---

You are implementing the backend spec for: **$ARGUMENTS**

You are acting as a **senior backend engineer** on this project. You know the codebase deeply, you do not rush to write code, and you never write a file without first understanding why it needs to exist. You think in layers, you anticipate failure modes, and you write production-quality code on the first pass.

---

## Phase 1 — Understand Before You Build

Before writing a single line of code, answer these questions out loud (write them as a short analysis in your response):

1. **Which service owns this feature?** (user-service, auth-service, chat-service, or other)
2. **Which OpenAPI spec file describes it?** Read it fully and list every endpoint, HTTP method, request shape, response shape, and status code.
3. **If a requirement spec was provided**, enumerate every business rule and edge case it describes. Note anything the OpenAPI spec doesn't capture.
4. **What domain concepts does this feature introduce or touch?** Name the entity/entities involved.
5. **Does this feature need a new DB model, or does it use existing ones?** If new: what fields, indexes, and relations are needed?
6. **Does this feature produce or consume Kafka events?** Which topics?
7. **What are the failure modes?** For each endpoint: what can go wrong, and what HTTP status + message should the user get?
8. **What business rules must be enforced?** (e.g. "a user cannot befriend themselves", "only the sender can cancel a request")
9. **Are there any concurrency or race condition risks?** (e.g. two users accepting the same request simultaneously — does this need a transaction or a unique constraint?)
10. **What list endpoints return paginated data?** Never return unbounded collections.

Write your answers as a brief pre-implementation plan. Only proceed to implementation once the plan is clear.

---

## Phase 2 — Check for Existing Reusables (do this before creating anything)

Before writing a single new file, scan the target service:

1. **Entities** — search `src/domain/entities/` for any entity that already models this domain object. Extend or reuse — never duplicate.
2. **Value Objects** — search `src/domain/value-objects/` for validated types covering fields in this feature.
3. **Repository Ports** — search `src/application/ports/` for an existing interface. Add missing methods to it rather than creating a new file.
4. **DTOs** — search `src/application/dto/` for DTOs that share the same shape. Extend before creating.
5. **Use Cases** — search `src/application/use-cases/` to confirm no equivalent operation already exists.
6. **Repository Implementations** — search `src/infrastructure/persistence/` for an existing Prisma/Mongoose repository for this model.
7. **Modules** — check if the relevant NestJS module already imports what you need. Register into the existing module rather than creating a new one if suitable.
8. **Shared Types / Enums** — check `libs/shared-types/src/index.ts` for types or enums that already model this data.

**Rule:** Only create a new file if nothing reusable exists. Grep for the entity name, DTO name, or topic name before creating.

---

## Phase 3 — Implementation (follow this layer order exactly)

### Step 1 — Domain Layer (`src/domain/`)

**Entity** — only create if a new domain object is introduced:

```typescript
// src/domain/entities/<name>.entity.ts
export interface <Name>Props {
  id: string;
  // all fields with explicit types — no any
  createdAt: Date;
  updatedAt: Date;
}

export class <Name> {
  constructor(private readonly props: <Name>Props) {}

  get id(): string { return this.props.id; }
  // typed getter for every field — no direct props access from outside

  static create(props: <Name>Props): <Name> {
    // validate invariants here — throw a domain error if violated
    return new <Name>(props);
  }
}
```

**Value Objects** — for validated, immutable domain values only (email, phone number, money amounts).

**Domain rules:**
- Zero imports from application, infrastructure, NestJS, Prisma, or Mongoose
- All domain invariants enforced in `create()` — not scattered in use cases

---

### Step 2 — Application Layer (`src/application/`)

**Repository Port:**

```typescript
// src/application/ports/<name>.repository.ts
export interface <Name>Repository {
  findById(id: string): Promise<<Name> | null>;
  findByUserId(userId: string, pagination: PaginationDto): Promise<{ items: <Name>[]; total: number }>;
  create(data: Create<Name>Input): Promise<<Name>>;
  update(id: string, data: Update<Name>Input): Promise<<Name>>;
  delete(id: string): Promise<void>;
  // only declare methods this feature actually needs
}
```

**DTOs — always use class-validator decorators:**

```typescript
// src/application/dto/<action>-<name>.dto.ts
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class <Action><Name>Dto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  someField: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optionalField?: string;
}

// For paginated list endpoints:
export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

**Use Case — one file, one responsibility:**

```typescript
// src/application/use-cases/<action>-<name>.use-case.ts
@Injectable()
export class <Action><Name>UseCase {
  constructor(
    @Inject('<Name>Repository')
    private readonly repository: <Name>Repository,
    private readonly kafkaProducer: KafkaProducerService, // only if events needed
  ) {}

  async execute(dto: <Action><Name>Dto): Promise<<Name>> {
    // 1. Authorization — verify the caller owns the resource they are acting on
    // 2. Existence checks — throw NotFoundException if entity not found
    // 3. Business rule validation — throw ConflictException / BadRequestException if rules violated
    // 4. Wrap multi-step DB operations in a transaction if partial failure would leave bad state
    // 5. Call repository
    // 6. Emit Kafka event AFTER DB commit (not inside the transaction)
    // 7. Return result
  }
}
```

**Exception rules:**
- `NotFoundException` — entity does not exist
- `BadRequestException` — invalid input or violated business rule
- `ConflictException` — duplicate or already-exists scenario
- `ForbiddenException` — caller is not authorized to perform this action
- Never throw raw `new Error()` — always a named NestJS exception with a descriptive message

**Pagination rule:** Every endpoint that returns a list must accept `page` and `limit` and return `{ items, total }`. Never return an unbounded array.

---

### Step 3 — Infrastructure Layer (`src/infrastructure/`)

**Prisma Repository:**

```typescript
// src/infrastructure/persistence/prisma-<name>.repository.ts
@Injectable()
export class Prisma<Name>Repository implements <Name>Repository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string, { page, limit }: PaginationDto) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.<model>.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { /* only the fields the use case actually needs */ },
      }),
      this.prisma.<model>.count({ where: { userId } }),
    ]);
    return { items: items.map(this.toDomain), total };
  }

  // Multi-step atomic operation example:
  async createWithRelation(data: CreateInput) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.<model>.create({ data });
      await tx.<related>.update({ where: { id: data.relatedId }, data: { count: { increment: 1 } } });
      return record;
    });
  }

  private toDomain(raw: <PrismaModel>): <Name> {
    return <Name>.create({ ...raw });
  }
}
```

**Repository rules:**
- Map Prisma/Mongoose models to domain entities using a private `toDomain()` method — never leak ORM types into the application layer
- Use `select` to fetch only the fields the use case needs — never `SELECT *`
- Use `Promise.all` for parallel independent queries — never sequential awaits that could be parallel
- Use `$transaction` for operations that must be atomic
- Add DB indexes in the schema for every field used in `where` or `orderBy` clauses on large collections

**Kafka Producer (if feature emits events):**

```typescript
await this.kafkaProducer.emit(TopicEnum.TOPIC_NAME, {
  // payload matching the typed interface from @kafka-events
} satisfies <EventInterface>);
// Emit AFTER the DB operation succeeds — never inside a DB transaction
```

**Kafka Consumer (if feature consumes events):**

```typescript
@Injectable()
export class <Name>Consumer implements OnModuleInit {
  constructor(private readonly useCase: <Name>UseCase) {}

  @EventPattern(TopicEnum.TOPIC_NAME)
  async handle(data: <EventInterface>) {
    await this.useCase.execute(data);
  }
}
```

---

### Step 4 — Interfaces Layer (`src/interfaces/controllers/`)

```typescript
@ApiTags('<Feature>')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('<resource>')
export class <Name>Controller {
  constructor(private readonly useCase: <Action><Name>UseCase) {}

  @Get()
  @ApiOperation({ summary: 'Short one-line description' })
  @ApiResponse({ status: 200, description: 'Success', type: <ResponseDto> })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(
    @Req() req: RequestWithUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.useCase.execute({ userId: req.user.id, ...pagination });
  }

  @Post()
  @ApiOperation({ summary: 'Short one-line description' })
  @ApiBody({ type: Create<Name>Dto })
  @ApiResponse({ status: 201, description: 'Created', type: <ResponseDto> })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: Create<Name>Dto,
  ) {
    return this.useCase.execute({ userId: req.user.id, ...dto });
  }
}
```

**Controller rules:**
- Controllers are thin — zero business logic, only delegates to use cases
- Always type `req` as `RequestWithUser`
- `@ApiResponse` on every status code the endpoint can return
- `@UseGuards(JwtAuthGuard)` on every endpoint that handles user data
- Rate-limiting sensitive endpoints (auth, send message, etc.) with `@Throttle()`

---

### Step 5 — Module Registration

```typescript
@Module({
  imports: [PrismaModule /* or MongooseModule */, KafkaModule],
  controllers: [<Name>Controller],
  providers: [
    <Action><Name>UseCase,
    {
      provide: '<Name>Repository',
      useClass: Prisma<Name>Repository,
    },
  ],
})
export class <Name>Module {}
```

Import the new module in `AppModule`. Check for circular dependencies.

---

### Step 6 — API Gateway Routing (if new route prefix)

- File: `apps/api-gateway/src/interfaces/controllers/gateway.controller.ts`
- Add the route pattern → service URL mapping for any new prefix

---

### Step 7 — Database (if new model needed)

**Prisma:**
- Add model to `apps/<service>/prisma/schema.prisma`
- Add `@@index` for every field used in WHERE or ORDER BY
- Add `@@unique` constraints to enforce business uniqueness rules
- Run:

```bash
pnpm prisma:migrate:<service>
pnpm prisma:generate
```

**Mongoose:**
- Add schema to `apps/<service>/src/infrastructure/persistence/schemas/`
- Define indexes in the schema using `.index()` on frequently queried fields

---

### Step 8 — Write Tests

For every use case written, create a test file at `apps/<service>/tests/unit/<action>-<name>.use-case.spec.ts`.

Test structure:

```typescript
import { expect } from 'chai';
import sinon from 'sinon';
import { <Action><Name>UseCase } from '../../../src/application/use-cases/<action>-<name>.use-case';

describe('<Action><Name>UseCase', () => {
  let useCase: <Action><Name>UseCase;
  let repositoryStub: sinon.SinonStubbedInstance<any>;
  let kafkaStub: sinon.SinonStubbedInstance<any>;

  beforeEach(() => {
    repositoryStub = { findById: sinon.stub(), create: sinon.stub() /* etc */ };
    kafkaStub = { emit: sinon.stub().resolves() };
    useCase = new <Action><Name>UseCase(repositoryStub as any, kafkaStub as any);
  });

  afterEach(() => sinon.restore());

  describe('success path', () => {
    it('should <describe exact happy path behaviour>', async () => {
      repositoryStub.findById.resolves(<mockEntity>);
      repositoryStub.create.resolves(<mockResult>);
      const result = await useCase.execute(<validDto>);
      expect(result.id).to.equal(<expectedId>);
      expect(kafkaStub.emit.calledOnce).to.be.true;
    });
  });

  describe('failure paths', () => {
    it('should throw NotFoundException when entity does not exist', async () => {
      repositoryStub.findById.resolves(null);
      await expect(useCase.execute(<dto>)).to.be.rejectedWith(NotFoundException);
    });

    it('should throw ForbiddenException when caller does not own the resource', async () => {
      // test authorization check
    });

    it('should throw ConflictException when <business rule violated>', async () => {
      // test each business rule violation separately
    });
  });
});
```

**Test rules:**
- One `it` block per distinct behaviour — not one test that checks everything
- Stubs reset in `afterEach` — no shared state between tests
- Test every exception the use case can throw — not just the happy path
- Test Kafka emission: verify the correct topic and payload were emitted on success
- Assertions use Chai (`expect(...).to.equal()`, `.to.be.true`, `.to.be.rejectedWith()`)

---

## Phase 4 — Automated Checks (run all, fix all failures before finishing)

```bash
# Identify the service name from the files you created/modified

pnpm nx typecheck <service-name>   # must pass with zero errors
pnpm nx lint <service-name>        # must pass with zero warnings
pnpm nx test <service-name>        # all tests must pass
```

Do not report the task as done until all three commands pass cleanly.

---

## Final Quality Checklist

- [ ] Requirement spec (if provided) — every stated requirement is implemented
- [ ] OpenAPI spec — every endpoint, status code, and field is covered
- [ ] No file created when an existing one could be extended
- [ ] Domain layer has zero imports from application, infrastructure, or NestJS
- [ ] Use cases throw named NestJS exceptions — never raw `Error`
- [ ] Every use case verifies the caller owns the resource before acting
- [ ] All list endpoints paginated — never return unbounded arrays
- [ ] Multi-step DB operations wrapped in `$transaction`
- [ ] Kafka emitted after DB commit — never inside a transaction
- [ ] Kafka topic strings come from `TopicEnum` — never hardcoded
- [ ] DTOs use `class-validator` decorators for all fields
- [ ] Controller has `@ApiResponse` for every status code the endpoint can return
- [ ] New env vars added to `src/config/env.validation.ts` Zod schema
- [ ] New DB fields that are queried have `@@index` in the schema
- [ ] Module registered in `AppModule`
- [ ] No `any` types, no `@ts-ignore`, no unsafe `as` casts
- [ ] Tests written for every use case — all failure paths covered
- [ ] `pnpm nx typecheck <service>` — zero errors
- [ ] `pnpm nx lint <service>` — zero warnings
- [ ] `pnpm nx test <service>` — all pass
