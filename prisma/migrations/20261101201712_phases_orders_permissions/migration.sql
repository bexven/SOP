-- CreateEnum
CREATE TYPE "DiscussionPhase" AS ENUM ('REVIEW', 'IMAGES', 'VIDEOS', 'ADS', 'ORDERS');

-- CreateEnum
CREATE TYPE "ScaleVerdict" AS ENUM ('YES', 'NO', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "ScalePlan" AS ENUM ('SCALE_ADS', 'INCREASE_ORDERS', 'INVEST_MORE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'MOVED_TO_ORDERING';
ALTER TYPE "EventType" ADD VALUE 'ORDER_CREATED';
ALTER TYPE "EventType" ADD VALUE 'ORDER_UPDATED';
ALTER TYPE "EventType" ADD VALUE 'SCALING_UPDATED';

-- DropIndex
DROP INDEX "Comment_productId_createdAt_idx";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "phase" "DiscussionPhase" NOT NULL DEFAULT 'REVIEW';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "orderingSince" TIMESTAMP(3),
ADD COLUMN     "scalable" "ScaleVerdict",
ADD COLUMN     "scaleNote" TEXT,
ADD COLUMN     "scalePlans" "ScalePlan"[] DEFAULT ARRAY[]::"ScalePlan"[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ProductOrder" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buyingPriceBdt" DECIMAL(12,2) NOT NULL,
    "shippingCostBdt" DECIMAL(12,2) NOT NULL,
    "sellingPriceBdt" DECIMAL(12,2) NOT NULL,
    "courierChargePct" DECIMAL(5,2) NOT NULL,
    "orderedOn" DATE NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductOrder_productId_number_key" ON "ProductOrder"("productId", "number");

-- CreateIndex
CREATE INDEX "Comment_productId_phase_createdAt_idx" ON "Comment"("productId", "phase", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Everyone starts with the permissions of their job role (Master Admin can change them on the Roles page).
UPDATE "User" SET "permissions" = ARRAY['research.view', 'product.create']::TEXT[] WHERE "role" = 'RESEARCHER';
UPDATE "User" SET "permissions" = ARRAY[]::TEXT[] WHERE "role" = 'IMAGE_DESIGNER';
UPDATE "User" SET "permissions" = ARRAY[]::TEXT[] WHERE "role" = 'VIDEO_EDITOR';
UPDATE "User" SET "permissions" = ARRAY['research.view', 'task.review', 'brief.edit', 'campaign.manage', 'batch.request', 'orders.manage', 'product.sendBack', 'product.kill']::TEXT[] WHERE "role" = 'MEDIA_BUYER';
UPDATE "User" SET "permissions" = ARRAY['research.view', 'product.approve', 'task.review', 'product.sendBack']::TEXT[] WHERE "role" = 'REVIEWER';
