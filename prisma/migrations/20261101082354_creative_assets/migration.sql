-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'LINK');

-- CreateEnum
CREATE TYPE "Reaction" AS ENUM ('LIKED', 'DISLIKED');

-- CreateEnum
CREATE TYPE "FollowUpKind" AS ENUM ('DIFFERENT_ANGLE', 'DIFFERENT_SIZE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'ASSET_REACTED';
ALTER TYPE "EventType" ADD VALUE 'ASSET_COMMENTED';
ALTER TYPE "EventType" ADD VALUE 'FOLLOW_UP_REQUESTED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FEEDBACK';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "followUpOfId" TEXT,
ADD COLUMN     "requestKind" "FollowUpKind",
ADD COLUMN     "requestNote" TEXT;

-- AlterTable
ALTER TABLE "TaskSubmission" ALTER COLUMN "url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarAssetId" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionItem" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "assetId" TEXT,
    "url" TEXT,
    "label" TEXT,
    "reaction" "Reaction",
    "reactedById" TEXT,
    "reactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetComment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionItem_submissionId_order_idx" ON "SubmissionItem"("submissionId", "order");

-- CreateIndex
CREATE INDEX "AssetComment_itemId_createdAt_idx" ON "AssetComment"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionItem" ADD CONSTRAINT "SubmissionItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TaskSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionItem" ADD CONSTRAINT "SubmissionItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetComment" ADD CONSTRAINT "AssetComment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SubmissionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetComment" ADD CONSTRAINT "AssetComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carry existing single-link submissions over as LINK items.
INSERT INTO "SubmissionItem" ("id", "submissionId", "order", "kind", "url", "createdAt")
SELECT 'mig_' || s."id", s."id", 0, 'LINK', s."url", s."createdAt"
FROM "TaskSubmission" s
WHERE s."url" IS NOT NULL;
