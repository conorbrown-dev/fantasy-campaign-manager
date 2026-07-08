-- CreateEnum
CREATE TYPE "CampaignNoteTriggerType" AS ENUM ('ROLL_CHECK', 'PLAYER_ACTION', 'LOCATION_ENTRY', 'ITEM_POSSESSION', 'STORY_FLAG', 'TIME_ELAPSED', 'DM_DECISION');

-- CreateTable
CREATE TABLE "CampaignNoteTrigger" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "type" "CampaignNoteTriggerType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "checkType" TEXT,
    "difficultyClass" INTEGER,
    "playerId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignNoteTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignNoteTrigger_noteId_sortOrder_idx" ON "CampaignNoteTrigger"("noteId", "sortOrder");

-- CreateIndex
CREATE INDEX "CampaignNoteTrigger_playerId_idx" ON "CampaignNoteTrigger"("playerId");

-- CreateIndex
CREATE INDEX "CampaignNoteTrigger_type_idx" ON "CampaignNoteTrigger"("type");

-- AddForeignKey
ALTER TABLE "CampaignNoteTrigger" ADD CONSTRAINT "CampaignNoteTrigger_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "CampaignNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNoteTrigger" ADD CONSTRAINT "CampaignNoteTrigger_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
