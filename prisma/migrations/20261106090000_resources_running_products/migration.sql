-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "addedRunning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageResourceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videoResourceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];

