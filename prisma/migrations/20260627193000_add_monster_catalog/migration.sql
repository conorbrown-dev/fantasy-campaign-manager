-- CreateTable
CREATE TABLE "MonsterManualDocument" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "contentHash" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'IMPORTED',
    "errorMessage" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MonsterManualDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonsterCatalogEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "creatureId" TEXT,
    "name" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "pageImageUrl" TEXT NOT NULL,
    "sizeType" TEXT,
    "armorClass" INTEGER,
    "hitPoints" INTEGER,
    "challengeRating" TEXT,
    "sourceText" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonsterCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonsterManualDocument_campaignId_contentHash_key" ON "MonsterManualDocument"("campaignId", "contentHash");

-- CreateIndex
CREATE INDEX "MonsterManualDocument_campaignId_importedAt_idx" ON "MonsterManualDocument"("campaignId", "importedAt");

-- CreateIndex
CREATE INDEX "MonsterCatalogEntry_campaignId_name_idx" ON "MonsterCatalogEntry"("campaignId", "name");

-- CreateIndex
CREATE INDEX "MonsterCatalogEntry_campaignId_pageNumber_idx" ON "MonsterCatalogEntry"("campaignId", "pageNumber");

-- CreateIndex
CREATE INDEX "MonsterCatalogEntry_documentId_idx" ON "MonsterCatalogEntry"("documentId");

-- AddForeignKey
ALTER TABLE "MonsterManualDocument" ADD CONSTRAINT "MonsterManualDocument_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterCatalogEntry" ADD CONSTRAINT "MonsterCatalogEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterCatalogEntry" ADD CONSTRAINT "MonsterCatalogEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MonsterManualDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
