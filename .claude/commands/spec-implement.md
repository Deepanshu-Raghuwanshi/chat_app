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

You are implementing the spec for: **$ARGUMENTS**

---

## Your Task

Implement the full backend feature described by the OpenAPI spec for **$ARGUMENTS** following strict DDD layering and the project's established conventions.

First, identify:
1. Which service owns this feature?
2. Which spec file describes it? (`libs/openapi-specs/src/v1/`)
3. Does the feature require a new Prisma model, Mongoose model, or uses existing ones?
4. Does it produce or consume Kafka events?

---

## Implementation Order (follow this exactly)

### Step 1 — Domain Layer (`src/domain/`)

**Entities** — if a new domain object is introduced:
```typescript
// src/domain/entities/<name>.entity.ts
export interface <Name>Props {
  id: string;
  // ... all fields
  createdAt: Date;
  updatedAt: Date;
}

export class <Name> {
  constructor(private readonly props: <Name>Props) {}
  get id(): string { return this.props.id; }
  // ... getters for all fields
  static create(props: <Name>Props): <Name> {
    return new <Name>(props);
  }
}
```

**Value Objects** — for validated, immutable domain values only.

**Domain Services** — for stateless business rules that span multiple entities.

> Domain layer has ZERO imports from application, infrastructure, or interfaces.

---

### Step 2 — Application Layer (`src/application/`)

**Port (interface)** — define the repository contract:
```typescript
// src/application/ports/<name>.repository.ts
export interface <Name>Repository {
  findById(id: string): Promise<<Name> | null>;
  create(data: Create<Name>Input): Promise<<Name>>;
  update(id: string, data: Update<Name>Input): Promise<<Name>>;
  // ... only methods this feature needs
}
```

**DTO** — for data entering the use case:
```typescript
// src/application/dto/<name>.dto.ts
export interface <Action><Name>Dto {
  userId: string;
  // ... relevant fields
}
```

**Use Case** — one file per business operation:
```typescript
// src/application/use-cases/<action>-<name>.use-case.ts
@Injectable()
export class <Action><Name>UseCase {
  constructor(
    @Inject('<Name>Repository')
    private readonly repository: <Name>Repository,
    private readonly kafkaProducer: KafkaProducerService, // if events needed
  ) {}

  async execute(dto: <Action><Name>Dto): Promise<<Name>> {
    // 1. Validate business rules (throw NestJS exceptions)
    // 2. Call repository
    // 3. Emit Kafka event (if applicable)
    // 4. Return result
  }
}
```

Rules:
- No infrastructure imports in use cases
- Throw `BadRequestException`, `NotFoundException`, `ConflictException`, `ForbiddenException` from `@nestjs/common`
- Emit Kafka events using topic constants from `@kafka-events`, never hardcode topic strings

---

### Step 3 — Infrastructure Layer (`src/infrastructure/`)

**Persistence** — implement the port:
```typescript
// src/infrastructure/persistence/prisma-<name>.repository.ts
@Injectable()
export class Prisma<Name>Repository implements <Name>Repository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<<Name> | null> {
    return this.prisma.<model>.findUnique({ where: { id } });
  }
  // ...
}
```

For MongoDB (chat/message services):
```typescript
// src/infrastructure/persistence/mongoose-<name>.repository.ts
@Injectable()
export class Mongoose<Name>Repository implements <Name>Repository {
  constructor(@InjectModel(<Name>.name) private model: Model<<Name>Document>) {}
  // ...
}
```

**Kafka Producer** (if the feature emits events):
```typescript
await this.kafkaProducer.emit(TopicEnum.TOPIC_NAME, {
  // payload matching the interface from @kafka-events
} satisfies <EventInterface>);
```

**Kafka Consumer** (if the feature consumes events):
```typescript
@Injectable()
export class <Name>Consumer implements OnModuleInit {
  constructor(private readonly useCase: <Name>UseCase) {}

  async onModuleInit() {
    // register consumer group
  }

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
  @ApiOperation({ summary: 'Short description' })
  async method(@Req() req: RequestWithUser) {
    return this.useCase.execute({ userId: req.user.id });
  }

  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: Create<Name>Dto) {
    return this.useCase.execute({ userId: req.user.id, ...dto });
  }
}
```

Rules:
- Controllers are thin — no business logic
- Always type `req` as `RequestWithUser` (extends `Request` with `user: UserProfile`)
- Add Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiBody`, `@ApiResponse`)
- File uploads use `@UseInterceptors(FileInterceptor)` + `@UploadedFile(new ParseFilePipe(...))`

---

### Step 5 — Module Registration

Register everything in the service's NestJS module:
```typescript
@Module({
  imports: [/* Prisma/Mongoose modules, KafkaModule */],
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

---

### Step 6 — API Gateway Routing

If this is a new route prefix, add it to the gateway's service map:
- File: `apps/api-gateway/src/interfaces/controllers/gateway.controller.ts`
- Add the route pattern → service URL mapping

---

### Step 7 — Database (if new model needed)

**Prisma** — add to `apps/<service>/prisma/schema.prisma` then run:
```bash
pnpm prisma:migrate:<service>
pnpm prisma:generate
```

**Mongoose** — add schema to `apps/<service>/src/infrastructure/persistence/schemas/`

---

## Quality Checklist Before Finishing

- [ ] Domain layer has no infra imports
- [ ] Use case throws named NestJS exceptions (not generic `Error`)
- [ ] Kafka topic strings come from `@kafka-events` enum (never hardcoded)
- [ ] Controller has Swagger decorators on every endpoint
- [ ] Repository bound with `provide: '<Name>Repository'` string token
- [ ] New env vars added to `src/config/env.validation.ts` Zod schema
- [ ] Module registered in `AppModule`
- [ ] No `any` types anywhere
- [ ] Run `pnpm nx typecheck <service-name>` and fix all errors
- [ ] Run `pnpm nx lint <service-name>` and fix all warnings
