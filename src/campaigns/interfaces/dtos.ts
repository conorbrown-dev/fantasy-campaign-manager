import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from "class-validator";
import { campaignThemes, CampaignTheme } from "../domain/campaign-theme";

export const campaignNoteTypes = [
  "STORY_POINT",
  "IMPORTANT_EVENT",
  "COMBAT_ENCOUNTER",
  "NONCOMBAT_ENCOUNTER",
  "LOOT_GEAR",
  "NPC_NOTE",
  "LOCATION_DETAIL",
] as const;

export type CampaignNoteType = (typeof campaignNoteTypes)[number];

export const campaignNoteAttachmentTypes = [
  "LOOT_GEAR",
  "NPC",
  "STORY_POINT",
  "IMPORTANT_EVENT",
  "COMBAT_ENCOUNTER",
  "NONCOMBAT_ENCOUNTER",
] as const;

export type CampaignNoteAttachmentType =
  (typeof campaignNoteAttachmentTypes)[number];

export const campaignNoteTriggerTypes = [
  "ROLL_CHECK",
  "PLAYER_ACTION",
  "LOCATION_ENTRY",
  "ITEM_POSSESSION",
  "STORY_FLAG",
  "TIME_ELAPSED",
  "DM_DECISION",
] as const;

export type CampaignNoteTriggerType = (typeof campaignNoteTriggerTypes)[number];

export const encounterStatuses = [
  "DRAFT",
  "PENDING",
  "ACTIVE",
  "ARCHIVED",
] as const;

export type EncounterStatus = (typeof encounterStatuses)[number];

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MinLength(6)
  dmPassword!: string;

  @IsEnum(campaignThemes)
  @IsOptional()
  theme?: CampaignTheme;
}

export class DmLoginDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class CreatePlayerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MinLength(4)
  accessCode!: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;
}

export class UpdateCharacterSheetDto {
  @IsObject()
  stats!: Record<string, unknown>;

  @IsObject()
  equipment!: Record<string, unknown>;

  @IsObject()
  money!: Record<string, unknown>;

  @IsArray()
  rolls!: unknown[];

  @IsArray()
  abilities!: unknown[];
}

export class CreateQuestDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  summary!: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class CreateCreatureDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  preferredEnvironment!: string;

  @IsNumber()
  @IsOptional()
  armorClass?: number;

  @IsNumber()
  @IsOptional()
  hitPoints?: number;

  @IsObject()
  attackInfo!: Record<string, unknown>;

  @IsObject()
  rolls!: Record<string, unknown>;
}

export class CreateEncounterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  mapAssetId?: string;

  @IsArray()
  @IsOptional()
  creatureIds?: string[];

  @IsArray()
  @IsOptional()
  creatures?: CreateEncounterCreatureDto[];

  @IsIn(["DRAFT", "PENDING"])
  @IsOptional()
  status?: Extract<EncounterStatus, "DRAFT" | "PENDING">;
}

export class CreateEncounterCreatureDto {
  @IsString()
  @IsNotEmpty()
  creatureId!: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsInt()
  @IsOptional()
  armorClass?: number;

  @IsInt()
  @IsOptional()
  maxHitPoints?: number;

  @IsInt()
  @IsOptional()
  currentHp?: number;

  @IsInt()
  @IsOptional()
  speed?: number;

  @IsInt()
  @IsOptional()
  initiative?: number;

  @IsInt()
  @IsOptional()
  strength?: number;

  @IsInt()
  @IsOptional()
  dexterity?: number;

  @IsInt()
  @IsOptional()
  constitution?: number;

  @IsInt()
  @IsOptional()
  intelligence?: number;

  @IsInt()
  @IsOptional()
  wisdom?: number;

  @IsInt()
  @IsOptional()
  charisma?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keyItems?: string[];
}

export class UpdateEncounterStatusDto {
  @IsIn(encounterStatuses)
  status!: EncounterStatus;
}

export class UpdateEncounterCreatureDto {
  @IsInt()
  @IsOptional()
  armorClass?: number;

  @IsInt()
  @IsOptional()
  maxHitPoints?: number;

  @IsInt()
  @IsOptional()
  currentHp?: number;

  @IsInt()
  @IsOptional()
  speed?: number;

  @IsInt()
  @IsOptional()
  initiative?: number;
}

export class SubmitInitiativeDto {
  @IsInt()
  roll!: number;
}

export class SetBgmDto {
  @IsString()
  @IsNotEmpty()
  assetId!: string;
}

export class CreateBgmPlaylistDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateBgmPlaylistDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class AssignBgmTrackDto {
  @IsString()
  @IsOptional()
  playlistId?: string;
}

export class LinkBgmTrackDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsString()
  @IsOptional()
  playlistName?: string;
}

export class SetCampaignMapDto {
  @IsString()
  @IsNotEmpty()
  assetId!: string;
}

export class SetStoryImageDto {
  @IsString()
  @IsNotEmpty()
  assetId!: string;
}

export class SetVisibilityDto {
  @IsBoolean()
  visible!: boolean;
}

export class SetPlayerThemePermissionDto {
  @IsBoolean()
  allowed!: boolean;
}

export class UpdatePlayerThemeDto {
  @IsEnum(campaignThemes)
  theme!: CampaignTheme;
}

export class ArchivePlayerDto {
  @IsBoolean()
  archived!: boolean;
}

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  kind!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;
}

export class UpsertMapPinDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class CreateCampaignLocationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsOptional()
  description?: Array<{ sortOrder?: number; text?: string }>;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class CreateCampaignNoteAttachmentDto {
  @IsEnum(campaignNoteAttachmentTypes)
  type!: CampaignNoteAttachmentType;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  details?: string;

  @IsInt()
  @IsOptional()
  quantity?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateCampaignNoteTriggerDto {
  @IsEnum(campaignNoteTriggerTypes)
  type!: CampaignNoteTriggerType;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  checkType?: string;

  @IsInt()
  @IsOptional()
  difficultyClass?: number;

  @IsString()
  @IsOptional()
  playerId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class CreateCampaignNoteDto {
  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsEnum(campaignNoteTypes)
  type!: CampaignNoteType;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  dmPrivate?: boolean;

  @IsArray()
  @IsOptional()
  keywords?: string[];

  @IsArray()
  @IsOptional()
  playerIds?: string[];

  @IsArray()
  @IsOptional()
  attachments?: CreateCampaignNoteAttachmentDto[];

  @IsArray()
  @IsOptional()
  triggers?: CreateCampaignNoteTriggerDto[];

  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
