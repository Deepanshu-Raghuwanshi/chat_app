-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "status" TEXT;
