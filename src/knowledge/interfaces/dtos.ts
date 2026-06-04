import {
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
}

export class ChatKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsIn(retrievalModes)
  @IsOptional()
  mode?: RetrievalMode;
}
