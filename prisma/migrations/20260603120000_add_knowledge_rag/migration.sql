-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('SRD', 'Open5e', 'FiveEBits', 'Homebrew', 'SessionNotes', 'CustomMonster', 'CustomSpell', 'HouseRule');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('IMPORTED', 'CHUNKED', 'INDEXED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeChunkIndexStatus" AS ENUM ('PENDING', 'INDEXED', 'FAILED');

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "licenseText" TEXT,
    "attributionText" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'IMPORTED',
    "errorMessage" TEXT,
    "indexedAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "sectionPath" TEXT[],
    "pageNumber" INTEGER,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "textPreview" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "embedding" JSONB,
    "indexStatus" "KnowledgeChunkIndexStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "indexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_campaignId_sourceType_idx" ON "KnowledgeDocument"("campaignId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_campaignId_contentHash_key" ON "KnowledgeDocument"("campaignId", "contentHash");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_campaignId_sourceType_idx" ON "KnowledgeChunk"("campaignId", "sourceType");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_chunkIndex_idx" ON "KnowledgeChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_campaignId_hash_key" ON "KnowledgeChunk"("campaignId", "hash");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
