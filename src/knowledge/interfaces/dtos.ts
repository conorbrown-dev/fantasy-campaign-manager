import {
  IsBoolean,
  IsBooleanString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import {
  knowledgeSourceTypes,
  KnowledgeSourceType,
  retrievalModes,
  RetrievalMode,
} from "../domain/knowledge.types";

export const playerReferenceCategories = [
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
] as const;

export type PlayerReferenceCategory =
  (typeof playerReferenceCategories)[number];

export class ImportKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  sourceName!: string;

  @IsEnum(knowledgeSourceTypes)
  sourceType!: KnowledgeSourceType;

  @IsString()
  @IsOptional()
  licenseText?: string;

  @IsString()
  @IsOptional()
  attributionText?: string;
}

export class SearchKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  q!: string;

  @IsIn(retrievalModes)
  @IsOptional()
  mode?: RetrievalMode;

  @IsEnum(knowledgeSourceTypes)
  @IsOptional()
  sourceType?: KnowledgeSourceType;

  @IsBooleanString()
  @IsOptional()
  wholeWords?: string;
}

export class ChatKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsIn(retrievalModes)
  @IsOptional()
  mode?: RetrievalMode;

  @IsBoolean()
  @IsOptional()
  wholeWords?: boolean;
}

export class PlayerReferenceDto {
  @IsIn(playerReferenceCategories)
  category!: PlayerReferenceCategory;

  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsBoolean()
  @IsOptional()
  wholeWords?: boolean;
}
