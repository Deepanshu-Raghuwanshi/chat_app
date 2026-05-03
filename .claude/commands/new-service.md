Read the following files before doing anything else:
- docs/architecture.md
- apps/user-service/src/main.ts (bootstrap pattern)
- apps/user-service/src/app.module.ts (module pattern)
- apps/user-service/src/config/env.validation.ts (Zod env schema pattern)
- apps/auth-service/prisma/schema.prisma (Prisma schema pattern — if new service uses PostgreSQL)
- docker-compose.yml (port conventions)
- package.json (start scripts pattern)
- apps/api-gateway/src/interfaces/controllers/gateway.controller.ts (routing pattern)

You are scaffolding a new microservice called: **$ARGUMENTS**

---

## Your Task

Create a complete, production-ready NestJS microservice following every convention established in this monorepo.

---

## Step 1 — Determine the Service Profile

Before writing any code, answer:
1. **Database**: PostgreSQL (Prisma) or MongoDB (Mongoose)?
2. **Port**: Pick the next available port in sequence (check docker-compose.yml for current highest)
3. **Kafka role**: Producer only / Consumer only / Both / Neither?
4. **Auth required**: Does this service validate JWTs on its endpoints?
5. **OpenAPI spec**: Does a spec already exist at `libs/openapi-specs/src/v1/<name>.yaml`? If not, run `/spec-create` first.

---

## Step 2 — Create the Nx Application

The service directory should be at `apps/<service-name>/` following the same structure as `apps/user-service/`.

Create the full directory tree:
```
apps/<service-name>/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   └── value-objects/
│   ├── application/
│   │   ├── use-cases/
│   │   ├── ports/
│   │   └── dto/
│   ├── infrastructure/
│   │   ├── persistence/
│   │   ├── messaging/         # Kafka producer/consumer (if needed)
│   │   ├── guards/            # JwtAuthGuard (if auth required)
│   │   └── cache/             # Redis (if needed)
│   ├── interfaces/
│   │   └── controllers/
│   ├── config/
│   │   └── env.validation.ts
│   ├── app.module.ts
│   └── main.ts
├── tests/
│   └── unit/
├── project.json               # Nx project config
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.ts
└── package.json
```

---

## Step 3 — Write `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@shared-exceptions';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('<ServiceName> Service API')
    .setDescription('<ServiceName> service for the chat system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || <port>;
  await app.listen(port);
}

bootstrap();
```

---

## Step 4 — Write `src/config/env.validation.ts`

```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(<port>),
  // Add database URL:
  // DATABASE_URL: z.string().url(),        // for PostgreSQL
  // MONGODB_URL: z.string().url(),         // for MongoDB
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  JWT_ACCESS_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  return result.data;
}
```

---

## Step 5 — Write `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validate } from './config/env.validation';
import { loggerConfig } from '@shared-logger';
// import domain modules here

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    LoggerModule.forRoot(loggerConfig),
    // PrismaModule or MongooseModule
    // KafkaModule (if needed)
    // Domain feature modules
  ],
})
export class AppModule {}
```

---

## Step 6 — Prisma (if PostgreSQL service)

Create `apps/<service-name>/prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../../../node_modules/@prisma/client-<service>"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["<service_schema>"]
}
```

Add the migration script to root `package.json`:
```json
"prisma:migrate:<service>": "prisma migrate dev --schema=apps/<service-name>/prisma/schema.prisma"
```

---

## Step 7 — Add to Nx (`project.json`)

Copy structure from `apps/user-service/project.json` and update:
- `name` field
- `sourceRoot`
- All script paths

---

## Step 8 — Add to Docker Compose

Add the service URL to the root `.env`:
```
<SERVICE_NAME>_SERVICE_URL=http://localhost:<port>
```

---

## Step 9 — Register in API Gateway

In `apps/api-gateway/src/interfaces/controllers/gateway.controller.ts`, add the new service to the service map:
```typescript
'<service-name>': configService.get('<SERVICE_NAME>_SERVICE_URL'),
```

Also add it to `apps/api-gateway/src/app.module.ts` configuration.

---

## Step 10 — Add Start Script to `package.json`

In the root `package.json`, add:
```json
"start:<service-name>": "nx serve <service-name>"
```

---

## Quality Checklist

- [ ] `src/main.ts` uses `GlobalExceptionFilter` from `@shared-exceptions`
- [ ] `src/main.ts` uses `nestjs-pino` logger
- [ ] Zod env validation in `src/config/env.validation.ts`
- [ ] All new env vars added to root `.env.example` (if it exists)
- [ ] Port is unique (doesn't conflict with other services)
- [ ] Service registered in API Gateway service map
- [ ] Start script added to root `package.json`
- [ ] `project.json` created for Nx
- [ ] `jest.config.ts` created
- [ ] At least one placeholder test in `tests/unit/`
- [ ] Run `pnpm nx typecheck <service-name>` — zero errors
- [ ] Run `pnpm nx lint <service-name>` — zero errors
