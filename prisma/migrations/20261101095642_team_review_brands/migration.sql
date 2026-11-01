-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'PRODUCT_APPROVED';
ALTER TYPE "EventType" ADD VALUE 'PRODUCT_REJECTED';
ALTER TYPE "EventType" ADD VALUE 'FOLDER_UPDATED';
ALTER TYPE "EventType" ADD VALUE 'TASK_WITHDRAWN';

-- AlterEnum
ALTER TYPE "KillReason" ADD VALUE 'NOT_APPROVED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_REQUESTED';

-- AlterEnum
ALTER TYPE "ProductStage" ADD VALUE 'REVIEW';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'REVIEWER';

-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE 'PRODUCT_APPROVAL';

-- AlterTable
ALTER TABLE "CreativeBatch" ADD COLUMN     "imageFolderUrl" TEXT,
ADD COLUMN     "videoFolderUrl" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brandId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMaster" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'indigo',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
