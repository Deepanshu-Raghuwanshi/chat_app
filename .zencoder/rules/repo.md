---
description: Repository Information Overview
alwaysApply: true
---

# Chat System v2 Information

## Repository Summary
A production-grade, microservices-based chat application built using an **Nx Monorepo** with **pnpm**. The architecture follows strict **Domain-Driven Design (DDD)** principles and uses a **Contract-First** approach with **OpenAPI**.

## Repository Structure
The repository is organized into applications and shared libraries:
- **apps/**: Contains microservices (NestJS) and the frontend (Next.js).
- **libs/**: Shared modules for logging, types, validation, and inter-service communication.
- **tools/**: Internal scripts and utilities for development.

### Main Repository Components
- **api-gateway**: Unified entry point for all client requests, managing routing and Swagger documentation.
- **auth-service**: Handles authentication, JWT issuance/rotation, and user identity using **Prisma** (PostgreSQL).
- **user-service**: Manages user profiles and metadata using **Prisma** (PostgreSQL).
- **chat-service**: Core logic for chat rooms and participant management.
- **message-service**: Handles real-time messaging and archival using **Mongoose** (MongoDB).
- **notification-service**: Manages asynchronous user notifications via Kafka.
- **frontend**: Next.js App Router-based client application.

## Projects

### Backend Services (NestJS)
All backend services share a common architecture and configuration.

**Configuration File**: `apps/[service-name]/project.json`

#### Language & Runtime
**Language**: TypeScript  
**Version**: ^5.9.3  
**Build System**: Nx  
**Package Manager**: pnpm  
**Framework**: NestJS ^11.1.14

#### Dependencies
**Main Dependencies**:
- `@nestjs/core`, `@nestjs/common`
- `@nestjs/config` (Zod-based validation)
- `@nestjs/terminus` (Health Checks)
- `prisma` (Auth/User services)
- `mongoose` (Chat/Message services)
- `nestjs-pino` (Structured Logging)

#### Build & Installation
```bash
# Install all dependencies
pnpm install

# Build a specific service
pnpm nx build [service-name]

# Run a service in development mode
pnpm nx serve [service-name]
```

#### Docker
**Dockerfile**: Not present (managed via infrastructure compose)
**Configuration**: Local infrastructure is provided via root `docker-compose.yml`.
- **Postgres**: 15-alpine (Port 5432)
- **MongoDB**: 6 (Port 27017)
- **Redis**: 7-alpine (Port 6379)
- **Kafka/Zookeeper**: Bitnami (Port 9092/2181)

#### Testing
**Framework**: Jest (^30.2.0)
**Test Location**: `apps/[service-name]/tests/` (unit, integration, e2e)
**Naming Convention**: `*.spec.ts`
**Run Command**:
```bash
pnpm nx test [service-name]
```

### Frontend (Next.js)
**Configuration File**: `apps/frontend/project.json`

#### Language & Runtime
**Language**: TypeScript  
**Version**: ^5.9.3  
**Build System**: Nx  
**Framework**: Next.js (App Router)

#### Build & Installation
```bash
pnpm nx build frontend
```

#### Testing
**Framework**: Vite/Vitest (specified in project.json)
**Test Location**: `apps/frontend/tests/`
**Run Command**:
```bash
pnpm nx test frontend
```

### Shared Libraries
**Location**: `libs/`

#### Key Libraries
- **openapi-specs**: Source of truth for API contracts.
- **shared-types**: TypeScript interfaces generated from OpenAPI.
- **kafka-events**: Versioned event contracts for inter-service communication.
- **shared-logger**: Standardized Pino configuration.
- **shared-validation**: Common Zod schemas and NestJS pipes.

#### Build & Operations
```bash
# Run lint, typecheck, and test for all projects
pnpm check-all

# Generate types from OpenAPI specs
pnpm generate:types
```
