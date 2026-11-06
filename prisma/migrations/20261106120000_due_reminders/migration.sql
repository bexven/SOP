-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DUE_REMINDER';

-- AlterTable
ALTER TABLE "ManualTask" ADD COLUMN     "dueSoonNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "dueSoonNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3);

