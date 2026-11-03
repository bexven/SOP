-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'CUSTOMER_SUPPORT';
ALTER TYPE "Role" ADD VALUE 'OFFICE_SECRETARY';

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "restricted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "brandAccess" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "removedAt" TIMESTAMP(3);

