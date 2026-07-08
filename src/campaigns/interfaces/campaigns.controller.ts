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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { mkdirSync } from "fs";
import { extname, join } from "path";
import { diskStorage } from "multer";
import { CampaignsService } from "../application/campaigns.service";
import { MonsterManualCatalogService } from "../application/monster-manual-catalog.service";
import {
  ArchivePlayerDto,
  AssignBgmTrackDto,
  CreateAssetDto,
  CreateBgmPlaylistDto,
  CreateCampaignDto,
  CreateCampaignLocationDto,
  CreateCampaignNoteDto,
  CreateCreatureDto,
  CreateEncounterDto,
  CreatePlayerDto,
  CreateQuestDto,
  DmLoginDto,
  LinkBgmTrackDto,
  SetBgmDto,
  SetCampaignMapDto,
  SetPlayerThemePermissionDto,
  SetStoryImageDto,
  SetVisibilityDto,
  SubmitInitiativeDto,
  UpdateBgmPlaylistDto,
  UpdateCharacterSheetDto,
  UpdateEncounterCreatureDto,
  UpdateEncounterStatusDto,
  UpdatePlayerThemeDto,
  UpsertMapPinDto,
} from "./dtos";
import { DmAuthGuard } from "./dm-auth.guard";
import { CampaignGateway } from "../../realtime/campaign.gateway";

type UploadedAssetFile = {
  filename: string;
  originalname: string;
  mimetype: string;
};

type UploadedManualFile = UploadedAssetFile & {
  path: string;
};

function safePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

@Controller()
export class CampaignsController {
  constructor(
    @Inject(CampaignsService) private readonly campaigns: CampaignsService,
    @Inject(MonsterManualCatalogService)
    private readonly monsterCatalog: MonsterManualCatalogService,
    @Inject(CampaignGateway)
    private readonly campaignGateway: CampaignGateway,
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

  @Put("campaigns/:slug/players/:playerId/archive")
  @UseGuards(DmAuthGuard)
  async archivePlayer(
    @Param("slug") slug: string,
    @Param("playerId") playerId: string,
    @Body() dto: ArchivePlayerDto,
  ) {
    const player = await this.campaigns.archivePlayer(
      slug,
      playerId,
      dto.archived,
    );
    this.campaignGateway.syncCampaignState(slug);
    return player;
  }

  @Put("players/:playerId/sheet")
  updateCharacterSheet(
    @Param("playerId") playerId: string,
    @Body() dto: UpdateCharacterSheetDto,
  ) {
    return this.campaigns.updateCharacterSheet(playerId, dto);
  }

  @Put("players/:playerId/theme")
  updatePlayerTheme(
    @Param("playerId") playerId: string,
    @Body() dto: UpdatePlayerThemeDto,
  ) {
    return this.campaigns.updatePlayerTheme(playerId, dto.theme);
  }

  @Get("players/:playerId/sheet/history")
  listCharacterSheetHistory(@Param("playerId") playerId: string) {
    return this.campaigns.listCharacterSheetHistory(playerId);
  }

  @Post("campaigns/:slug/quests")
  @UseGuards(DmAuthGuard)
  createQuest(@Param("slug") slug: string, @Body() dto: CreateQuestDto) {
    return this.campaigns.createQuest(slug, dto);
  }

  @Get("campaigns/:slug/notes")
  @UseGuards(DmAuthGuard)
  listCampaignNotes(
    @Param("slug") slug: string,
    @Query("q") query?: string,
    @Query("playerId") playerId?: string,
    @Query("locationId") locationId?: string,
    @Query("type") type?: string,
  ) {
    return this.campaigns.listCampaignNotes(slug, {
      q: query,
      playerId,
      locationId,
      type,
    });
  }

  @Post("campaigns/:slug/locations")
  @UseGuards(DmAuthGuard)
  createCampaignLocation(
    @Param("slug") slug: string,
    @Body() dto: CreateCampaignLocationDto,
  ) {
    return this.campaigns.createCampaignLocation(slug, dto);
  }

  @Put("campaigns/:slug/locations/:locationId")
  @UseGuards(DmAuthGuard)
  updateCampaignLocation(
    @Param("slug") slug: string,
    @Param("locationId") locationId: string,
    @Body() dto: CreateCampaignLocationDto,
  ) {
    return this.campaigns.updateCampaignLocation(slug, locationId, dto);
  }

  @Post("campaigns/:slug/notes")
  @UseGuards(DmAuthGuard)
  createCampaignNote(
    @Param("slug") slug: string,
    @Body() dto: CreateCampaignNoteDto,
  ) {
    return this.campaigns.createCampaignNote(slug, dto);
  }

  @Put("campaigns/:slug/notes/:noteId")
  @UseGuards(DmAuthGuard)
  updateCampaignNote(
    @Param("slug") slug: string,
    @Param("noteId") noteId: string,
    @Body() dto: CreateCampaignNoteDto,
  ) {
    return this.campaigns.updateCampaignNote(slug, noteId, dto);
  }

  @Post("campaigns/:slug/notes/:noteId/move")
  @UseGuards(DmAuthGuard)
  moveCampaignNote(
    @Param("slug") slug: string,
    @Param("noteId") noteId: string,
    @Body("direction") direction: "up" | "down",
  ) {
    if (direction !== "up" && direction !== "down") {
      throw new BadRequestException("Direction must be up or down.");
    }

    return this.campaigns.moveCampaignNote(slug, noteId, direction);
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

  @Get("campaigns/:slug/monster-catalog")
  @UseGuards(DmAuthGuard)
  searchMonsterCatalog(
    @Param("slug") slug: string,
    @Query("q") query?: string,
    @Query("wholeWords") wholeWords?: string,
  ) {
    return this.monsterCatalog.search(slug, query, {
      wholeWords: wholeWords === "true",
    });
  }

  @Get("campaigns/:slug/monster-manuals")
  @UseGuards(DmAuthGuard)
  listMonsterManuals(@Param("slug") slug: string) {
    return this.monsterCatalog.listDocuments(slug);
  }

  @Post("campaigns/:slug/monster-catalog/import-srd")
  @UseGuards(DmAuthGuard)
  importSrdMonsterCatalog(@Param("slug") slug: string) {
    return this.monsterCatalog.importBundledSrd(slug);
  }

  @Post("campaigns/:slug/monster-manuals/upload")
  @UseGuards(DmAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (request, _file, callback) => {
          const rawSlug = request.params.slug;
          const slug = safePathPart(
            Array.isArray(rawSlug) ? rawSlug[0] : rawSlug,
          );
          const destination = join(
            process.cwd(),
            "uploads",
            slug,
            "manual-imports",
          );
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
            `${Date.now()}-${baseName || "monster-manual"}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: {
        fileSize: 500 * 1024 * 1024,
      },
    }),
  )
  importMonsterManual(
    @Param("slug") slug: string,
    @Body("title") title: string | undefined,
    @UploadedFile() file?: UploadedManualFile,
  ) {
    if (!file) {
      throw new BadRequestException("Monster manual import requires a PDF.");
    }

    if (extname(file.originalname).toLowerCase() !== ".pdf") {
      throw new BadRequestException(
        "Monster manual import only accepts PDF files.",
      );
    }

    return this.monsterCatalog.importManual(slug, {
      title,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      filePath: file.path,
    });
  }

  @Post("campaigns/:slug/encounters")
  @UseGuards(DmAuthGuard)
  async createEncounter(
    @Param("slug") slug: string,
    @Body() dto: CreateEncounterDto,
  ) {
    const encounter = await this.campaigns.createEncounter(slug, dto);
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Put("campaigns/:slug/encounters/:encounterId")
  @UseGuards(DmAuthGuard)
  async updateEncounter(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
    @Body() dto: CreateEncounterDto,
  ) {
    const encounter = await this.campaigns.updateEncounter(
      slug,
      encounterId,
      dto,
    );
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Post("campaigns/:slug/encounters/:encounterId/start")
  @UseGuards(DmAuthGuard)
  async startEncounter(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
  ) {
    const encounter = await this.campaigns.startEncounter(slug, encounterId);
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Post("campaigns/:slug/encounters/:encounterId/status")
  @UseGuards(DmAuthGuard)
  async updateEncounterStatus(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
    @Body() dto: UpdateEncounterStatusDto,
  ) {
    const encounter = await this.campaigns.updateEncounterStatus(
      slug,
      encounterId,
      dto.status,
    );
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Put("campaigns/:slug/encounters/:encounterId/creatures/:encounterCreatureId")
  @UseGuards(DmAuthGuard)
  async updateEncounterCreature(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
    @Param("encounterCreatureId") encounterCreatureId: string,
    @Body() dto: UpdateEncounterCreatureDto,
  ) {
    const encounter = await this.campaigns.updateEncounterCreature(
      slug,
      encounterId,
      encounterCreatureId,
      dto,
    );
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Post("campaigns/:slug/encounters/:encounterId/begin")
  @UseGuards(DmAuthGuard)
  async beginEncounterCombat(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
  ) {
    const encounter = await this.campaigns.beginEncounterCombat(
      slug,
      encounterId,
    );
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Post("campaigns/:slug/encounters/:encounterId/players/:playerId/initiative")
  async submitInitiative(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
    @Param("playerId") playerId: string,
    @Body() dto: SubmitInitiativeDto,
  ) {
    const encounter = await this.campaigns.submitInitiative(
      slug,
      encounterId,
      playerId,
      dto.roll,
    );
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Post("campaigns/:slug/encounters/:encounterId/players/:playerId/end-turn")
  async endPlayerTurn(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
    @Param("playerId") playerId: string,
  ) {
    const encounter = await this.campaigns.endPlayerTurn(
      slug,
      encounterId,
      playerId,
    );
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Post("campaigns/:slug/encounters/:encounterId/dm/end-turn")
  @UseGuards(DmAuthGuard)
  async endDmTurn(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
  ) {
    const encounter = await this.campaigns.endDmTurn(slug, encounterId);
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Post("campaigns/:slug/encounters/:encounterId/resolve")
  @UseGuards(DmAuthGuard)
  async resolveEncounter(
    @Param("slug") slug: string,
    @Param("encounterId") encounterId: string,
  ) {
    const encounter = await this.campaigns.resolveEncounter(slug, encounterId);
    this.campaignGateway.syncEncounter(slug);
    return encounter;
  }

  @Post("campaigns/:slug/bgm")
  @UseGuards(DmAuthGuard)
  setBgm(@Param("slug") slug: string, @Body() dto: SetBgmDto) {
    return this.campaigns.setBgm(slug, dto.assetId);
  }

  @Post("campaigns/:slug/bgm/playlists")
  @UseGuards(DmAuthGuard)
  createBgmPlaylist(
    @Param("slug") slug: string,
    @Body() dto: CreateBgmPlaylistDto,
  ) {
    return this.campaigns.createBgmPlaylist(slug, dto.name);
  }

  @Put("campaigns/:slug/bgm/playlists/:playlistId")
  @UseGuards(DmAuthGuard)
  updateBgmPlaylist(
    @Param("slug") slug: string,
    @Param("playlistId") playlistId: string,
    @Body() dto: UpdateBgmPlaylistDto,
  ) {
    return this.campaigns.updateBgmPlaylist(slug, playlistId, dto.name);
  }

  @Put("campaigns/:slug/bgm/tracks/:assetId/playlist")
  @UseGuards(DmAuthGuard)
  assignBgmTrackToPlaylist(
    @Param("slug") slug: string,
    @Param("assetId") assetId: string,
    @Body() dto: AssignBgmTrackDto,
  ) {
    return this.campaigns.assignBgmTrackToPlaylist(
      slug,
      assetId,
      dto.playlistId,
    );
  }

  @Post("campaigns/:slug/bgm/tracks/:assetId/move")
  @UseGuards(DmAuthGuard)
  moveBgmTrack(
    @Param("slug") slug: string,
    @Param("assetId") assetId: string,
    @Body("direction") direction: "up" | "down",
  ) {
    if (direction !== "up" && direction !== "down") {
      throw new BadRequestException("Direction must be up or down.");
    }

    return this.campaigns.moveBgmTrack(slug, assetId, direction);
  }

  @Post("campaigns/:slug/bgm/tracks/upload")
  @UseGuards(DmAuthGuard)
  @UseInterceptors(
    FilesInterceptor("files", 25, {
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
            `${Date.now()}-${baseName || "bgm"}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: {
        fileSize: 500 * 1024 * 1024,
      },
    }),
  )
  uploadBgmTracks(
    @Param("slug") slug: string,
    @Body("playlistName") playlistName: string | undefined,
    @UploadedFiles() files?: UploadedAssetFile[],
  ) {
    if (!files?.length) {
      throw new BadRequestException("Upload requires at least one BGM track.");
    }

    return this.campaigns.createBgmTracks(
      slug,
      playlistName,
      files.map((file) => ({
        kind: "BGM",
        name: file.originalname,
        url: `/uploads/${safePathPart(slug)}/${file.filename}`,
        mimeType: file.mimetype,
      })),
    );
  }

  @Post("campaigns/:slug/bgm/tracks/link")
  @UseGuards(DmAuthGuard)
  linkBgmTrack(@Param("slug") slug: string, @Body() dto: LinkBgmTrackDto) {
    return this.campaigns.createBgmTrackLink(slug, dto);
  }

  @Post("campaigns/:slug/campaignMap")
  @UseGuards(DmAuthGuard)
  async setCampaignMap(
    @Param("slug") slug: string,
    @Body() dto: SetCampaignMapDto,
  ) {
    const campaign = await this.campaigns.setCampaignMap(slug, dto.assetId);
    this.campaignGateway.syncCampaignState(slug);
    return campaign;
  }

  @Put("campaigns/:slug/player-map-visibility")
  @UseGuards(DmAuthGuard)
  async setPlayerMapVisibility(
    @Param("slug") slug: string,
    @Body() dto: SetVisibilityDto,
  ) {
    const campaign = await this.campaigns.setPlayerMapVisibility(
      slug,
      dto.visible,
    );
    this.campaignGateway.syncCampaignState(slug);
    return campaign;
  }

  @Post("campaigns/:slug/story-image")
  @UseGuards(DmAuthGuard)
  async setStoryImage(
    @Param("slug") slug: string,
    @Body() dto: SetStoryImageDto,
  ) {
    const campaign = await this.campaigns.setStoryImage(slug, dto.assetId);
    this.campaignGateway.syncCampaignState(slug);
    return campaign;
  }

  @Put("campaigns/:slug/story-image-visibility")
  @UseGuards(DmAuthGuard)
  async setStoryImageVisibility(
    @Param("slug") slug: string,
    @Body() dto: SetVisibilityDto,
  ) {
    const campaign = await this.campaigns.setStoryImageVisibility(
      slug,
      dto.visible,
    );
    this.campaignGateway.syncCampaignState(slug);
    return campaign;
  }

  @Put("campaigns/:slug/player-theme-permission")
  @UseGuards(DmAuthGuard)
  async setPlayerThemePermission(
    @Param("slug") slug: string,
    @Body() dto: SetPlayerThemePermissionDto,
  ) {
    const campaign = await this.campaigns.setPlayerThemePermission(
      slug,
      dto.allowed,
    );
    this.campaignGateway.syncCampaignState(slug);
    return campaign;
  }

  @Post("campaigns/:slug/sfx/tracks/upload")
  @UseGuards(DmAuthGuard)
  @UseInterceptors(
    FilesInterceptor("files", 25, {
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
            `${Date.now()}-${baseName || "sfx"}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: {
        fileSize: 500 * 1024 * 1024,
      },
    }),
  )
  uploadSfxTracks(
    @Param("slug") slug: string,
    @UploadedFiles() files?: UploadedAssetFile[],
  ) {
    if (!files?.length) {
      throw new BadRequestException("Upload requires at least one SFX track.");
    }

    return this.campaigns.createSfxTracks(
      slug,
      files.map((file) => ({
        kind: "SFX",
        name: file.originalname,
        url: `/uploads/${safePathPart(slug)}/${file.filename}`,
        mimeType: file.mimetype,
      })),
    );
  }

  @Post("campaigns/:slug/sfx/tracks/link")
  @UseGuards(DmAuthGuard)
  linkSfxTrack(@Param("slug") slug: string, @Body() dto: LinkBgmTrackDto) {
    return this.campaigns.createSfxTrackLink(slug, dto);
  }

  @Post("campaigns/:slug/sfx/tracks/:assetId/move")
  @UseGuards(DmAuthGuard)
  moveSfxTrack(
    @Param("slug") slug: string,
    @Param("assetId") assetId: string,
    @Body("direction") direction: "up" | "down",
  ) {
    if (direction !== "up" && direction !== "down") {
      throw new BadRequestException("Direction must be up or down.");
    }

    return this.campaigns.moveSfxTrack(slug, assetId, direction);
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
        fileSize: 500 * 1024 * 1024,
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
