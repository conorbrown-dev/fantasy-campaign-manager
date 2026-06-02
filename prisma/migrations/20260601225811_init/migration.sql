-- CreateEnum
CREATE TYPE "CampaignTheme" AS ENUM ('PURPLE_LILAC', 'MINT_YELLOW', 'PINK_GRAY', 'DM_FORGE');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('PLANNED', 'ACTIVE', 'RESOLVED');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dmPasswordHash" TEXT NOT NULL,
    "theme" "CampaignTheme" NOT NULL DEFAULT 'PURPLE_LILAC',
    "currentBgmAssetId" TEXT,
    "bgmStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "stats" JSONB NOT NULL,
    "equipment" JSONB NOT NULL,
    "money" JSONB NOT NULL,
    "rolls" JSONB NOT NULL,
    "abilities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loot" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "Loot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "preferredEnvironment" TEXT NOT NULL,
    "armorClass" INTEGER,
    "hitPoints" INTEGER,
    "attackInfo" JSONB NOT NULL,
    "rolls" JSONB NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Creature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'PLANNED',
    "mapAssetId" TEXT,
    "ruleNotes" JSONB NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterCreature" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "nickname" TEXT,
    "currentHp" INTEGER,
    "initiative" INTEGER,

    CONSTRAINT "EncounterCreature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapPin" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iconUrl" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MapPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Quest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loot" ADD CONSTRAINT "Loot_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterCreature" ADD CONSTRAINT "EncounterCreature_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterCreature" ADD CONSTRAINT "EncounterCreature_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapPin" ADD CONSTRAINT "MapPin_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
