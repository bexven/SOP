-- Test orders: requested first, then an Admin / Media Buyer / Supply Chain confirms it was placed with an expected arrival.
ALTER TABLE "TestOrder" ADD COLUMN "placedAt" TIMESTAMP(3),
ADD COLUMN "placedById" TEXT;

-- Test orders that already have an arrival date were placed when they were created.
UPDATE "TestOrder" SET "placedAt" = "createdAt", "placedById" = "createdById" WHERE "expectedOn" IS NOT NULL AND "placedAt" IS NULL;

-- Saddam joins as Supply Chain (no PIN here: the Master Admin sets one in Team). Can handle orders.
INSERT INTO "User" ("id", "name", "role", "pinHash", "avatarColor", "mustChangePin", "permissions", "updatedAt")
SELECT gen_random_uuid()::text, 'Saddam', 'SUPPLY_CHAIN'::"Role", '!pin-not-set', 'orange', true, ARRAY['orders.manage']::TEXT[], NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE lower(u."name") = 'saddam');
