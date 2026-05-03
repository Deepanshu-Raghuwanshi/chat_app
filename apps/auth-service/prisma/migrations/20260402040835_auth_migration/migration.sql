-- CreateTable
CREATE TABLE "EmailChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailChange_userId_key" ON "EmailChange"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChange_token_key" ON "EmailChange"("token");
