-- Owner's team (Nov 2026): Sakib becomes "Sk Moni", the Master Admin (same PIN).
UPDATE "User" SET "name" = 'Sk Moni', "isMaster" = true WHERE "name" = 'Sakib' AND "role" = 'ADMIN';
-- If no master exists yet (fresh database), the first active admin becomes master.
UPDATE "User" SET "isMaster" = true
WHERE "id" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "active" ORDER BY "createdAt" LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "isMaster");

-- Placeholder test people are deactivated (history kept), not deleted.
UPDATE "User" SET "active" = false, "sessionVersion" = "sessionVersion" + 1
WHERE "name" IN ('Arif', 'Tanvir', 'Sadia', 'Rafiq', 'Nusrat') AND NOT "isMaster";

-- New team. No PIN is stored here (never commit PIN hashes): the Master Admin sets each person's PIN
-- on the Team page. Until then the account can't sign in.
INSERT INTO "User" ("id", "name", "role", "pinHash", "avatarColor", "adminAccess", "mustChangePin", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v.role::"Role", '!pin-not-set', v.color, v.admin, true, now()
FROM (VALUES
  ('Inamul', 'REVIEWER', 'violet', false),
  ('Jewel', 'RESEARCHER', 'sky', true),
  ('Rony', 'VIDEO_EDITOR', 'rose', false),
  ('Kamrul', 'IMAGE_DESIGNER', 'orange', false),
  ('Shohag', 'MEDIA_BUYER', 'emerald', false)
) AS v(name, role, color, admin)
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE lower(u."name") = lower(v.name));

-- Brands.
INSERT INTO "Brand" ("id", "name", "color", "order")
SELECT gen_random_uuid()::text, v.name, v.color, v.ord
FROM (VALUES ('Timtom', 'sky', 0), ('Mr.WOW', 'amber', 1)) AS v(name, color, ord)
WHERE NOT EXISTS (SELECT 1 FROM "Brand" b WHERE b."name" = v.name);

-- SLA for the new Product approval task.
INSERT INTO "TaskTypeConfig" ("taskType", "slaHours", "updatedAt")
VALUES ('PRODUCT_APPROVAL', 24, now())
ON CONFLICT ("taskType") DO NOTHING;
