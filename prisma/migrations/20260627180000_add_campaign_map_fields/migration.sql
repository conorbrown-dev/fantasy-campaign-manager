-- AlterTable
ALTER TABLE "Campaign"
ADD COLUMN IF NOT EXISTS "currentCampaignMapAssetId" TEXT,
ADD COLUMN IF NOT EXISTS "campaignMapSetAt" TIMESTAMP(3);
