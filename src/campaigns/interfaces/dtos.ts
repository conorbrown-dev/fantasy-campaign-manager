import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { campaignThemes, CampaignTheme } from "../domain/campaign-theme";

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
}

export class SetBgmDto {
  @IsString()
  @IsNotEmpty()
  assetId!: string;
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
