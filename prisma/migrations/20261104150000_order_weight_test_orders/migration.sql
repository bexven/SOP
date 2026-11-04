
-- CreateEnum
CREATE TYPE "TestQuality" AS ENUM ('WAITING', 'PASSED', 'FAILED');

-- AlterTable
ALTER TABLE "ProductOrder" ADD COLUMN     "shippingMethod" "ShippingMethod",
ADD COLUMN     "shippingRatePerKgBdt" DECIMAL(10,2),
ADD COLUMN     "weightKg" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "TestOrder" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quality" "TestQuality" NOT NULL DEFAULT 'WAITING',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestOrder_productId_createdAt_idx" ON "TestOrder"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "TestOrder" ADD CONSTRAINT "TestOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestOrder" ADD CONSTRAINT "TestOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

