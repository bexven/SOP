-- CreateEnum
CREATE TYPE "ManualTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "link" TEXT;

-- CreateTable
CREATE TABLE "ManualTask" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ManualTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "productId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "ManualTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualTask_number_key" ON "ManualTask"("number");

-- CreateIndex
CREATE INDEX "ManualTask_status_position_idx" ON "ManualTask"("status", "position");

-- CreateIndex
CREATE INDEX "ManualTask_assigneeId_status_idx" ON "ManualTask"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "ManualTaskComment_taskId_createdAt_idx" ON "ManualTaskComment"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "ManualTask" ADD CONSTRAINT "ManualTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTask" ADD CONSTRAINT "ManualTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTask" ADD CONSTRAINT "ManualTask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTaskComment" ADD CONSTRAINT "ManualTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ManualTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTaskComment" ADD CONSTRAINT "ManualTaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

