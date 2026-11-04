-- AlterTable
ALTER TABLE "ProductOrder" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "TestOrder" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "expectedOn" DATE,
ADD COLUMN     "name" TEXT;

