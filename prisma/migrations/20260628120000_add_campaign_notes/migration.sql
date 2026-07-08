-- CreateEnum
CREATE TYPE "CampaignNoteType" AS ENUM ('STORY_POINT', 'IMPORTANT_EVENT', 'COMBAT_ENCOUNTER', 'NONCOMBAT_ENCOUNTER', 'LOOT_GEAR', 'NPC_NOTE', 'LOCATION_DETAIL');

-- CreateEnum
CREATE TYPE "CampaignNoteAttachmentType" AS ENUM ('LOOT_GEAR', 'NPC', 'STORY_POINT', 'IMPORTANT_EVENT', 'COMBAT_ENCOUNTER', 'NONCOMBAT_ENCOUNTER');

-- CreateTable
CREATE TABLE "CampaignLocation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignNote" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "locationId" TEXT,
    "title" TEXT NOT NULL,
    "type" "CampaignNoteType" NOT NULL DEFAULT 'IMPORTANT_EVENT',
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "dmPrivate" BOOLEAN NOT NULL DEFAULT true,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "occurredAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignNotePlayer" (
    "noteId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "CampaignNotePlayer_pkey" PRIMARY KEY ("noteId","playerId")
);

-- CreateTable
CREATE TABLE "CampaignNoteAttachment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "type" "CampaignNoteAttachmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignNoteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignLocation_campaignId_name_idx" ON "CampaignLocation"("campaignId", "name");

-- CreateIndex
CREATE INDEX "CampaignLocation_campaignId_sortOrder_idx" ON "CampaignLocation"("campaignId", "sortOrder");

-- CreateIndex
CREATE INDEX "CampaignNote_campaignId_type_idx" ON "CampaignNote"("campaignId", "type");

-- CreateIndex
CREATE INDEX "CampaignNote_campaignId_locationId_idx" ON "CampaignNote"("campaignId", "locationId");

-- CreateIndex
CREATE INDEX "CampaignNote_campaignId_occurredAt_idx" ON "CampaignNote"("campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "CampaignNotePlayer_playerId_idx" ON "CampaignNotePlayer"("playerId");

-- CreateIndex
CREATE INDEX "CampaignNoteAttachment_noteId_type_idx" ON "CampaignNoteAttachment"("noteId", "type");

-- AddForeignKey
ALTER TABLE "CampaignLocation" ADD CONSTRAINT "CampaignLocation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNote" ADD CONSTRAINT "CampaignNote_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNote" ADD CONSTRAINT "CampaignNote_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "CampaignLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNotePlayer" ADD CONSTRAINT "CampaignNotePlayer_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "CampaignNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNotePlayer" ADD CONSTRAINT "CampaignNotePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNoteAttachment" ADD CONSTRAINT "CampaignNoteAttachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "CampaignNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
