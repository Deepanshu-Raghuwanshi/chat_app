Read the following files before doing anything else:
- docs/architecture.md
- docs/auth-architecture.md
- libs/openapi-specs/src/v1/auth.yaml
- libs/openapi-specs/src/v1/user.yaml
- libs/kafka-events/src/index.ts (and any files it re-exports)
- libs/shared-types/src/index.ts

You are creating a new OpenAPI specification for: **$ARGUMENTS**

---

## Your Task

Design and write a complete OpenAPI 3.0 spec for the feature or service described above. Place the output file at:

```
libs/openapi-specs/src/v1/<name>.yaml
```

Use the existing `auth.yaml` and `user.yaml` files as the canonical format reference.

---

## Spec Creation Checklist

### 1. Identify the domain
- Which service owns this feature? (auth, user, chat, message, notification, or a new one?)
- What are the entities involved?
- What Kafka events will this feature produce or consume?

### 2. Design the endpoints
For each endpoint define:
- HTTP method + path (always prefixed with `/api/v1/<service>/`)
- Summary and description
- Request body schema (if applicable) with `required` fields listed
- Response schemas for 200/201, 400, 401, 403, 404, 409
- Whether it requires JWT auth (add `security: [{ bearerAuth: [] }]`)
- Whether it accepts `multipart/form-data` (file uploads)

### 3. Define all schemas in `components/schemas`
- Use `$ref` for any reused type
- Mark all truly required fields in `required: [...]`
- Use `format: uuid` for IDs, `format: email` for emails, `format: date-time` for timestamps
- Use `enum` for fixed string sets (status fields, role fields)
- Never use `type: any`

### 4. Identify Kafka events
If the feature produces or consumes events, list them at the bottom of the spec as a comment block:
```yaml
# Kafka Events
# Produces: feature.action.v1
# Consumes: other.action.v1
```
Then add the corresponding TypeScript interfaces to `libs/kafka-events/src/v1/`.

### 5. Generate types after writing the spec
Remind the user to run:
```bash
pnpm generate:types
```
This regenerates `libs/shared-types` from all specs.

---

## Rules

- All topic names end in `.v1` (e.g. `message.sent.v1`)
- Paths always start with `/api/v1/<service>/`
- No `any` types — use explicit schemas
- Every endpoint that modifies state must have a 400 and 401 response defined
- Error response schema must match:
  ```yaml
  ErrorResponse:
    type: object
    properties:
      statusCode: { type: integer }
      timestamp: { type: string, format: date-time }
      path: { type: string }
      method: { type: string }
      error: { type: string }
      message: { type: string }
  ```
- Reuse this `ErrorResponse` schema via `$ref` in all error responses

---

## Output

1. Write the YAML spec file to `libs/openapi-specs/src/v1/`
2. If new Kafka events are needed, write them to `libs/kafka-events/src/v1/` and update `libs/kafka-events/src/index.ts`
3. Tell the user to run `pnpm generate:types` to regenerate shared TypeScript types
