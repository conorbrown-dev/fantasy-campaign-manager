ALTER TABLE "Campaign" ADD COLUMN "currentStoryImageAssetId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "playerMapVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN "storyImageVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN "storyImageSetAt" TIMESTAMP(3);

ALTER TABLE "Player" ADD COLUMN "archivedAt" TIMESTAMP(3);
