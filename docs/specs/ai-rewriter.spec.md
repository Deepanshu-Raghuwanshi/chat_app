# AI Message Rewriter — Feature Spec

## 1. Summary

The AI Message Rewriter lets a user transform their draft message before sending it. When the composer has text, a sparkle button (✨) appears next to the emoji picker. Clicking it opens a tone picker (Fix Grammar / Professional / Casual / Shorter / Longer). Selecting a tone calls a backend endpoint that forwards the request to Google Gemini 1.5 Flash — a **completely free** AI API — and returns the rewritten text, which replaces the composer draft. The user can then edit or send it as normal. The API key is stored as a backend environment variable; it is never exposed to the browser.

---

## 2. Current State

Verified by reading the following files:

### Backend — `chat-service`

- `apps/chat-service/src/interfaces/controllers/conversation.controller.ts` — single controller handling all `/api/v1/chat/conversations` routes. No AI-related routes exist.
- `apps/chat-service/src/chat.module.ts` — registers all use cases, gateways, Kafka, Redis, repositories. No AI service is registered.
- `apps/chat-service/src/config/env.validation.ts` — Zod schema with: `NODE_ENV`, `PORT`, `MONGODB_URL`, `JWT_ACCESS_SECRET`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `KAFKA_BROKERS`. **No `GEMINI_API_KEY` field exists.**
- `apps/chat-service/src/infrastructure/messaging/kafka-producer.service.ts` — generic `emit(topic, payload)` abstraction. No AI calls.
- `apps/chat-service/src/infrastructure/cache/redis-presence.repository.ts` — Redis used only for presence state. No AI rate-limit tracking here.
- `apps/chat-service/src/application/use-cases/` — 10 use cases exist (send, edit, delete, react, read, etc.). **No rewrite use case exists.**
- `package.json` (root) — `@google/generative-ai` is **NOT** installed.

### Frontend

- `apps/frontend/src/features/chat/components/MessageComposer.tsx` — handles textarea draft, emoji picker, reply preview, and send. Buttons today: emoji picker, send. **No AI rewrite button exists.**
- `apps/frontend/src/features/chat/services/chat.service.ts` — all chat HTTP calls. No AI-related function exists.
- `apps/frontend/src/features/chat/hooks/useChat.ts` — TanStack Query mutations for send, edit, delete, react, mark-read. **No rewrite mutation exists.**
- `apps/frontend/src/features/chat/store/useChatStore.ts` — state: `activeConversationId`, `draftMessages`, `replyTargets`, `highlightedMessageId`, `typingUsers`. **No AI loading/suggestion state exists.**

### API Gateway

- `apps/api-gateway/src/interfaces/controllers/gateway.controller.ts` — wildcard proxy. Path prefix `chat` → `CHAT_SERVICE_URL`. Any new route under `/api/v1/chat/` is automatically routed without gateway changes.

### Libraries

- `libs/openapi-specs/src/v1/chat.yaml` — **updated in this spec** (Phase 1) to add the `/api/v1/chat/ai/rewrite` endpoint and `AiRewriteDto` / `AiRewriteResponse` schemas.

### What does NOT exist yet

- `@google/generative-ai` npm package
- `GEMINI_API_KEY` env var in env schema or docker-compose
- `GeminiRewriteService` (AI API wrapper)
- `RewriteMessageUseCase`
- `AiController` with the rewrite route
- Sparkle button in `MessageComposer`
- `useRewriteMessage` mutation hook
- `AiTonePicker` component

---

## 3. Desired State

### User-facing behaviour

1. User opens a conversation and types a message in the composer.
2. When the draft is non-empty, a sparkle icon (✨) button appears to the left of the send button.
3. User clicks the sparkle button. A small popover opens above the composer with five tone options:
   - **Fix Grammar** — correct typos and grammar only
   - **Professional** — formal, business-appropriate language
   - **Casual** — relaxed, conversational tone
   - **Shorter** — condense to essential meaning
   - **Longer** — expand with additional context
4. User selects a tone. The popover closes. The sparkle button enters a loading spinner state.
5. The frontend calls `POST /api/v1/chat/ai/rewrite` with `{ text: draft, tone }`.
6. The backend calls the Gemini 1.5 Flash API and returns `{ rewrittenText }`.
7. The composer draft is replaced with the rewritten text. The textarea auto-resizes.
8. If the AI call fails, the draft is unchanged and a toast error appears.

### Data flow

```
[User selects a rewrite tone in AiTonePicker]
  → useRewriteMessage mutation fires
  → chatService.rewriteMessage({ text: draft, tone })
  → POST /api/v1/chat/ai/rewrite (JWT in cookie)
  → API Gateway proxies to chat-service (prefix: chat → CHAT_SERVICE_URL)
  → JwtAuthGuard validates token
  → AiController.rewrite() → RewriteMessageUseCase.execute({ text, tone, userId })
  → GeminiRewriteService.rewrite(text, tone)
  → HTTP POST to Gemini 1.5 Flash API (server-side, API key never leaves backend)
  → returns { rewrittenText: string }
  → AiController returns 200 { rewrittenText }
  → useRewriteMessage.onSuccess: setDraft(conversationId, rewrittenText)
  → Composer textarea shows rewritten text
```

### Business rules and constraints

- **Auth required**: Must be a logged-in user (JWT). Anonymous calls are rejected 401.
- **Text constraints**: `text` must be 1–4000 characters after trimming. Empty string → 400.
- **Tone constraints**: `tone` must be one of the five enum values. Any other value → 400.
- **No persistence**: The rewritten text is never stored. Only the frontend draft changes.
- **No Kafka events**: This is a synchronous, stateless transformation with no cross-service side effects.
- **Idempotency**: Calling twice with the same inputs may return different text (LLM is non-deterministic). This is expected and acceptable.
- **Rate limiting**: 15 requests per minute per user. Enforced by `@nestjs/throttler` at the controller level, matching the Gemini free tier (15 RPM). Exceeding returns 429.
- **Timeout**: If Gemini does not respond within 10 seconds, return 503.
- **API key misconfiguration**: If `GEMINI_API_KEY` is empty/absent at startup, the env validation fails and the service refuses to start.

---

## Phase 1 — Contracts & Schema

**Goal**: Define all contracts and dependency changes before implementation begins. Nothing is implemented in this phase.

### 1.1 Free AI API — How to Get a Key

**Recommended: Google Gemini API (Gemini 1.5 Flash)**

| Provider      | Model                  | Free Tier Limits         | How to Get Key                         |
| ------------- | ---------------------- | ------------------------ | -------------------------------------- |
| Google Gemini | `gemini-1.5-flash`     | 15 RPM, 1M TPM, 1500 RPD | https://aistudio.google.com/app/apikey |
| Groq          | `llama-3.1-8b-instant` | 30 RPM, 14400 RPD        | https://console.groq.com               |

**Why Gemini 1.5 Flash is the better choice:**

- Higher quality text rewriting than Llama 8B (far fewer hallucinations, better adherence to instructions)
- Official `@google/generative-ai` Node.js SDK — no custom HTTP client needed
- 1500 requests per day is more than enough for a personal/demo chat app
- Google-backed uptime and reliability

**Groq as fallback:** If Gemini is unavailable or you hit daily limits, Groq's API is OpenAI-compatible and uses the same `openai` SDK pattern with just a `baseURL` change. But for quality, Gemini Flash wins on text-rewriting tasks.

**Steps to get Gemini API key:**

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with any Google account
3. Click "Create API key"
4. Add `GEMINI_API_KEY=<your-key>` to the **root `.env`** (`.env` at the repo root — the single shared env file all services read via `ConfigModule.forRoot()`)

### 1.2 OpenAPI Changes

Editing `libs/openapi-specs/src/v1/chat.yaml` — the AI rewrite endpoint is a chat-service concern (message drafting is a chat feature). Adding to the existing chat.yaml rather than a new file because this is not a new service.

| Method | Path                      | Auth | Purpose                                 |
| ------ | ------------------------- | ---- | --------------------------------------- |
| POST   | `/api/v1/chat/ai/rewrite` | JWT  | Rewrite a draft message using Gemini AI |

New schemas added to `components/schemas`:

- `AiRewriteDto` — request body (`text`, `tone` enum)
- `AiRewriteResponse` — response body (`rewrittenText`)

### 1.3 Database Schema Changes

**None.** The rewrite is a stateless transformation. No MongoDB collections or indexes are needed.

### 1.4 Kafka Event Contracts

**None.** This is a synchronous request-response feature. No events are produced or consumed.

### 1.5 Files to Create / Modify in This Phase

```
libs/openapi-specs/src/v1/chat.yaml    — modified (add /ai/rewrite endpoint + 2 schemas)
```

Commands to run after this phase:

```bash
pnpm generate:types    # Regenerates @shared-types from OpenAPI — adds AiRewriteDto and AiRewriteResponse
```

---

## Phase 2 — Backend Implementation

**Goal**: Implement the rewrite endpoint in strict DDD layer order inside the chat-service.

### 2.1 Domain Layer

No new domain entities. Text rewriting is an infrastructure concern (external AI call), not a domain concept. No business invariants live at this layer for this feature.

### 2.2 Application Layer

#### 2.2.1 AI Rewriter Port

Create a port interface so the use case is not coupled to Gemini directly (allows swapping to Groq later):

**`apps/chat-service/src/application/ports/ai-rewriter.port.ts`** — **created**

```typescript
export type RewriteTone =
  | "fix-grammar"
  | "professional"
  | "casual"
  | "shorter"
  | "longer";

export interface AiRewriterPort {
  rewrite(text: string, tone: RewriteTone): Promise<string>;
}
```

#### 2.2.2 Use Case

**`apps/chat-service/src/application/use-cases/rewrite-message.use-case.ts`** — **created**

Execution sequence:

1. Validate `text` is non-empty after trim (throw `BadRequestException` if not)
2. Validate `tone` is a valid enum value (class-validator handles this at the DTO level; the use case trusts the controller's validated input)
3. Call `aiRewriter.rewrite(text.trim(), tone)` via the injected port
4. Return `{ rewrittenText }`

```typescript
export interface RewriteMessageDto {
  userId: string;
  text: string;
  tone: RewriteTone;
}
```

No events emitted. No repository calls. The use case is deliberately thin — it is a guard + delegation pattern.

| Use Case Class          | HTTP Trigger                 | Business Rules Enforced   | Events Emitted |
| ----------------------- | ---------------------------- | ------------------------- | -------------- |
| `RewriteMessageUseCase` | POST /api/v1/chat/ai/rewrite | text non-empty after trim | none           |

### 2.3 Infrastructure Layer

#### 2.3.1 GeminiRewriteService

**`apps/chat-service/src/infrastructure/ai/gemini-rewrite.service.ts`** — **created**

Implements `AiRewriterPort`. Injects `ConfigService` to read `GEMINI_API_KEY`. Initialises the `GoogleGenerativeAI` client once at module init.

Prompt templates per tone (these produce clean, instruction-following output from Gemini Flash):

```typescript
const PROMPTS: Record<RewriteTone, (text: string) => string> = {
  "fix-grammar": (text) =>
    `Fix the grammar, spelling, and punctuation of the following message. Return only the corrected message, no explanation:\n\n${text}`,
  professional: (text) =>
    `Rewrite the following message to be more professional and formal. Keep the same meaning. Return only the rewritten message, no explanation:\n\n${text}`,
  casual: (text) =>
    `Rewrite the following message to be more casual and friendly. Keep the same meaning. Return only the rewritten message, no explanation:\n\n${text}`,
  shorter: (text) =>
    `Rewrite the following message to be shorter and more concise. Keep the key information. Return only the rewritten message, no explanation:\n\n${text}`,
  longer: (text) =>
    `Expand the following message to be more detailed and elaborate. Add relevant context. Return only the expanded message, no explanation:\n\n${text}`,
};
```

Implementation:

```typescript
@Injectable()
export class GeminiRewriteService implements AiRewriterPort {
  private readonly model: GenerativeModel;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>("GEMINI_API_KEY");
    const genAI = new GoogleGenerativeAI(apiKey!);
    this.model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    });
  }

  async rewrite(text: string, tone: RewriteTone): Promise<string> {
    const prompt = PROMPTS[tone](text);
    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }
}
```

**Why `maxOutputTokens: 1024`**: The user's message is capped at 4000 chars (~1000 tokens). A 1024-token limit on the output is generous for any of the five tones and prevents runaway generation on the free tier.

**Why `temperature: 0.7`**: Low enough to produce predictable, on-task rewrites; high enough to avoid robotic output. This is the standard creative-writing balance.

**Timeout handling**: Wrap the `generateContent` call in `Promise.race` with a 10-second timeout. If it fires, throw a `ServiceUnavailableException`.

#### 2.3.2 No Kafka Producer or Consumer Changes

No events are produced or consumed by this feature.

#### 2.3.3 No Redis Changes

No caching. The free tier allows 1500 RPD, and an application-level cache of AI responses would be wrong (same input + same tone should occasionally produce different outputs, which is the point of AI).

Rate limiting (15 RPM/user) is handled by `@nestjs/throttler` in-memory storage, which is already adequate for a single-instance deployment.

### 2.4 Interfaces Layer

#### 2.4.1 DTO

**`apps/chat-service/src/application/dto/ai-rewrite.dto.ts`** — **created**

```typescript
import { IsString, IsNotEmpty, MaxLength, IsEnum } from "class-validator";
import { Transform } from "class-transformer";

export type RewriteTone =
  | "fix-grammar"
  | "professional"
  | "casual"
  | "shorter"
  | "longer";

export class AiRewriteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  @Transform(({ value }) => value?.trim())
  text: string;

  @IsEnum(["fix-grammar", "professional", "casual", "shorter", "longer"])
  tone: RewriteTone;
}
```

#### 2.4.2 Controller

Create a separate `AiController` (not adding to `ConversationController`) because the AI rewrite endpoint is not a conversations resource — it operates on raw text. Mixing it into `ConversationController` would violate single-responsibility.

**`apps/chat-service/src/interfaces/controllers/ai.controller.ts`** — **created**

```typescript
@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 15, ttl: 60_000 } }) // 15 RPM per user
@Controller("chat/ai")
export class AiController {
  constructor(private readonly rewriteMessage: RewriteMessageUseCase) {}

  @Post("rewrite")
  @HttpCode(HttpStatus.OK)
  async rewrite(@Req() req: RequestWithUser, @Body() dto: AiRewriteDto) {
    return this.rewriteMessage.execute({
      userId: req.user.id,
      text: dto.text,
      tone: dto.tone,
    });
  }
}
```

| Method | Route              | Guard          | Throttle    | Use Case Called         |
| ------ | ------------------ | -------------- | ----------- | ----------------------- |
| POST   | `/chat/ai/rewrite` | `JwtAuthGuard` | 15 RPM/user | `RewriteMessageUseCase` |

### 2.5 Module Registration

**`apps/chat-service/src/chat.module.ts`** — **modified**

Add to `controllers` array:

```typescript
AiController,
```

Add to `providers` array:

```typescript
RewriteMessageUseCase,
{ provide: 'AiRewriter', useClass: GeminiRewriteService },
```

**`apps/chat-service/src/config/env.validation.ts`** — **modified**

Add to the Zod schema:

```typescript
GEMINI_API_KEY: z.string().min(1),
```

**Root `.env`** — **already updated by you**

The key is already in `.env` at the repo root. `ConfigModule.forRoot({ isGlobal: true })` in `chat-service/src/app.module.ts` loads this file automatically. No docker-compose changes are needed — the compose volumes mount the entire project directory so `.env` is present at the working directory of every service.

**Install package** (run once):

```bash
pnpm add @google/generative-ai --filter chat-service
```

### 2.6 Files to Create / Modify in This Phase

```
apps/chat-service/src/application/ports/ai-rewriter.port.ts                 — created
apps/chat-service/src/application/use-cases/rewrite-message.use-case.ts     — created
apps/chat-service/src/application/dto/ai-rewrite.dto.ts                     — created
apps/chat-service/src/infrastructure/ai/gemini-rewrite.service.ts           — created
apps/chat-service/src/interfaces/controllers/ai.controller.ts               — created
apps/chat-service/src/chat.module.ts                                         — modified (register AiController, RewriteMessageUseCase, GeminiRewriteService)
apps/chat-service/src/config/env.validation.ts                              — modified (add GEMINI_API_KEY)
.env (repo root)                                                             — already updated (GEMINI_API_KEY already added)
package.json (root or chat-service)                                          — modified (add @google/generative-ai)
```

### 2.7 Test Cases

**Unit — `RewriteMessageUseCase`** (`apps/chat-service/tests/unit/`):

- [ ] Happy path: calls `aiRewriter.rewrite(trimmedText, tone)` and returns `{ rewrittenText }`
- [ ] Throws `BadRequestException` when `text` is empty string after trim
- [ ] Does NOT call `aiRewriter.rewrite` when text is empty
- [ ] Passes each of the 5 valid tones through unchanged to the port
- [ ] Returns whatever string the port returns (no transformation at use-case level)

**Unit — `GeminiRewriteService`**:

- [ ] Calls `model.generateContent` with the correct tone-specific prompt
- [ ] Returns trimmed response text
- [ ] Throws `ServiceUnavailableException` if `generateContent` takes > 10 s

```bash
pnpm nx typecheck chat-service
pnpm nx lint chat-service
pnpm nx test chat-service
```

---

## Phase 3 — Frontend Implementation

**Goal**: Add sparkle button + tone picker to `MessageComposer`, wire to backend via new mutation.

### 3.1 Routes / Pages

No new routes. All changes are within the existing `/chat/[conversationId]` page and its components.

| Route                    | Page File                                     | New or Modified | Purpose                |
| ------------------------ | --------------------------------------------- | --------------- | ---------------------- |
| `/chat/[conversationId]` | `app/[locale]/chat/[conversationId]/page.tsx` | unchanged       | No page changes needed |

### 3.2 API Service

**File**: `apps/frontend/src/features/chat/services/chat.service.ts` — **modified**

Add one function:

```typescript
async rewriteMessage(dto: {
  text: string;
  tone: 'fix-grammar' | 'professional' | 'casual' | 'shorter' | 'longer';
}): Promise<{ rewrittenText: string }> {
  const { data } = await apiClient.post<{ rewrittenText: string }>(
    '/chat/ai/rewrite',
    dto,
  );
  return data;
},
```

### 3.3 Hooks

**File**: `apps/frontend/src/features/chat/hooks/useChat.ts` — **modified**

Add one mutation (no optimistic update needed — the draft is already in Zustand, not TQ):

```typescript
export const useRewriteMessage = (conversationId: string) => {
  const setDraft = useChatStore((state) => state.setDraft);
  const t = useTranslations("features.chat.errors");

  return useMutation({
    mutationFn: (vars: {
      text: string;
      tone: "fix-grammar" | "professional" | "casual" | "shorter" | "longer";
    }) => chatService.rewriteMessage(vars),
    onSuccess: ({ rewrittenText }) => {
      setDraft(conversationId, rewrittenText);
    },
    onError: () => {
      showToast.error(t("rewrite_failed"));
    },
  });
};
```

**Why no optimistic update**: The draft lives in Zustand (`draftMessages`), not in TanStack Query. We wait for the server response before replacing the draft — an optimistic "placeholder" rewrite would be meaningless.

| Hook                                | TQ Type       | Enabled Condition          | On Success                                |
| ----------------------------------- | ------------- | -------------------------- | ----------------------------------------- |
| `useRewriteMessage(conversationId)` | `useMutation` | Always (called explicitly) | `setDraft(conversationId, rewrittenText)` |

### 3.4 Zustand Store Changes

**None.** The rewritten text flows directly into `draftMessages` via the existing `setDraft` action. No new store state is required.

The AI loading state is handled by TanStack Query's `isPending` on the mutation — there is no need to duplicate it in Zustand.

### 3.5 Components

#### 3.5.1 `AiTonePicker` — new component

**`apps/frontend/src/features/chat/components/AiTonePicker.tsx`** — **created**

A small popover that renders five tone buttons. Closes on outside click (same pattern as `EmojiPickerPopover`).

Props:

```typescript
interface AiTonePickerProps {
  onSelect: (tone: RewriteTone) => void;
  isLoading: boolean;
}
```

Renders:

- Five buttons with icons and labels (each tone has a short description shown on hover)
- While `isLoading`, all buttons are disabled and the selected tone shows a spinner
- The component renders absolutely positioned above the composer (same side as the emoji picker)

Tone display labels:

| Tone value     | Label        | Icon                     |
| -------------- | ------------ | ------------------------ |
| `fix-grammar`  | Fix Grammar  | `SpellCheck` (Lucide)    |
| `professional` | Professional | `Briefcase` (Lucide)     |
| `casual`       | Casual       | `MessageCircle` (Lucide) |
| `shorter`      | Shorter      | `Minimize2` (Lucide)     |
| `longer`       | Longer       | `Maximize2` (Lucide)     |

#### 3.5.2 `MessageComposer` — modified

**`apps/frontend/src/features/chat/components/MessageComposer.tsx`** — **modified**

Changes:

1. Import `useRewriteMessage` and `AiTonePicker`
2. Add `useState` for `aiPickerOpen`
3. Add `useRef` for the AI picker area (click-outside dismiss, same as emoji picker)
4. Call `useRewriteMessage(conversationId)` mutation
5. Add sparkle button (only visible when `draft.trim()` is non-empty)
6. On sparkle click, toggle `aiPickerOpen`
7. On tone select: call `mutate({ text: draft.trim(), tone })` and close picker

```tsx
const aiAreaRef = useRef<HTMLDivElement>(null);
const [aiPickerOpen, setAiPickerOpen] = useState(false);
const { mutate: rewriteMessage, isPending: isRewriting } =
  useRewriteMessage(conversationId);

// Click-outside handler for ai picker (identical pattern to existing emoji picker handler)

const handleToneSelect = (tone: RewriteTone) => {
  setAiPickerOpen(false);
  rewriteMessage({ text: draft.trim(), tone });
};
```

Sparkle button placement: between the emoji button and send button.

```tsx
{
  draft.trim() && (
    <div ref={aiAreaRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAiPickerOpen((v) => !v)}
        disabled={isRewriting}
        aria-label={t("ai_rewrite_button_label")}
        className={cn(
          "p-2 rounded-xl transition-all duration-200",
          isRewriting
            ? "text-primary bg-primary/10 animate-pulse cursor-wait"
            : aiPickerOpen
              ? "text-primary bg-primary/10"
              : "text-foreground/40 hover:text-foreground hover:bg-foreground/5",
        )}
      >
        <Sparkles className="w-4 h-4" />
      </button>
      {aiPickerOpen && (
        <AiTonePicker onSelect={handleToneSelect} isLoading={isRewriting} />
      )}
    </div>
  );
}
```

**Why only show when draft is non-empty**: An AI rewrite button on an empty composer is useless and adds visual clutter. Conditional rendering keeps the UI clean.

**Why `animate-pulse` on loading**: Consistent with the loading pattern used elsewhere in the app. The button stays visible but communicates work in progress without a full spinner overlay.

| Component         | New or Modified | Key Change                                 |
| ----------------- | --------------- | ------------------------------------------ |
| `MessageComposer` | modified        | Add sparkle button + AI picker integration |
| `AiTonePicker`    | created         | Tone selection popover                     |

### 3.6 i18n Keys

Add to translation files under `features.chat.composer`:

```json
"ai_rewrite_button_label": "Rewrite with AI",
"ai_tone_fix_grammar": "Fix Grammar",
"ai_tone_professional": "Professional",
"ai_tone_casual": "Casual",
"ai_tone_shorter": "Shorter",
"ai_tone_longer": "Longer"
```

Add to `features.chat.errors`:

```json
"rewrite_failed": "AI rewrite failed. Please try again."
```

### 3.7 Files to Create / Modify in This Phase

```
apps/frontend/src/features/chat/services/chat.service.ts              — modified (add rewriteMessage)
apps/frontend/src/features/chat/hooks/useChat.ts                      — modified (add useRewriteMessage)
apps/frontend/src/features/chat/components/AiTonePicker.tsx           — created
apps/frontend/src/features/chat/components/MessageComposer.tsx        — modified (add sparkle button + picker)
apps/frontend/src/i18n/messages/en.json                               — modified (add ai_rewrite keys)
apps/frontend/src/i18n/messages/es.json                               — modified (add ai_rewrite keys)
```

### 3.8 Test Cases

**Mutation tests** (`useRewriteMessage`):

- [ ] On success: calls `setDraft(conversationId, rewrittenText)` with the returned text
- [ ] On error: calls `showToast.error` with the `rewrite_failed` message
- [ ] Does not modify draft on error (no rollback needed — draft was never changed)

**Component tests** (`MessageComposer`):

- [ ] When draft is empty: sparkle button is NOT rendered
- [ ] When draft is non-empty: sparkle button IS rendered
- [ ] Click sparkle button: opens `AiTonePicker`
- [ ] Click outside picker: `AiTonePicker` closes
- [ ] Select a tone: calls `rewriteMessage({ text: draft.trim(), tone })` and closes picker
- [ ] While `isRewriting`: sparkle button has `animate-pulse` class and is disabled

**Component tests** (`AiTonePicker`):

- [ ] Renders all 5 tone buttons
- [ ] While `isLoading`: all buttons are disabled
- [ ] Clicking a tone calls `onSelect` with the correct tone value

```bash
pnpm nx typecheck frontend
pnpm nx lint frontend
pnpm nx test frontend
```

---

## 4. Architecture Decisions

| #   | Decision                                                   | Options Considered                                                           | Choice                                    | Rationale                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Where does the AI call live — frontend or backend?         | Call Gemini directly from the browser vs. backend proxy                      | Backend proxy (`/api/v1/chat/ai/rewrite`) | API keys must never be exposed in browser code (XSS, DevTools). The backend is the only safe place to store and use the key.                                                                                                                                                 |
| 2   | Which free AI provider?                                    | Google Gemini Flash, Groq (Llama 8B), OpenRouter (free models), Hugging Face | Google Gemini 1.5 Flash                   | Best quality for instruction-following text tasks. 1500 RPD free with no credit card. Official Node.js SDK. Groq is a valid fallback if Gemini is unavailable.                                                                                                               |
| 3   | Which service owns the endpoint?                           | New AI service, extend user-service, extend chat-service                     | Extend chat-service                       | Message rewriting is a chat-composition feature. The chat-service already owns the message lifecycle. A new service would be over-engineered for a single stateless endpoint.                                                                                                |
| 4   | New `AiController` vs. adding to `ConversationController`? | Add `POST /ai/rewrite` to existing controller                                | New `AiController`                        | The AI endpoint has no conversation or message resource in its path. Adding it to `ConversationController` (which manages `/chat/conversations/**`) would be semantically wrong and violate single-responsibility.                                                           |
| 5   | Port/interface for AI provider?                            | Inject `GeminiRewriteService` directly vs. inject via `AiRewriterPort`       | Port interface                            | Allows swapping to Groq (or any other provider) in the future without touching the use case. Cost is one extra file; benefit is a clean seam.                                                                                                                                |
| 6   | Rate limiting strategy?                                    | Redis sliding window vs. in-memory throttler                                 | `@nestjs/throttler` (in-memory)           | The chat-service is already single-instance in this monorepo setup. `@nestjs/throttler` is already a dependency, requires zero new infrastructure, and the 15 RPM limit matches the Gemini free tier ceiling. Redis-based distributed rate limiting is over-engineered here. |
| 7   | Cache AI responses?                                        | Cache in Redis by (text, tone) hash                                          | No caching                                | AI responses are intentionally non-deterministic. Caching would undermine the user's expectation that each click produces a fresh result. Free tier limits (1500 RPD) are ample for a chat app.                                                                              |
| 8   | Where does tone selection UI live?                         | Inside `MessageComposer` inline vs. popover above composer                   | Popover (`AiTonePicker`)                  | Five labelled buttons inline would crowd the composer toolbar. A popover keeps the default UI clean and only shows options on demand. Consistent with the existing `EmojiPickerPopover` pattern.                                                                             |
| 9   | Optimistic update for draft?                               | Show placeholder text immediately vs. wait for response                      | Wait for response                         | The "rewritten" draft has no sensible placeholder. Showing a spinner on the button for ~1-2 s (typical Gemini Flash latency) is fine. An optimistic blank or "loading…" draft would confuse the user.                                                                        |

---

## 5. Open Questions

None — all decisions are resolved in Section 4.

---

## Implementation Checklist

- [ ] Step 0 audit complete — all relevant files read before writing
- [ ] `libs/openapi-specs/src/v1/chat.yaml` updated with `/ai/rewrite` endpoint + `AiRewriteDto` + `AiRewriteResponse`
- [ ] No new Kafka event file needed
- [ ] `docs/specs/ai-rewriter.spec.md` written with all sections
- [x] Gemini API key already added to root `.env` as `GEMINI_API_KEY`
- [ ] Run `pnpm add @google/generative-ai --filter chat-service` before Phase 2
- [ ] Run `pnpm generate:types` after Phase 1
