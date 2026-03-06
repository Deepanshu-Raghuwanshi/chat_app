# =============================================================================
# Stage 1: Dependencies
# Separated so pnpm install layer is only invalidated when lockfile changes
# =============================================================================
FROM node:20-alpine AS deps

WORKDIR /app
RUN npm install -g pnpm

# Copy manifests first – layer cache is only busted when these change
COPY package.json pnpm-lock.yaml ./

# ✅ Copy project.json files for NX dep graph (no source code yet)
COPY nx.json tsconfig.base.json ./
COPY apps/api-gateway/project.json ./apps/api-gateway/
COPY apps/auth-service/project.json ./apps/auth-service/
COPY apps/chat-service/project.json ./apps/chat-service/
COPY apps/message-service/project.json ./apps/message-service/
COPY apps/notification-service/project.json ./apps/notification-service/
COPY apps/user-service/project.json ./apps/user-service/

RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

# ✅ prisma generate does NOT need a real DATABASE_URL – dummy is sufficient
# ✅ Real DATABASE_URL is NEVER baked into the image
RUN if [ -f "apps/${APP_NAME}/prisma/schema.prisma" ]; then \
      DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
      pnpm prisma generate --config=apps/${APP_NAME}/prisma.config.ts; \
    fi

RUN pnpm nx build ${APP_NAME} --configuration=production

# Collect prisma schema for runtime migrations (no credentials here)
RUN mkdir -p /app/prisma-deploy && \
    if [ -f "apps/${APP_NAME}/prisma/schema.prisma" ]; then \
      cp -r apps/${APP_NAME}/prisma /app/prisma-deploy/prisma; \
      cp apps/${APP_NAME}/prisma.config.ts /app/prisma-deploy/prisma.config.ts 2>/dev/null || true; \
    fi

# =============================================================================
# Stage 3: Runtime
# Minimal image – no build tools, no source code, no pnpm
# =============================================================================
FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl wget

WORKDIR /app

ARG APP_NAME
ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production

# ✅ Copy compiled output only
COPY --from=builder /app/dist ./dist

# ✅ Copy node_modules from builder – no reinstall needed in runtime
COPY --from=builder /app/node_modules ./node_modules

# ✅ Copy prisma schema (credentials injected at runtime via DATABASE_URL env)
COPY --from=builder /app/prisma-deploy /app/apps/${APP_NAME}/

# ✅ Run as non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser \
    && chown -R appuser:nodejs /app
USER appuser

EXPOSE 3000

# ✅ Runs prisma migrate deploy at startup (uses DATABASE_URL from env, never baked in)
# ✅ Falls back to just starting if no prisma schema present
CMD ["sh", "-c", "\
  if [ -f \"/app/apps/${APP_NAME}/prisma/schema.prisma\" ]; then \
    node_modules/.bin/prisma migrate deploy --config=/app/apps/${APP_NAME}/prisma.config.ts; \
  fi && \
  node dist/apps/${APP_NAME}/src/main.js \
"]
