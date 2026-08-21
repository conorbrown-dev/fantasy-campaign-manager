export type ThemeKey =
  | "PURPLE_LILAC"
  | "MINT_YELLOW"
  | "PINK_GRAY"
  | "DM_FORGE";

export type Player = {
  id: string;
  name: string;
  iconUrl?: string;
  theme?: ThemeKey | null;
  stats: Record<string, unknown>;
  equipment: Record<string, unknown> & { items?: string[] };
  money: Record<string, number>;
  rolls?: unknown[];
  abilities: string[];
  archivedAt?: string | null;
};

export type CharacterSheetHistoryEntry = {
  id: string;
  summary: string;
  stats: Record<string, unknown>;
  equipment: Record<string, unknown>;
  money: Record<string, number>;
  rolls: unknown[];
  abilities: string[];
  createdAt: string;
};

export type Creature = {
  id: string;
  name: string;
  imageUrl?: string;
  preferredEnvironment: string;
  hitPoints?: number;
  armorClass?: number;
};

export type TurnActor = {
  type: "PLAYER" | "DM";
  id: string;
  name: string;
  roll: number;
};

export type InitiativeRoll = {
  playerId: string;
  playerName: string;
  roll: number;
};

export type EncounterRuleNotes = {
  reminders?: string[];
  phase?: "DRAFT" | "ROLLING" | "IN_PROGRESS" | "RESOLVED";
  initiativeRolls?: Record<string, InitiativeRoll>;
  turnOrder?: TurnActor[];
  currentTurnIndex?: number;
  round?: number;
  startedAt?: string;
  completedAt?: string;
};

export type Encounter = {
  id: string;
  name: string;
  status: EncounterStatus;
  mapAssetId?: string | null;
  ruleNotes?: EncounterRuleNotes;
  creatures: Array<{
    id: string;
    nickname?: string | null;
    armorClass?: number | null;
    maxHitPoints?: number | null;
    currentHp?: number | null;
    speed?: number | null;
    initiative?: number | null;
    strength?: number | null;
    dexterity?: number | null;
    constitution?: number | null;
    intelligence?: number | null;
    wisdom?: number | null;
    charisma?: number | null;
    keyItems?: string[];
    creature: Creature;
  }>;
};

export type EncounterStatus = "DRAFT" | "PENDING" | "ACTIVE" | "ARCHIVED";

export type EncounterCreatureStatKey =
  | "armorClass"
  | "maxHitPoints"
  | "currentHp"
  | "speed"
  | "initiative"
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export type EncounterDraftCreature = MonsterCatalogEntry &
  Record<EncounterCreatureStatKey, number> & { keyItems: string[] };

export type CampaignNoteType =
  | "STORY_POINT"
  | "IMPORTANT_EVENT"
  | "COMBAT_ENCOUNTER"
  | "NONCOMBAT_ENCOUNTER"
  | "LOOT_GEAR"
  | "NPC_NOTE"
  | "LOCATION_DETAIL";

export type CampaignNoteAttachmentType =
  | "LOOT_GEAR"
  | "NPC"
  | "STORY_POINT"
  | "IMPORTANT_EVENT"
  | "COMBAT_ENCOUNTER"
  | "NONCOMBAT_ENCOUNTER";

export type CampaignNoteTriggerType =
  | "ROLL_CHECK"
  | "PLAYER_ACTION"
  | "LOCATION_ENTRY"
  | "ITEM_POSSESSION"
  | "STORY_FLAG"
  | "TIME_ELAPSED"
  | "DM_DECISION";

export type CampaignNoteAttachment = {
  id: string;
  type: CampaignNoteAttachmentType;
  name: string;
  details: string;
  quantity?: number | null;
};

export type CampaignNoteTrigger = {
  id: string;
  type: CampaignNoteTriggerType;
  label: string;
  description: string;
  checkType?: string | null;
  difficultyClass?: number | null;
  player?: Player | null;
};

export type CampaignNote = {
  id: string;
  locationId?: string | null;
  title: string;
  type: CampaignNoteType;
  summary: string;
  content: string;
  dmPrivate: boolean;
  keywords: string[];
  occurredAt?: string | null;
  sortOrder: number;
  createdAt: string;
  location?: CampaignLocation | null;
  players: Array<{ player: Player }>;
  attachments: CampaignNoteAttachment[];
  triggers: CampaignNoteTrigger[];
};

export type CampaignLocation = {
  id: string;
  name: string;
  description: Array<{ sortOrder: number; text: string }>;
  sortOrder: number;
  notes?: CampaignNote[];
};

export type Asset = {
  id: string;
  bgmPlaylistId?: string | null;
  kind: string;
  name: string;
  url: string;
  mimeType: string;
  sortOrder?: number;
  createdAt?: string;
};

export type BgmPlaylist = {
  id: string;
  campaignId: string;
  name: string;
  sortOrder: number;
  tracks: Asset[];
};

export type Campaign = {
  id: string;
  name: string;
  slug: string;
  theme: ThemeKey;
  currentBgmAssetId?: string | null;
  bgmStartedAt?: string | null;
  currentCampaignMapAssetId?: string | null;
  currentStoryImageAssetId?: string | null;
  playerMapVisible?: boolean;
  storyImageVisible?: boolean;
  allowPlayerTheme?: boolean;
  campaignMapSetAt?: string | null;
  storyImageSetAt?: string | null;
  assets?: Asset[];
  bgmPlaylists?: BgmPlaylist[];
  players: Player[];
  quests: Array<{ id: string; title: string; summary: string; status: string }>;
  mapPins: Array<{
    id: string;
    label: string;
    iconUrl?: string;
    x: number;
    y: number;
  }>;
  encounters?: Encounter[];
  locations?: CampaignLocation[];
  campaignNotes?: CampaignNote[];
};

export type SourceType =
  | "SRD"
  | "Open5e"
  | "FiveEBits"
  | "Homebrew"
  | "SessionNotes"
  | "CustomMonster"
  | "CustomSpell"
  | "HouseRule";

export type RetrievalMode =
  | "All"
  | "RulesOnly"
  | "HomebrewOnly"
  | "RulesAndHomebrew"
  | "SessionNotesOnly";

export type PlayerReferenceCategory =
  | "All"
  | "Attacks"
  | "AbilityScores"
  | "AdventuringGear"
  | "Alignment"
  | "Backgrounds"
  | "DamageTypes"
  | "Classes"
  | "Combat"
  | "Conditions"
  | "Equipment"
  | "Feats"
  | "Languages"
  | "Magic"
  | "MountsVehicles"
  | "Races"
  | "SavingThrows"
  | "Spells"
  | "TimeMovement"
  | "Tools"
  | "Weapons"
  | "PlayInstructions";

export type KnowledgeDocument = {
  id: string;
  sourceName: string;
  sourceType: SourceType;
  originalFileName: string;
  importedAt: string;
  status: string;
  errorMessage?: string;
  chunkCount: number;
  attributionText?: string;
  licenseText?: string;
};

export type KnowledgeSource = {
  id: string;
  sourceName: string;
  sourceType: SourceType;
  title: string;
  sectionPath: string[];
  pageNumber?: number | null;
  relevanceScore: number;
  textPreview: string;
};

export type KnowledgeChatResponse = {
  answer: string;
  sources: KnowledgeSource[];
  retrievedChunks: Array<KnowledgeSource & { text: string }>;
  answerMode?: "retrieval";
};

export type MonsterCatalogEntry = {
  id: string;
  creatureId?: string | null;
  name: string;
  pageNumber: number;
  pageImageUrl: string;
  sizeType?: string | null;
  armorClass?: number | null;
  hitPoints?: number | null;
  challengeRating?: string | null;
  sourceName: string;
  textPreview: string;
  relevanceScore: number;
};

export type MonsterManualDocument = {
  id: string;
  title: string;
  originalFileName: string;
  importedAt: string;
  status: string;
  errorMessage?: string | null;
  pageCount: number;
  entryCount: number;
};

export const sourceTypes: SourceType[] = [
  "SRD",
  "Open5e",
  "FiveEBits",
  "Homebrew",
  "SessionNotes",
  "CustomMonster",
  "CustomSpell",
  "HouseRule",
];

export const retrievalModes: RetrievalMode[] = [
  "All",
  "RulesOnly",
  "HomebrewOnly",
  "RulesAndHomebrew",
  "SessionNotesOnly",
];

export const playerReferenceCategories: PlayerReferenceCategory[] = [
  "All",
  "Attacks",
  "AbilityScores",
  "AdventuringGear",
  "Alignment",
  "Backgrounds",
  "DamageTypes",
  "Classes",
  "Combat",
  "Conditions",
  "Equipment",
  "Feats",
  "Languages",
  "Magic",
  "MountsVehicles",
  "Races",
  "SavingThrows",
  "Spells",
  "TimeMovement",
  "Tools",
  "Weapons",
  "PlayInstructions",
];

export type PendingLookup = (actionId: string) => boolean;

export const pendingIds = {
  createCampaign: "campaign:create",
  loginDm: "dm:login",
  joinPlayer: "player:join",
  createEncounter: "encounter:create",
  importMonsterManual: "monster:manual:import",
  importSrdMonsterCatalog: "monster:srd:import",
  searchMonsterCatalog: "monster:search",
  uploadBgm: "bgm:upload",
  linkBgm: "bgm:link",
  uploadSfx: "sfx:upload",
  linkSfx: "sfx:link",
  createBgmPlaylist: "bgm:playlist:create",
  togglePlayerTheme: "theme:player-permission",
  updateOwnTheme: "theme:player:update",
  uploadCampaignMap: "map:upload",
  togglePlayerMap: "map:visibility",
  uploadStoryImage: "story-image:upload",
  toggleStoryImage: "story-image:visibility",
  saveLocation: "location:save",
  saveNote: "note:save",
  searchNotes: "notes:search",
  importKnowledge: "knowledge:import",
  importBundledSrd: "knowledge:srd:import",
  searchKnowledge: "knowledge:search",
  askKnowledge: "knowledge:ask",
  askPlayerReference: "player-reference:ask",
  startEncounter: (encounterId: string) => `encounter:start:${encounterId}`,
  beginEncounterCombat: (encounterId: string) =>
    `encounter:begin:${encounterId}`,
  endDmTurn: (encounterId: string) => `encounter:end-dm-turn:${encounterId}`,
  resolveEncounter: (encounterId: string) => `encounter:resolve:${encounterId}`,
  setEncounterStatus: (encounterId: string, status: EncounterStatus) =>
    `encounter:status:${encounterId}:${status}`,
  updateEncounterCreature: (encounterCreatureId: string) =>
    `encounter-creature:update:${encounterCreatureId}`,
  submitInitiative: (encounterId: string, playerId: string) =>
    `initiative:${encounterId}:${playerId}`,
  endPlayerTurn: (encounterId: string, playerId: string) =>
    `player-turn:end:${encounterId}:${playerId}`,
  archivePlayer: (playerId: string) => `player:archive:${playerId}`,
  setBgmTrack: (assetId: string) => `bgm:set:${assetId}`,
  updateBgmPlaylist: (playlistId: string) => `bgm:playlist:${playlistId}`,
  assignBgmTrack: (assetId: string) => `bgm:track:assign:${assetId}`,
  moveBgmTrack: (assetId: string, direction: "up" | "down") =>
    `bgm:track:move:${assetId}:${direction}`,
  moveSfxTrack: (assetId: string, direction: "up" | "down") =>
    `sfx:track:move:${assetId}:${direction}`,
  moveNote: (noteId: string, direction: "up" | "down") =>
    `note:move:${noteId}:${direction}`,
  reindexKnowledge: (documentId?: string) =>
    `knowledge:reindex:${documentId ?? "all"}`,
  deleteKnowledge: (documentId: string) => `knowledge:delete:${documentId}`,
  saveSheet: (playerId: string) => `sheet:save:${playerId}`,
};

export const playerReferenceCategoryLabels: Record<
  PlayerReferenceCategory,
  string
> = {
  All: "All Rules",
  Attacks: "Attacks",
  AbilityScores: "Ability Scores",
  AdventuringGear: "Adventuring Gear",
  Alignment: "Alignment",
  Backgrounds: "Backgrounds",
  DamageTypes: "Damage Types",
  Classes: "Classes",
  Combat: "Combat",
  Conditions: "Conditions",
  Equipment: "Equipment",
  Feats: "Feats",
  Languages: "Languages",
  Magic: "Magic",
  MountsVehicles: "Mounts & Vehicles",
  Races: "Races",
  SavingThrows: "Saving Throws",
  Spells: "Spells",
  TimeMovement: "Time & Movement",
  Tools: "Tools",
  Weapons: "Weapons",
  PlayInstructions: "How To Play",
};

export const campaignNoteTypes: CampaignNoteType[] = [
  "STORY_POINT",
  "IMPORTANT_EVENT",
  "COMBAT_ENCOUNTER",
  "NONCOMBAT_ENCOUNTER",
  "LOOT_GEAR",
  "NPC_NOTE",
  "LOCATION_DETAIL",
];

export const campaignNoteTypeLabels: Record<CampaignNoteType, string> = {
  STORY_POINT: "Story Point",
  IMPORTANT_EVENT: "Important Event",
  COMBAT_ENCOUNTER: "Combat Encounter",
  NONCOMBAT_ENCOUNTER: "Non-Combat Encounter",
  LOOT_GEAR: "Loot/Gear",
  NPC_NOTE: "NPC",
  LOCATION_DETAIL: "Location Detail",
};

export const campaignNoteAttachmentTypes: CampaignNoteAttachmentType[] = [
  "LOOT_GEAR",
  "NPC",
  "STORY_POINT",
  "IMPORTANT_EVENT",
  "COMBAT_ENCOUNTER",
  "NONCOMBAT_ENCOUNTER",
];

export const campaignNoteAttachmentTypeLabels: Record<
  CampaignNoteAttachmentType,
  string
> = {
  LOOT_GEAR: "Loot/Gear",
  NPC: "NPC",
  STORY_POINT: "Story Point",
  IMPORTANT_EVENT: "Important Event",
  COMBAT_ENCOUNTER: "Combat Encounter",
  NONCOMBAT_ENCOUNTER: "Non-Combat Encounter",
};

export const campaignNoteTriggerTypes: CampaignNoteTriggerType[] = [
  "ROLL_CHECK",
  "PLAYER_ACTION",
  "LOCATION_ENTRY",
  "ITEM_POSSESSION",
  "STORY_FLAG",
  "TIME_ELAPSED",
  "DM_DECISION",
];

export const campaignNoteTriggerTypeLabels: Record<
  CampaignNoteTriggerType,
  string
> = {
  ROLL_CHECK: "Roll Check",
  PLAYER_ACTION: "Player Action",
  LOCATION_ENTRY: "Location Entry",
  ITEM_POSSESSION: "Item Possession",
  STORY_FLAG: "Story Flag",
  TIME_ELAPSED: "Time Elapsed",
  DM_DECISION: "DM Decision",
};

export const themeClasses: Record<
  ThemeKey,
  {
    bg: string;
    panel: string;
    primary: string;
    secondary: string;
    button: string;
  }
> = {
  PURPLE_LILAC: {
    bg: "bg-[#2a1748]",
    panel: "bg-[#f1e7ff]",
    primary: "text-[#3d2368]",
    secondary: "bg-[#d9b8ff]",
    button: "bg-[#7a45b8] text-white",
  },
  MINT_YELLOW: {
    bg: "bg-[#1f4b42]",
    panel: "bg-[#efffd6]",
    primary: "text-[#163f38]",
    secondary: "bg-[#bff3df]",
    button: "bg-[#348f76] text-white",
  },
  PINK_GRAY: {
    bg: "bg-[#4c3845]",
    panel: "bg-[#fff0f6]",
    primary: "text-[#503444]",
    secondary: "bg-[#d8d8dc]",
    button: "bg-[#d95f9f] text-white",
  },
  DM_FORGE: {
    bg: "bg-metal",
    panel: "bg-stone text-white",
    primary: "text-white",
    secondary: "bg-[#4d4d4d]",
    button: "bg-wood text-white",
  },
};

export type CharacterSheetPayload = {
  stats: Record<string, unknown>;
  equipment: Record<string, unknown> & { items: string[] };
  money: Record<string, number>;
  rolls: unknown[];
  abilities: string[];
};

export function numberFromForm(data: FormData, name: string, fallback: number) {
  const value = Number(data.get(name));
  return Number.isFinite(value) ? value : fallback;
}

export function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function rangeRows(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => index);
}

export function dateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 16);
}

export function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString();
}

export function splitFreeformList(value: string) {
  return value
    .split(/[\n,]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function numberValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function booleanValue(value: unknown) {
  return value === true;
}

export function abilityModifier(score: unknown) {
  const numericScore =
    typeof score === "number"
      ? score
      : typeof score === "string" && score.trim()
        ? Number(score)
        : Number.NaN;

  return Number.isFinite(numericScore)
    ? Math.floor((numericScore - 10) / 2)
    : null;
}

export function getProficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

export function getMonsterProficiencyBonus(challengeRating: number): number {
  if (challengeRating < 0 || challengeRating > 30) {
    throw new RangeError("Challenge rating must be between 0 and 30.");
  }

  if (challengeRating < 1) {
    return 2;
  }

  return 2 + Math.floor((challengeRating - 1) / 4);
}

export function parseChallengeRating(challengeRating: unknown) {
  if (typeof challengeRating === "number") {
    return Number.isFinite(challengeRating) ? challengeRating : null;
  }

  if (typeof challengeRating !== "string") {
    return null;
  }

  const trimmed = challengeRating.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") {
    return null;
  }

  const [numerator, denominator] = trimmed.split("/");
  if (denominator !== undefined) {
    const parsedNumerator = Number(numerator);
    const parsedDenominator = Number(denominator);

    return Number.isFinite(parsedNumerator) &&
      Number.isFinite(parsedDenominator) &&
      parsedDenominator !== 0
      ? parsedNumerator / parsedDenominator
      : null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function monsterProficiencyBonusForChallengeRating(
  challengeRating: unknown,
) {
  const parsedChallengeRating = parseChallengeRating(challengeRating);
  if (parsedChallengeRating === null) {
    return null;
  }

  try {
    return getMonsterProficiencyBonus(parsedChallengeRating);
  } catch {
    return null;
  }
}

export function signedModifier(value: number | null) {
  if (value === null) {
    return "";
  }

  return value >= 0 ? `+${value}` : String(value);
}

export function arrayText(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .join("\n")
    : "";
}

export const abilityFields = [
  { id: "strength", label: "Strength" },
  { id: "dexterity", label: "Dexterity" },
  { id: "constitution", label: "Constitution" },
  { id: "intelligence", label: "Intelligence" },
  { id: "wisdom", label: "Wisdom" },
  { id: "charisma", label: "Charisma" },
];

export const skillFields = [
  { id: "acrobatics", label: "Acrobatics (Dexterity)" },
  { id: "animalHandling", label: "Animal Handling (Wisdom)" },
  { id: "arcana", label: "Arcana (Intelligence)" },
  { id: "athletics", label: "Athletics (Strength)" },
  { id: "deception", label: "Deception (Charisma)" },
  { id: "history", label: "History (Intelligence)" },
  { id: "insight", label: "Insight (Wisdom)" },
  { id: "intimidation", label: "Intimidation (Charisma)" },
  { id: "investigation", label: "Investigation (Intelligence)" },
  { id: "medicine", label: "Medicine (Wisdom)" },
  { id: "nature", label: "Nature (Intelligence)" },
  { id: "perception", label: "Perception (Wisdom)" },
  { id: "performance", label: "Performance (Charisma)" },
  { id: "persuasion", label: "Persuasion (Charisma)" },
  { id: "religion", label: "Religion (Intelligence)" },
  { id: "sleightOfHand", label: "Sleight of Hand (Dexterity)" },
  { id: "stealth", label: "Stealth (Dexterity)" },
  { id: "survival", label: "Survival (Wisdom)" },
];

export const spellLevelFields = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const minimumBundledSrdMonsterEntries = 50;
