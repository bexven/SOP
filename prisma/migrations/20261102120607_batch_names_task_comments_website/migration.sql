-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "CreativeBatch" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "websiteUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Until now the website product images task carried the product page URL: keep it as the product's website link.
UPDATE "Product" p SET "websiteUrl" = sub."url"
FROM (
  SELECT DISTINCT ON (t."productId") t."productId", i."url"
  FROM "Task" t
  JOIN "TaskSubmission" s ON s."taskId" = t."id"
  JOIN "SubmissionItem" i ON i."submissionId" = s."id"
  WHERE t."type" = 'WEBSITE_IMAGE' AND i."url" IS NOT NULL
  ORDER BY t."productId", s."createdAt" DESC
) sub
WHERE p."id" = sub."productId" AND p."websiteUrl" IS NULL;

CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");
