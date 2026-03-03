# Chat System v2 Architecture

Strict DDD layered microservices using Nx + pnpm.

## Core Principles

-   Contract-driven development (OpenAPI enforced)
-   DB per service
-   Kafka for async events
-   Shared types generated from OpenAPI
-   Affected CI pipelines via Nx
