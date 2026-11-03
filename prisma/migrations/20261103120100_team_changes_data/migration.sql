-- Owner's team changes (Nov 2026). Name-based and safe to run once on any copy of the data.
-- No PINs here: new people start without a PIN; the Master Admin sets PINs in Team.

-- 1. Remove people who were already deactivated (hidden everywhere; their history stays).
UPDATE "User" SET "removedAt" = NOW() WHERE "active" = false AND "removedAt" IS NULL;

-- 2. Renames and job roles.
UPDATE "User" SET "name" = 'Jewel Rana', "role" = 'ADMIN', "adminAccess" = false WHERE "name" = 'Jewel';
UPDATE "User" SET "name" = 'Shohagh' WHERE "name" = 'Shohag';

-- 3. Inamul (Reviewer) gets every permission (but no Bexven — that's a separate brand access).
UPDATE "User" SET "permissions" = ARRAY[
  'research.view','product.create','product.approve','task.review','brief.edit','campaign.manage','batch.request',
  'orders.manage','product.sendBack','product.kill','product.override','task.reassignAny','overview.view','settings.manage'
]::TEXT[] WHERE "name" = 'Inamul';

-- 4. New people.
INSERT INTO "User" ("id", "name", "role", "pinHash", "avatarColor", "mustChangePin", "permissions", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v.role::"Role", '!pin-not-set', v.color, true, ARRAY[]::TEXT[], NOW()
FROM (VALUES
  ('Shakil', 'IMAGE_DESIGNER', 'teal'),
  ('Antu', 'CUSTOMER_SUPPORT', 'amber'),
  ('Fahim', 'OFFICE_SECRETARY', 'fuchsia')
) AS v(name, role, color)
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE lower(u."name") = lower(v.name));

-- 5. Shakil takes over from Kamrul: Kamrul's open work moves to Shakil, then Kamrul is removed.
UPDATE "Task" t SET "assigneeId" = s."id", "assignedAt" = NOW()
FROM "User" k, "User" s
WHERE k."name" = 'Kamrul' AND s."name" = 'Shakil' AND t."assigneeId" = k."id"
  AND t."status" IN ('LOCKED', 'TODO', 'SUBMITTED', 'REVISION');
UPDATE "User" SET "active" = false, "removedAt" = NOW(), "sessionVersion" = "sessionVersion" + 1, "telegramChatId" = NULL
WHERE "name" = 'Kamrul' AND "removedAt" IS NULL;
DELETE FROM "PushDevice" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "removedAt" IS NOT NULL);

-- 6. New brand Bexven: restricted (only people given access, and the Master Admin).
INSERT INTO "Brand" ("id", "name", "color", "restricted", "order")
SELECT gen_random_uuid()::text, 'Bexven', '#111827', true, COALESCE((SELECT MAX("order") + 1 FROM "Brand"), 0)
WHERE NOT EXISTS (SELECT 1 FROM "Brand" WHERE "name" = 'Bexven');

-- 7. Open work still held by removed people goes to an active person in the same role (or stays unassigned).
UPDATE "Task" t SET "assigneeId" = (
    SELECT u."id" FROM "User" u
    WHERE u."active" AND u."removedAt" IS NULL AND u."role" = t."role"
    ORDER BY u."lastAssignedAt" ASC NULLS FIRST, u."name" LIMIT 1
  ), "assignedAt" = NOW()
FROM "User" r
WHERE t."assigneeId" = r."id" AND r."removedAt" IS NOT NULL
  AND t."status" IN ('LOCKED', 'TODO', 'SUBMITTED', 'REVISION');
UPDATE "Product" p SET "mediaBuyerId" = (
    SELECT u."id" FROM "User" u WHERE u."active" AND u."removedAt" IS NULL AND u."role" = 'MEDIA_BUYER' ORDER BY u."name" LIMIT 1
  )
FROM "User" r
WHERE p."mediaBuyerId" = r."id" AND r."removedAt" IS NOT NULL AND p."stage" NOT IN ('COMPLETED', 'KILLED');
