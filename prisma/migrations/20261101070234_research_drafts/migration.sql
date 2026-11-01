-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "stageBeforeKill" "ProductStage",
ALTER COLUMN "supplierUrl" DROP NOT NULL,
ALTER COLUMN "chinaPriceRmb" DROP NOT NULL,
ALTER COLUMN "shippingPerUnitRmb" DROP NOT NULL,
ALTER COLUMN "sellingPriceBdt" DROP NOT NULL;
