-- Two shipping options, both charged per kg. Settings.shippingRatePerKgBdt is the Air rate.
CREATE TYPE "ShippingMethod" AS ENUM ('AIR', 'SEA');

ALTER TABLE "Product" ADD COLUMN "shippingMethod" "ShippingMethod";

ALTER TABLE "Settings" ADD COLUMN "seaShippingRatePerKgBdt" DECIMAL(10,2);
