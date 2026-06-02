export const campaignThemes = [
  "PURPLE_LILAC",
  "MINT_YELLOW",
  "PINK_GRAY",
  "DM_FORGE",
] as const;

export type CampaignTheme = (typeof campaignThemes)[number];
