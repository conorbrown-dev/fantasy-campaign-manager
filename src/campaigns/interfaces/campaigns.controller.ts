import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { mkdirSync } from "fs";
import { extname, join } from "path";
import { diskStorage } from "multer";
import { CampaignsService } from "../application/campaigns.service";
import {
  CreateAssetDto,
  CreateCampaignDto,
  CreateCreatureDto,
  CreateEncounterDto,
  CreatePlayerDto,
  CreateQuestDto,
  DmLoginDto,
  SetBgmDto,
  UpdateCharacterSheetDto,
  UpsertMapPinDto,
} from "./dtos";
import { DmAuthGuard } from "./dm-auth.guard";

type UploadedAssetFile = {
  filename: string;
  originalname: string;
  mimetype: string;
};

function safePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

@Controller()
export class CampaignsController {
  constructor(
    @Inject(CampaignsService) private readonly campaigns: CampaignsService,
  ) {}

  @Post("campaigns")
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.campaigns.createCampaign(dto);
  }

  @Post("campaigns/:slug/dm/login")
  loginDm(@Param("slug") slug: string, @Body() dto: DmLoginDto) {
    return this.campaigns.loginDm(slug, dto.password);
  }

  @Get("campaigns/:slug")
  getPlayerCampaign(@Param("slug") slug: string) {
    return this.campaigns.getPlayerCampaign(slug);
  }

  @Get("campaigns/:slug/dm")
  @UseGuards(DmAuthGuard)
  getDmCampaign(@Param("slug") slug: string) {
    return this.campaigns.getDmCampaign(slug);
  }

  @Post("campaigns/:slug/players")
  createPlayer(@Param("slug") slug: string, @Body() dto: CreatePlayerDto) {
    return this.campaigns.createPlayer(slug, dto);
  }

  @Put("players/:playerId/sheet")
  updateCharacterSheet(
    @Param("playerId") playerId: string,
    @Body() dto: UpdateCharacterSheetDto,
  ) {
    return this.campaigns.updateCharacterSheet(playerId, dto);
  }

  @Post("campaigns/:slug/quests")
  @UseGuards(DmAuthGuard)
  createQuest(@Param("slug") slug: string, @Body() dto: CreateQuestDto) {
    return this.campaigns.createQuest(slug, dto);
  }

  @Get("creatures")
  searchCreatures(
    @Query("q") query?: string,
    @Query("environment") environment?: string,
  ) {
    return this.campaigns.searchCreatures(query, environment);
  }

  @Post("creatures")
  @UseGuards(DmAuthGuard)
  createCreature(@Body() dto: CreateCreatureDto) {
    return this.campaigns.createCreature(dto);
  }

  @Post("campaigns/:slug/encounters")
  @UseGuards(DmAuthGuard)
  createEncounter(
    @Param("slug") slug: string,
    @Body() dto: CreateEncounterDto,
  ) {
    return this.campaigns.createEncounter(slug, dto);
  }

  @Post("campaigns/:slug/bgm")
  @UseGuards(DmAuthGuard)
  setBgm(@Param("slug") slug: string, @Body() dto: SetBgmDto) {
    return this.campaigns.setBgm(slug, dto.assetId);
  }

  @Post("campaigns/:slug/assets")
  @UseGuards(DmAuthGuard)
  createAsset(@Param("slug") slug: string, @Body() dto: CreateAssetDto) {
    return this.campaigns.createAsset(slug, dto);
  }

  @Post("campaigns/:slug/assets/upload")
  @UseGuards(DmAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (request, _file, callback) => {
          const rawSlug = request.params.slug;
          const slug = safePathPart(
            Array.isArray(rawSlug) ? rawSlug[0] : rawSlug,
          );
          const destination = join(process.cwd(), "uploads", slug);
          mkdirSync(destination, { recursive: true });
          callback(null, destination);
        },
        filename: (_request, file, callback) => {
          const baseName = file.originalname
            .replace(extname(file.originalname), "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
          callback(
            null,
            `${Date.now()}-${baseName || "asset"}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  uploadAsset(
    @Param("slug") slug: string,
    @Body("kind") kind: string,
    @UploadedFile() file?: UploadedAssetFile,
  ) {
    if (!file) {
      throw new BadRequestException("Upload requires a file.");
    }

    const normalizedKind = (kind || "MISC").toUpperCase();
    const assetUrl = `/uploads/${safePathPart(slug)}/${file.filename}`;

    return this.campaigns.createAsset(slug, {
      kind: normalizedKind,
      name: file.originalname,
      url: assetUrl,
      mimeType: file.mimetype,
    });
  }

  @Post("campaigns/:slug/map-pins")
  @UseGuards(DmAuthGuard)
  createMapPin(@Param("slug") slug: string, @Body() dto: UpsertMapPinDto) {
    return this.campaigns.createMapPin(slug, dto);
  }
}
