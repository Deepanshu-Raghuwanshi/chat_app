# =========================
# Stage 1: Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG APP_NAME
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

RUN if [ -f "apps/${APP_NAME}/prisma/schema.prisma" ]; then \
      pnpm prisma generate --schema=apps/${APP_NAME}/prisma/schema.prisma --config=apps/${APP_NAME}/prisma.config.ts; \
    fi

RUN mkdir -p /app/prisma-deploy
RUN if [ -f "apps/${APP_NAME}/prisma/schema.prisma" ]; then \
      cp -r apps/${APP_NAME}/prisma /app/prisma-deploy/prisma; \
      cp apps/${APP_NAME}/prisma.config.ts /app/prisma-deploy/prisma.config.ts; \
    fi

RUN pnpm nx build ${APP_NAME} --configuration=production

# =========================
# Stage 2: Runtime
# =========================
FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ARG APP_NAME
ARG DATABASE_URL
ENV APP_NAME=${APP_NAME}
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
RUN npm install -g pnpm \
    && pnpm install --prod --frozen-lockfile

COPY --from=builder /app/prisma-deploy /app/apps/${APP_NAME}/

RUN if [ -f "apps/${APP_NAME}/prisma/schema.prisma" ]; then \
      pnpm prisma generate --schema=apps/${APP_NAME}/prisma/schema.prisma --config=apps/${APP_NAME}/prisma.config.ts; \
    fi

EXPOSE 3000

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/apps/${APP_NAME}/src/main.js"]