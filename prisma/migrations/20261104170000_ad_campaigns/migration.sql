
-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL', 'PREORDER', 'CATALOGUE', 'MESSAGES');

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CampaignType",
    "status" "CampaignStatus" NOT NULL DEFAULT 'NOT_LAUNCHED',
    "adsManagerUrl" TEXT,
    "metaCampaignId" TEXT,
    "dailyBudgetUsd" DECIMAL(10,2),
    "strategyNotes" TEXT,
    "launchedAt" TIMESTAMP(3),
    "launchedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaign_productId_number_key" ON "AdCampaign"("productId", "number");

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Copy each product's existing campaign as campaign #1 (the old table is left as it was).
INSERT INTO "AdCampaign" ("id", "productId", "number", "name", "type", "status", "adsManagerUrl", "metaCampaignId", "dailyBudgetUsd", "strategyNotes", "launchedAt", "launchedById", "createdById", "createdAt", "updatedAt")
SELECT 'ad' || md5("id"), "productId", 1, 'Campaign 1', NULL, "status", "adsManagerUrl", "metaCampaignId", "dailyBudgetUsd", "strategyNotes", "launchedAt", "launchedById", "launchedById", COALESCE("launchedAt", "updatedAt"), "updatedAt"
FROM "Campaign";
