-- CreateTable
CREATE TABLE "CharacterSheetRevision" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "stats" JSONB NOT NULL,
    "equipment" JSONB NOT NULL,
    "money" JSONB NOT NULL,
    "rolls" JSONB NOT NULL,
    "abilities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterSheetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterSheetRevision_playerId_createdAt_idx" ON "CharacterSheetRevision"("playerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CharacterSheetRevision" ADD CONSTRAINT "CharacterSheetRevision_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
