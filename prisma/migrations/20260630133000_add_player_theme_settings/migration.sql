ALTER TABLE "Campaign"
ADD COLUMN "allowPlayerTheme" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Player"
ADD COLUMN "theme" "CampaignTheme";
