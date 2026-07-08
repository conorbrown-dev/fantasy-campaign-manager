-- Add BGM playlists and sortable track membership.
ALTER TABLE "Asset"
ADD COLUMN "bgmPlaylistId" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BgmPlaylist" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BgmPlaylist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BgmPlaylist_campaignId_name_key" ON "BgmPlaylist"("campaignId", "name");
CREATE INDEX "BgmPlaylist_campaignId_sortOrder_idx" ON "BgmPlaylist"("campaignId", "sortOrder");
CREATE INDEX "Asset_bgmPlaylistId_sortOrder_idx" ON "Asset"("bgmPlaylistId", "sortOrder");

ALTER TABLE "BgmPlaylist"
ADD CONSTRAINT "BgmPlaylist_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset"
ADD CONSTRAINT "Asset_bgmPlaylistId_fkey"
FOREIGN KEY ("bgmPlaylistId") REFERENCES "BgmPlaylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
