-- New creative workflow for products still in Creative:
--   website product images → Meta ads portrait → Meta ads square; main video → square video.
-- Landscape ads and the store listing are no longer made: cancel the ones not yet approved.
UPDATE "Task" t SET "status" = 'CANCELLED', "updatedAt" = NOW()
FROM "Product" p
WHERE t."productId" = p."id" AND p."stage" = 'CREATIVE'
  AND t."type" IN ('AD_IMAGE_LANDSCAPE', 'STORE_LISTING')
  AND t."status" IN ('LOCKED', 'TODO', 'REVISION', 'SUBMITTED');

-- Square ads now wait for the portrait ads of the same batch.
UPDATE "Task" sq SET "dependsOnId" = pt."id", "phase" = 3, "updatedAt" = NOW()
FROM "Task" pt, "Product" p
WHERE sq."productId" = p."id" AND p."stage" = 'CREATIVE'
  AND sq."type" = 'AD_IMAGE_SQUARE' AND pt."type" = 'AD_IMAGE_VERTICAL'
  AND sq."batchId" IS NOT NULL AND pt."batchId" = sq."batchId"
  AND sq."status" <> 'APPROVED' AND sq."followUpOfId" IS NULL AND pt."followUpOfId" IS NULL;

-- …and go back to locked until the portrait ads are approved.
UPDATE "Task" sq SET "status" = 'LOCKED', "dueAt" = NULL, "unlockedAt" = NULL, "updatedAt" = NOW()
FROM "Task" pt
WHERE sq."dependsOnId" = pt."id" AND sq."type" = 'AD_IMAGE_SQUARE' AND sq."status" = 'TODO' AND pt."status" <> 'APPROVED';
