-- Research enters weight (kg); shipping per unit = weight × Settings shipping rate per kg.
ALTER TABLE "Product" ADD COLUMN "weightKg" DECIMAL(10,3),
ADD COLUMN "shippingRatePerKgBdt" DECIMAL(10,2);

ALTER TABLE "Settings" ADD COLUMN "shippingRatePerKgBdt" DECIMAL(10,2);
