-- Prices are entered in BDT from now on. Convert existing RMB values with each product's saved rate.
ALTER TABLE "Product" ADD COLUMN "chinaPriceBdt" DECIMAL(12,2), ADD COLUMN "shippingPerUnitBdt" DECIMAL(12,2);
UPDATE "Product" SET
  "chinaPriceBdt" = ROUND("chinaPriceRmb" * "rmbToBdtRate", 2),
  "shippingPerUnitBdt" = ROUND("shippingPerUnitRmb" * "rmbToBdtRate", 2);
ALTER TABLE "Product" DROP COLUMN "chinaPriceRmb", DROP COLUMN "shippingPerUnitRmb";

-- Brand colours become hex values (owner: Mr.WOW = #15803D).
ALTER TABLE "Brand" ALTER COLUMN "color" SET DEFAULT '#4F46E5';
UPDATE "Brand" SET "color" = '#15803D' WHERE "name" = 'Mr.WOW';
UPDATE "Brand" SET "color" = '#0369A1' WHERE "name" = 'Timtom' AND "color" !~ '^#';
UPDATE "Brand" SET "color" = '#4F46E5' WHERE "color" !~ '^#';
