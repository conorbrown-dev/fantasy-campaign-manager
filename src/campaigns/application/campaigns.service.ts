import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateAssetDto,
  CreateCampaignDto,
  CreateCampaignLocationDto,
  CreateCampaignNoteDto,
  CreateCreatureDto,
  CreateEncounterDto,
  CreatePlayerDto,
  CreateQuestDto,
  EncounterStatus,
  LinkBgmTrackDto,
  UpdateCharacterSheetDto,
  UpdateEncounterCreatureDto,
  UpsertMapPinDto,
} from "../interfaces/dtos";
import { CampaignTheme } from "../domain/campaign-theme";

type TurnActor = {
  type: "PLAYER" | "DM";
  id: string;
  name: string;
  roll: number;
};

type InitiativeRoll = {
  playerId: string;
  playerName: string;
  roll: number;
};

type EncounterRuleNotes = {
  reminders: string[];
  phase: "DRAFT" | "ROLLING" | "IN_PROGRESS" | "RESOLVED";
  initiativeRolls: Record<string, InitiativeRoll>;
  turnOrder: TurnActor[];
  currentTurnIndex: number;
  round: number;
  startedAt?: string;
  completedAt?: string;
};

type BgmAssetRecord = {
  id: string;
  campaignId: string;
  kind: string;
  name: string;
  url: string;
  mimeType: string;
  bgmPlaylistId?: string | null;
  sortOrder: number;
  createdAt: Date;
};

const defaultSheet = {
  stats: {
    characterName: "",
    level: 1,
    className: "",
    background: "",
    playerName: "",
    species: "",
    race: "",
    alignment: "",
    experiencePoints: 0,
    inspiration: false,
    proficiencyBonus: 2,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    identity: {
      characterName: "",
      classAndLevel: "",
      background: "",
      playerName: "",
      race: "",
      alignment: "",
      experiencePoints: 0,
    },
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    savingThrows: {
      strength: { proficient: false, bonus: 0 },
      dexterity: { proficient: false, bonus: 0 },
      constitution: { proficient: false, bonus: 0 },
      intelligence: { proficient: false, bonus: 0 },
      wisdom: { proficient: false, bonus: 0 },
      charisma: { proficient: false, bonus: 0 },
    },
    skills: {
      acrobatics: { proficient: false, bonus: 0 },
      animalHandling: { proficient: false, bonus: 0 },
      arcana: { proficient: false, bonus: 0 },
      athletics: { proficient: false, bonus: 0 },
      deception: { proficient: false, bonus: 0 },
      history: { proficient: false, bonus: 0 },
      insight: { proficient: false, bonus: 0 },
      intimidation: { proficient: false, bonus: 0 },
      investigation: { proficient: false, bonus: 0 },
      medicine: { proficient: false, bonus: 0 },
      nature: { proficient: false, bonus: 0 },
      perception: { proficient: false, bonus: 0 },
      performance: { proficient: false, bonus: 0 },
      persuasion: { proficient: false, bonus: 0 },
      religion: { proficient: false, bonus: 0 },
      sleightOfHand: { proficient: false, bonus: 0 },
      stealth: { proficient: false, bonus: 0 },
      survival: { proficient: false, bonus: 0 },
    },
    combat: {
      armorClass: 10,
      initiative: 0,
      speed: "",
      hitPointMaximum: 0,
      currentHitPoints: 0,
      temporaryHitPoints: 0,
      hitDiceTotal: "",
      hitDice: "",
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      passivePerception: 10,
    },
    personality: {
      traits: "",
      ideals: "",
      bonds: "",
      flaws: "",
    },
    appearance: {
      age: "",
      height: "",
      weight: "",
      eyes: "",
      skin: "",
      hair: "",
      description: "",
      backstory: "",
      alliesAndOrganizations: "",
      organizationName: "",
      organizationSymbol: "",
      additionalFeatures: "",
    },
    spellcasting: {
      className: "",
      ability: "",
      saveDc: 0,
      attackBonus: 0,
      spellsKnown: "",
      levels: {},
    },
    sheetInstructionsRead: false,
  },
  equipment: {
    items: [],
    attacksAndSpellcasting: [],
    otherProficienciesAndLanguages: "",
    featuresAndTraits: "",
    treasure: "",
  },
  money: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
  rolls: [],
  abilities: [],
};

const campaignNoteRelations = {
  location: true,
  players: { include: { player: true } },
  attachments: true,
  triggers: { include: { player: true }, orderBy: { sortOrder: "asc" } },
};

@Injectable()
export class CampaignsService {
  private readonly jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? "development-secret",
    signOptions: { expiresIn: "12h" },
  });

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createCampaign(dto: CreateCampaignDto) {
    const slug = this.slugify(dto.name);
    const dmPasswordHash = await argon2.hash(dto.dmPassword);

    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        slug,
        dmPasswordHash,
        theme: dto.theme ?? "PURPLE_LILAC",
      },
      select: { id: true, name: true, slug: true, theme: true },
    });
  }

  async loginDm(slug: string, password: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    const valid = await argon2.verify(campaign.dmPasswordHash, password);

    if (!valid) {
      throw new UnauthorizedException("Incorrect Dungeon Master password.");
    }

    return {
      token: this.jwt.sign({ campaignId: campaign.id, role: "DM" }),
    };
  }

  async getPlayerCampaign(slug: string) {
    const campaign = await this.findCampaignOrThrow(slug);

    const playerCampaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
      select: {
        id: true,
        name: true,
        slug: true,
        theme: true,
        currentBgmAssetId: true,
        bgmStartedAt: true,
        currentCampaignMapAssetId: true,
        campaignMapSetAt: true,
        currentStoryImageAssetId: true,
        playerMapVisible: true,
        storyImageVisible: true,
        storyImageSetAt: true,
        players: {
          where: { archivedAt: null } as unknown as Prisma.PlayerWhereInput,
          select: {
            id: true,
            name: true,
            iconUrl: true,
            stats: true,
            equipment: true,
            money: true,
            rolls: true,
            abilities: true,
            archivedAt: true,
            theme: true,
          } as unknown as Prisma.PlayerSelect,
        },
        quests: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            parentId: true,
          },
        },
        mapPins: true,
        encounters: {
          where: { status: "ACTIVE" },
          include: { creatures: { include: { creature: true } } },
          orderBy: { name: "asc" },
        },
        assets: {
          select: {
            id: true,
            kind: true,
            name: true,
            url: true,
            mimeType: true,
            createdAt: true,
          },
        },
      } as unknown as Prisma.CampaignSelect,
    });

    return {
      ...playerCampaign,
      allowPlayerTheme: await this.getAllowPlayerTheme(campaign.id),
    };
  }

  async getDmCampaign(slug: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    await this.ensureDefaultBgmPlaylist(campaign.id);

    const dmCampaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
      include: {
        players: true,
        quests: { include: { loot: true, subQuests: true } },
        encounters: { include: { creatures: { include: { creature: true } } } },
        assets: true,
        bgmPlaylists: {
          include: {
            tracks: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        mapPins: true,
        locations: {
          include: {
            notes: {
              include:
                campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        campaignNotes: {
          include:
            campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      } as unknown as Prisma.CampaignInclude,
    });

    return {
      ...dmCampaign,
      allowPlayerTheme: await this.getAllowPlayerTheme(campaign.id),
    };
  }

  async setPlayerThemePermission(slug: string, allowed: boolean) {
    const campaign = await this.findCampaignOrThrow(slug);

    await this.prisma.$executeRaw`
      UPDATE "Campaign"
      SET "allowPlayerTheme" = ${allowed}
      WHERE "id" = ${campaign.id}
    `;

    return {
      ...(await this.prisma.campaign.findUniqueOrThrow({
        where: { id: campaign.id },
        include: { assets: true },
      })),
      allowPlayerTheme: allowed,
    };
  }

  async createPlayer(slug: string, dto: CreatePlayerDto) {
    const campaign = await this.findCampaignOrThrow(slug);
    const name = dto.name.trim();
    const accessCode = dto.accessCode.trim();
    const existingPlayer = await this.prisma.player.findFirst({
      where: {
        campaignId: campaign.id,
        name: { equals: name, mode: "insensitive" },
      },
      orderBy: { createdAt: "asc" },
    });

    if (existingPlayer?.accessCodeHash) {
      if (isArchivedPlayer(existingPlayer)) {
        throw new BadRequestException(
          "That player has been archived by the DM.",
        );
      }

      const valid = await argon2.verify(
        existingPlayer.accessCodeHash,
        accessCode,
      );
      if (!valid) {
        throw new UnauthorizedException(
          "That player name already exists with a different access code.",
        );
      }

      return existingPlayer;
    }

    if (existingPlayer) {
      if (isArchivedPlayer(existingPlayer)) {
        throw new BadRequestException(
          "That player has been archived by the DM.",
        );
      }

      return this.prisma.player.update({
        where: { id: existingPlayer.id },
        data: {
          accessCodeHash: await argon2.hash(accessCode),
          iconUrl: dto.iconUrl ?? existingPlayer.iconUrl,
        },
      });
    }

    return this.prisma.player.create({
      data: {
        campaignId: campaign.id,
        name,
        accessCodeHash: await argon2.hash(accessCode),
        iconUrl: dto.iconUrl,
        ...defaultSheet,
      },
    });
  }

  async archivePlayer(slug: string, playerId: string, archived: boolean) {
    const campaign = await this.findCampaignOrThrow(slug);
    const player = await this.prisma.player.findFirst({
      where: { id: playerId, campaignId: campaign.id },
      select: { id: true },
    });

    if (!player) {
      throw new NotFoundException("Player was not found.");
    }

    return this.prisma.player.update({
      where: { id: playerId },
      data: {
        archivedAt: archived ? new Date() : null,
      } as unknown as Prisma.PlayerUpdateInput,
    });
  }

  async updateCharacterSheet(playerId: string, dto: UpdateCharacterSheetDto) {
    const previous = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        stats: true,
        equipment: true,
        money: true,
        rolls: true,
        abilities: true,
      },
    });

    if (!previous) {
      throw new NotFoundException("Player was not found.");
    }

    const updated = await this.prisma.player.update({
      where: { id: playerId },
      data: {
        stats: dto.stats as Prisma.InputJsonValue,
        equipment: dto.equipment as Prisma.InputJsonValue,
        money: dto.money as Prisma.InputJsonValue,
        rolls: dto.rolls as Prisma.InputJsonValue,
        abilities: dto.abilities as Prisma.InputJsonValue,
      },
    });

    await this.prisma.characterSheetRevision.create({
      data: {
        playerId,
        summary: summarizeSheetChanges(previous, dto),
        stats: dto.stats as Prisma.InputJsonValue,
        equipment: dto.equipment as Prisma.InputJsonValue,
        money: dto.money as Prisma.InputJsonValue,
        rolls: dto.rolls as Prisma.InputJsonValue,
        abilities: dto.abilities as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async updatePlayerTheme(playerId: string, theme: CampaignTheme) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { campaign: true },
    });

    if (!player) {
      throw new NotFoundException("Player was not found.");
    }

    if (!(await this.getAllowPlayerTheme(player.campaignId))) {
      throw new UnauthorizedException("The DM has not enabled player themes.");
    }

    return this.prisma.player.update({
      where: { id: playerId },
      data: { theme } as unknown as Prisma.PlayerUpdateInput,
    });
  }

  async listCharacterSheetHistory(playerId: string) {
    return this.prisma.characterSheetRevision.findMany({
      where: { playerId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async createQuest(slug: string, dto: CreateQuestDto) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.quest.create({
      data: {
        campaignId: campaign.id,
        title: dto.title,
        summary: dto.summary,
        parentId: dto.parentId,
      },
    });
  }

  async listCampaignNotes(
    slug: string,
    filters: {
      q?: string;
      playerId?: string;
      locationId?: string;
      type?: string;
    },
  ) {
    const campaign = await this.findCampaignOrThrow(slug);
    const query = filters.q?.trim();
    const queryTerms = query
      ? query
          .toLowerCase()
          .split(/[^a-z0-9]+/g)
          .filter(Boolean)
      : [];

    return this.prisma.campaignNote.findMany({
      where: {
        campaignId: campaign.id,
        locationId: filters.locationId || undefined,
        type: this.isCampaignNoteType(filters.type) ? filters.type : undefined,
        players: filters.playerId
          ? { some: { playerId: filters.playerId } }
          : undefined,
        OR: query
          ? [
              { title: { contains: query, mode: "insensitive" } },
              { summary: { contains: query, mode: "insensitive" } },
              { content: { contains: query, mode: "insensitive" } },
              { keywords: { hasSome: queryTerms } },
              {
                location: {
                  is: { name: { contains: query, mode: "insensitive" } },
                },
              },
              {
                players: {
                  some: {
                    player: { name: { contains: query, mode: "insensitive" } },
                  },
                },
              },
              {
                attachments: {
                  some: {
                    OR: [
                      { name: { contains: query, mode: "insensitive" } },
                      { details: { contains: query, mode: "insensitive" } },
                    ],
                  },
                },
              },
              {
                triggers: {
                  some: {
                    OR: [
                      { label: { contains: query, mode: "insensitive" } },
                      { description: { contains: query, mode: "insensitive" } },
                      { checkType: { contains: query, mode: "insensitive" } },
                      {
                        player: {
                          is: {
                            name: { contains: query, mode: "insensitive" },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ]
          : undefined,
      } as unknown as Prisma.CampaignNoteWhereInput,
      include: campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 100,
    });
  }

  async createCampaignLocation(slug: string, dto: CreateCampaignLocationDto) {
    const campaign = await this.findCampaignOrThrow(slug);
    const sortOrder =
      dto.sortOrder ??
      (await this.prisma.campaignLocation.count({
        where: { campaignId: campaign.id },
      }));

    return this.prisma.campaignLocation.create({
      data: {
        campaignId: campaign.id,
        name: dto.name.trim(),
        description: normalizeLocationDescription(dto.description),
        sortOrder,
      },
      include: {
        notes: {
          include:
            campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
        },
      },
    });
  }

  async updateCampaignLocation(
    slug: string,
    locationId: string,
    dto: CreateCampaignLocationDto,
  ) {
    const campaign = await this.findCampaignOrThrow(slug);
    const location = await this.prisma.campaignLocation.findFirst({
      where: { id: locationId, campaignId: campaign.id },
      select: { id: true, sortOrder: true },
    });

    if (!location) {
      throw new NotFoundException("Campaign location was not found.");
    }

    return this.prisma.campaignLocation.update({
      where: { id: locationId },
      data: {
        name: dto.name.trim(),
        description: normalizeLocationDescription(dto.description),
        sortOrder: dto.sortOrder ?? location.sortOrder,
      },
      include: {
        notes: {
          include:
            campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
        },
      },
    });
  }

  async createCampaignNote(slug: string, dto: CreateCampaignNoteDto) {
    const { campaign, locationId, playerIds } =
      await this.validateCampaignNoteInput(slug, dto);
    const sortOrder = await this.nextCampaignNoteSortOrder(
      campaign.id,
      locationId,
    );

    return this.prisma.campaignNote.create({
      data: {
        campaign: { connect: { id: campaign.id } },
        location: locationId ? { connect: { id: locationId } } : undefined,
        title: dto.title.trim(),
        type: dto.type,
        summary: dto.summary?.trim() ?? "",
        content: dto.content?.trim() ?? "",
        dmPrivate: dto.dmPrivate ?? true,
        keywords: normalizeKeywords(dto.keywords),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        sortOrder,
        players: {
          create: playerIds.map((playerId) => ({
            player: { connect: { id: playerId } },
          })),
        },
        attachments: { create: buildCampaignNoteAttachments(dto) },
        triggers: { create: buildCampaignNoteTriggers(dto) },
      } as unknown as Prisma.CampaignNoteCreateInput,
      include: campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
    });
  }

  async updateCampaignNote(
    slug: string,
    noteId: string,
    dto: CreateCampaignNoteDto,
  ) {
    const { campaign, locationId, playerIds } =
      await this.validateCampaignNoteInput(slug, dto);
    const note = await this.prisma.campaignNote.findFirst({
      where: { id: noteId, campaignId: campaign.id },
      select: { id: true, locationId: true, sortOrder: true },
    });

    if (!note) {
      throw new NotFoundException("Campaign note was not found.");
    }

    const locationChanged = (note.locationId ?? undefined) !== locationId;
    const sortOrder = locationChanged
      ? await this.nextCampaignNoteSortOrder(campaign.id, locationId)
      : (dto.sortOrder ?? note.sortOrder);

    return this.prisma.$transaction(async (tx) => {
      await tx.campaignNotePlayer.deleteMany({ where: { noteId } });
      await tx.campaignNoteAttachment.deleteMany({ where: { noteId } });
      await tx.campaignNoteTrigger.deleteMany({ where: { noteId } });

      return tx.campaignNote.update({
        where: { id: noteId },
        data: {
          location: locationId
            ? { connect: { id: locationId } }
            : { disconnect: true },
          title: dto.title.trim(),
          type: dto.type,
          summary: dto.summary?.trim() ?? "",
          content: dto.content?.trim() ?? "",
          dmPrivate: dto.dmPrivate ?? true,
          keywords: normalizeKeywords(dto.keywords),
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : null,
          sortOrder,
          players: {
            create: playerIds.map((playerId) => ({
              player: { connect: { id: playerId } },
            })),
          },
          attachments: { create: buildCampaignNoteAttachments(dto) },
          triggers: { create: buildCampaignNoteTriggers(dto) },
        } as unknown as Prisma.CampaignNoteUpdateInput,
        include: campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
      });
    });
  }

  async moveCampaignNote(
    slug: string,
    noteId: string,
    direction: "up" | "down",
  ) {
    const campaign = await this.findCampaignOrThrow(slug);
    const current = await this.prisma.campaignNote.findFirst({
      where: { id: noteId, campaignId: campaign.id },
      select: {
        id: true,
        locationId: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    if (!current) {
      throw new NotFoundException("Campaign note was not found.");
    }

    const siblings = await this.prisma.campaignNote.findMany({
      where: {
        campaignId: campaign.id,
        locationId: current.locationId ?? null,
      },
      select: { id: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const currentIndex = siblings.findIndex((note) => note.id === current.id);
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const target = siblings[targetIndex];

    if (currentIndex < 0 || !target) {
      return this.prisma.campaignNote.findUniqueOrThrow({
        where: { id: current.id },
        include: campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
      });
    }

    const reordered = [...siblings];
    reordered[currentIndex] = target;
    reordered[targetIndex] = siblings[currentIndex];

    await this.prisma.$transaction(
      reordered.map((note, index) =>
        this.prisma.campaignNote.update({
          where: { id: note.id },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.prisma.campaignNote.findUniqueOrThrow({
      where: { id: current.id },
      include: campaignNoteRelations as unknown as Prisma.CampaignNoteInclude,
    });
  }

  async searchCreatures(query?: string, environment?: string) {
    const queryFilter = query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            {
              preferredEnvironment: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            { notes: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {};

    return this.prisma.creature.findMany({
      where: {
        ...queryFilter,
        preferredEnvironment: environment
          ? { contains: environment, mode: "insensitive" }
          : undefined,
      },
      orderBy: { name: "asc" },
      take: 25,
    });
  }

  async createCreature(dto: CreateCreatureDto) {
    return this.prisma.creature.create({
      data: {
        ...dto,
        attackInfo: dto.attackInfo as Prisma.InputJsonValue,
        rolls: dto.rolls as Prisma.InputJsonValue,
      },
    });
  }

  async createEncounter(slug: string, dto: CreateEncounterDto) {
    const campaign = await this.findCampaignOrThrow(slug);
    const encounterCreatures = encounterCreatureCreateData(dto);

    return this.prisma.encounter.create({
      data: {
        campaignId: campaign.id,
        name: dto.name,
        status: (dto.status ?? "PENDING") as never,
        mapAssetId: dto.mapAssetId,
        ruleNotes: createEncounterRuleNotes("DRAFT"),
        creatures: {
          create: encounterCreatures as never,
        },
      },
      include: { creatures: { include: { creature: true } } },
    });
  }

  async updateEncounter(slug: string, encounterId: string, dto: CreateEncounterDto) {
    const encounter = await this.findEncounterOrThrow(slug, encounterId);
    if (encounter.status === "ACTIVE") {
      throw new BadRequestException("Active encounters cannot be edited.");
    }

    const encounterCreatures = encounterCreatureCreateData(dto);
    if (!encounterCreatures.length) {
      throw new BadRequestException("Add at least one creature to the encounter.");
    }

    const ruleNotes = resetEncounterRuleNotes(
      normalizeEncounterRuleNotes(encounter.ruleNotes),
    );

    return this.prisma.encounter.update({
      where: { id: encounter.id },
      data: {
        name: dto.name,
        status: (dto.status ?? encounter.status) as never,
        mapAssetId: dto.mapAssetId,
        ruleNotes: ruleNotes as unknown as Prisma.InputJsonValue,
        creatures: {
          deleteMany: {},
          create: encounterCreatures as never,
        },
      },
      include: { creatures: { include: { creature: true } } },
    });
  }

  async startEncounter(slug: string, encounterId: string) {
    const encounter = await this.findEncounterOrThrow(slug, encounterId);
    if (String(encounter.status) !== "PENDING") {
      throw new BadRequestException("Only pending encounters can be started.");
    }

    const activeEncounter = await this.prisma.encounter.findFirst({
      where: {
        campaignId: encounter.campaignId,
        status: "ACTIVE",
        NOT: { id: encounter.id },
      },
    });
    if (activeEncounter) {
      throw new BadRequestException(
        "Archive the active encounter before starting another one.",
      );
    }

    const players = activeEncounterPlayers(encounter.campaign.players);
    const ruleNotes = createEncounterRuleNotes(
      players.length ? "ROLLING" : "IN_PROGRESS",
      normalizeEncounterRuleNotes(encounter.ruleNotes),
    );

    if (!players.length) {
      ruleNotes.turnOrder = [createDmTurnActor()];
      ruleNotes.currentTurnIndex = 0;
    }

    ruleNotes.startedAt = new Date().toISOString();

    return this.prisma.encounter.update({
      where: { id: encounter.id },
      data: {
        status: "ACTIVE",
        ruleNotes: ruleNotes as unknown as Prisma.InputJsonValue,
      },
      include: { creatures: { include: { creature: true } } },
    });
  }

  async updateEncounterStatus(
    slug: string,
    encounterId: string,
    status: EncounterStatus,
  ) {
    if (status === "ACTIVE") {
      return this.startEncounter(slug, encounterId);
    }

    const encounter = await this.findEncounterOrThrow(slug, encounterId);
    if (encounter.status === "ACTIVE" && status !== "ARCHIVED") {
      throw new BadRequestException(
        "Active encounters can only be archived.",
      );
    }

    const ruleNotes = normalizeEncounterRuleNotes(encounter.ruleNotes);
    const nextRuleNotes =
      status === "ARCHIVED"
        ? archiveEncounterRuleNotes(ruleNotes)
        : resetEncounterRuleNotes(ruleNotes);

    return this.prisma.encounter.update({
      where: { id: encounter.id },
      data: {
        status: status as never,
        ruleNotes: nextRuleNotes as unknown as Prisma.InputJsonValue,
      },
      include: { creatures: { include: { creature: true } } },
    });
  }

  async updateEncounterCreature(
    slug: string,
    encounterId: string,
    encounterCreatureId: string,
    dto: UpdateEncounterCreatureDto,
  ) {
    const encounter = await this.findEncounterOrThrow(slug, encounterId);
    const encounterCreature = encounter.creatures.find(
      (entry) => entry.id === encounterCreatureId,
    );
    if (!encounterCreature) {
      throw new NotFoundException("Encounter creature was not found.");
    }

    await this.prisma.encounterCreature.update({
      where: { id: encounterCreatureId },
      data: {
        armorClass: dto.armorClass,
        maxHitPoints: dto.maxHitPoints,
        currentHp: dto.currentHp,
        speed: dto.speed,
        initiative: dto.initiative,
      } as never,
    });

    return this.findEncounterOrThrow(slug, encounterId);
  }

  async beginEncounterCombat(slug: string, encounterId: string) {
    const encounter = await this.findEncounterOrThrow(slug, encounterId);
    if (encounter.status !== "ACTIVE") {
      throw new BadRequestException("Only active encounters can begin combat.");
    }

    const ruleNotes = normalizeEncounterRuleNotes(encounter.ruleNotes);
    ruleNotes.phase = "IN_PROGRESS";
    ruleNotes.turnOrder = buildTurnOrder(
      activeEncounterPlayers(encounter.campaign.players),
      ruleNotes.initiativeRolls,
      encounter.creatures,
    );
    ruleNotes.currentTurnIndex = 0;
    ruleNotes.round = Math.max(1, ruleNotes.round || 1);

    return this.prisma.encounter.update({
      where: { id: encounter.id },
      data: { ruleNotes: ruleNotes as unknown as Prisma.InputJsonValue },
      include: { creatures: { include: { creature: true } } },
    });
  }

  async submitInitiative(
    slug: string,
    encounterId: string,
    playerId: string,
    roll: number,
  ) {
    if (!Number.isInteger(roll) || roll < 0) {
      throw new BadRequestException(
        "Initiative roll must be a positive whole number.",
      );
    }

    const encounter = await this.findEncounterOrThrow(slug, encounterId);
    if (encounter.status !== "ACTIVE") {
      throw new BadRequestException(
        "Initiative can only be submitted for active encounters.",
      );
    }

    const players = activeEncounterPlayers(encounter.campaign.players);
    const player = players.find(
      (candidate) => candidate.id === playerId,
    );
    if (!player) {
      throw new NotFoundException("Player was not found in this campaign.");
    }

    const ruleNotes = normalizeEncounterRuleNotes(encounter.ruleNotes);
    ruleNotes.initiativeRolls[player.id] = {
      playerId: player.id,
      playerName: player.name,
      roll,
    };

    if (
      players.every(
        (candidate) => ruleNotes.initiativeRolls[candidate.id],
      )
    ) {
      ruleNotes.phase = "IN_PROGRESS";
      ruleNotes.turnOrder = buildTurnOrder(
        players,
        ruleNotes.initiativeRolls,
        encounter.creatures,
      );
      ruleNotes.currentTurnIndex = 0;
      ruleNotes.round = Math.max(1, ruleNotes.round || 1);
    }

    return this.prisma.encounter.update({
      where: { id: encounter.id },
      data: { ruleNotes: ruleNotes as unknown as Prisma.InputJsonValue },
      include: { creatures: { include: { creature: true } } },
    });
  }

  async endPlayerTurn(slug: string, encounterId: string, playerId: string) {
    const encounter = await this.findEncounterOrThrow(slug, encounterId);
    return this.advanceEncounterTurn(encounter, {
      type: "PLAYER",
      id: playerId,
    });
  }

  async endDmTurn(slug: string, encounterId: string) {
    const encounter = await this.findEncounterOrThrow(slug, encounterId);
    return this.advanceEncounterTurn(encounter, { type: "DM", id: "dm" });
  }

  async resolveEncounter(slug: string, encounterId: string) {
    return this.updateEncounterStatus(slug, encounterId, "ARCHIVED");
  }

  async setBgm(slug: string, assetId: string) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        currentBgmAssetId: assetId,
        bgmStartedAt: new Date(),
      },
      include: {
        assets: true,
      },
    });
  }

  async createBgmPlaylist(slug: string, name: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    const cleanName = normalizePlaylistName(name);
    const existing = await this.bgmPlaylistDelegate().findFirst({
      where: { campaignId: campaign.id, name: cleanName },
    });
    if (existing) return existing;

    const sortOrder = await this.nextBgmPlaylistSortOrder(campaign.id);
    return this.bgmPlaylistDelegate().create({
      data: {
        campaignId: campaign.id,
        name: cleanName,
        sortOrder,
      },
    });
  }

  async updateBgmPlaylist(slug: string, playlistId: string, name: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    const cleanName = normalizePlaylistName(name);
    await this.findBgmPlaylistOrThrow(campaign.id, playlistId);

    return this.bgmPlaylistDelegate().update({
      where: { id: playlistId },
      data: { name: cleanName },
    });
  }

  async createBgmTracks(
    slug: string,
    playlistName: string | undefined,
    tracks: CreateAssetDto[],
  ) {
    const campaign = await this.findCampaignOrThrow(slug);
    const playlist = await this.getOrCreateBgmPlaylist(
      campaign.id,
      normalizePlaylistName(playlistName || "Unassigned"),
    );
    let sortOrder = await this.nextBgmTrackSortOrder(playlist.id);
    const created = [];

    for (const track of tracks) {
      created.push(
        await this.prisma.asset.create({
          data: {
            campaignId: campaign.id,
            bgmPlaylistId: playlist.id,
            kind: "BGM",
            name: track.name,
            url: track.url,
            mimeType: track.mimeType,
            sortOrder,
          } as unknown as Prisma.AssetUncheckedCreateInput,
        }),
      );
      sortOrder += 1;
    }

    return { playlist, tracks: created };
  }

  async createBgmTrackLink(slug: string, dto: LinkBgmTrackDto) {
    const campaign = await this.findCampaignOrThrow(slug);
    const playlist = await this.getOrCreateBgmPlaylist(
      campaign.id,
      normalizePlaylistName(dto.playlistName || "Unassigned"),
    );
    const url = normalizeTrackUrl(dto.url);

    return this.prisma.asset.create({
      data: {
        campaignId: campaign.id,
        bgmPlaylistId: playlist.id,
        kind: "BGM",
        name: normalizeTrackName(dto.name, url),
        url,
        mimeType: "text/uri-list",
        sortOrder: await this.nextBgmTrackSortOrder(playlist.id),
      } as unknown as Prisma.AssetUncheckedCreateInput,
    });
  }

  async assignBgmTrackToPlaylist(
    slug: string,
    assetId: string,
    playlistId?: string,
  ) {
    const campaign = await this.findCampaignOrThrow(slug);
    const playlist = playlistId
      ? await this.findBgmPlaylistOrThrow(campaign.id, playlistId)
      : await this.getOrCreateBgmPlaylist(campaign.id, "Unassigned");

    await this.findBgmAssetOrThrow(campaign.id, assetId);

    return this.prisma.asset.update({
      where: { id: assetId },
      data: {
        bgmPlaylistId: playlist.id,
        sortOrder: await this.nextBgmTrackSortOrder(playlist.id),
      } as unknown as Prisma.AssetUpdateInput,
    });
  }

  async moveBgmTrack(slug: string, assetId: string, direction: "up" | "down") {
    const campaign = await this.findCampaignOrThrow(slug);
    const track = await this.findBgmAssetOrThrow(campaign.id, assetId);
    const playlistId =
      track.bgmPlaylistId ??
      (await this.getOrCreateBgmPlaylist(campaign.id, "Unassigned")).id;

    if (!track.bgmPlaylistId) {
      await this.prisma.asset.update({
        where: { id: track.id },
        data: {
          bgmPlaylistId: playlistId,
        } as unknown as Prisma.AssetUpdateInput,
      });
    }

    const orderedTracks = (await this.prisma.asset.findMany({
      where: {
        campaignId: campaign.id,
        kind: "BGM",
        bgmPlaylistId: playlistId,
      } as unknown as Prisma.AssetWhereInput,
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ] as unknown as Prisma.AssetOrderByWithRelationInput[],
    })) as unknown as BgmAssetRecord[];
    const currentIndex = orderedTracks.findIndex(
      (entry) => entry.id === track.id,
    );
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= orderedTracks.length
    ) {
      return track;
    }

    const current = orderedTracks[currentIndex];
    const target = orderedTracks[targetIndex];
    await this.prisma.$transaction([
      this.prisma.asset.update({
        where: { id: current.id },
        data: {
          sortOrder: target.sortOrder,
        } as unknown as Prisma.AssetUpdateInput,
      }),
      this.prisma.asset.update({
        where: { id: target.id },
        data: {
          sortOrder: current.sortOrder,
        } as unknown as Prisma.AssetUpdateInput,
      }),
    ]);

    return this.prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  }

  async createSfxTracks(slug: string, tracks: CreateAssetDto[]) {
    const campaign = await this.findCampaignOrThrow(slug);
    let sortOrder = await this.nextSfxTrackSortOrder(campaign.id);
    const created = [];

    for (const track of tracks) {
      created.push(
        await this.prisma.asset.create({
          data: {
            campaignId: campaign.id,
            kind: "SFX",
            name: track.name,
            url: track.url,
            mimeType: track.mimeType,
            sortOrder,
          } as unknown as Prisma.AssetUncheckedCreateInput,
        }),
      );
      sortOrder += 1;
    }

    return { tracks: created };
  }

  async createSfxTrackLink(slug: string, dto: LinkBgmTrackDto) {
    const campaign = await this.findCampaignOrThrow(slug);
    const url = normalizeTrackUrl(dto.url);

    return this.prisma.asset.create({
      data: {
        campaignId: campaign.id,
        kind: "SFX",
        name: normalizeTrackName(dto.name, url),
        url,
        mimeType: "text/uri-list",
        sortOrder: await this.nextSfxTrackSortOrder(campaign.id),
      } as unknown as Prisma.AssetUncheckedCreateInput,
    });
  }

  async moveSfxTrack(slug: string, assetId: string, direction: "up" | "down") {
    const campaign = await this.findCampaignOrThrow(slug);
    const track = await this.findSfxAssetOrThrow(campaign.id, assetId);
    const orderedTracks = (await this.prisma.asset.findMany({
      where: {
        campaignId: campaign.id,
        kind: "SFX",
      } as unknown as Prisma.AssetWhereInput,
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ] as unknown as Prisma.AssetOrderByWithRelationInput[],
    })) as unknown as BgmAssetRecord[];
    const currentIndex = orderedTracks.findIndex(
      (entry) => entry.id === track.id,
    );
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= orderedTracks.length
    ) {
      return track;
    }

    const current = orderedTracks[currentIndex];
    const target = orderedTracks[targetIndex];
    await this.prisma.$transaction([
      this.prisma.asset.update({
        where: { id: current.id },
        data: {
          sortOrder: target.sortOrder,
        } as unknown as Prisma.AssetUpdateInput,
      }),
      this.prisma.asset.update({
        where: { id: target.id },
        data: {
          sortOrder: current.sortOrder,
        } as unknown as Prisma.AssetUpdateInput,
      }),
    ]);

    return this.prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  }

  async setCampaignMap(slug: string, assetId: string) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        currentCampaignMapAssetId: assetId,
        campaignMapSetAt: new Date(),
      },
      include: {
        assets: true,
      },
    });
  }

  async setPlayerMapVisibility(slug: string, visible: boolean) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        playerMapVisible: visible,
      } as unknown as Prisma.CampaignUpdateInput,
      include: { assets: true },
    });
  }

  async setStoryImage(slug: string, assetId: string) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        currentStoryImageAssetId: assetId,
        storyImageVisible: true,
        storyImageSetAt: new Date(),
      } as unknown as Prisma.CampaignUpdateInput,
      include: { assets: true },
    });
  }

  async setStoryImageVisibility(slug: string, visible: boolean) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        storyImageVisible: visible,
      } as unknown as Prisma.CampaignUpdateInput,
      include: { assets: true },
    });
  }

  async createAsset(slug: string, dto: CreateAssetDto) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.asset.create({
      data: {
        campaignId: campaign.id,
        ...dto,
      },
    });
  }

  private bgmPlaylistDelegate() {
    return (this.prisma as unknown as { bgmPlaylist: any }).bgmPlaylist;
  }

  private async ensureDefaultBgmPlaylist(campaignId: string) {
    const playlist = await this.getOrCreateBgmPlaylist(
      campaignId,
      "Unassigned",
    );
    await this.prisma.asset.updateMany({
      where: {
        campaignId,
        kind: "BGM",
        bgmPlaylistId: null,
      } as unknown as Prisma.AssetWhereInput,
      data: {
        bgmPlaylistId: playlist.id,
      } as unknown as Prisma.AssetUpdateManyMutationInput,
    });
    return playlist;
  }

  private async getOrCreateBgmPlaylist(campaignId: string, name: string) {
    const cleanName = normalizePlaylistName(name);
    const existing = await this.bgmPlaylistDelegate().findFirst({
      where: { campaignId, name: cleanName },
    });
    if (existing) return existing;

    return this.bgmPlaylistDelegate().create({
      data: {
        campaignId,
        name: cleanName,
        sortOrder:
          cleanName === "Unassigned"
            ? 0
            : await this.nextBgmPlaylistSortOrder(campaignId),
      },
    });
  }

  private async findBgmPlaylistOrThrow(campaignId: string, playlistId: string) {
    const playlist = await this.bgmPlaylistDelegate().findFirst({
      where: { id: playlistId, campaignId },
    });
    if (!playlist) {
      throw new NotFoundException("BGM playlist was not found.");
    }
    return playlist;
  }

  private async findBgmAssetOrThrow(campaignId: string, assetId: string) {
    const asset = (await this.prisma.asset.findFirst({
      where: { id: assetId, campaignId, kind: "BGM" },
    })) as unknown as BgmAssetRecord | null;
    if (!asset) {
      throw new NotFoundException("BGM track was not found.");
    }
    return asset;
  }

  private async findSfxAssetOrThrow(campaignId: string, assetId: string) {
    const asset = (await this.prisma.asset.findFirst({
      where: { id: assetId, campaignId, kind: "SFX" },
    })) as unknown as BgmAssetRecord | null;
    if (!asset) {
      throw new NotFoundException("SFX track was not found.");
    }
    return asset;
  }

  private async nextBgmPlaylistSortOrder(campaignId: string) {
    const lastPlaylist = await this.bgmPlaylistDelegate().findFirst({
      where: { campaignId },
      orderBy: { sortOrder: "desc" },
    });
    return (lastPlaylist?.sortOrder ?? -1) + 1;
  }

  private async nextBgmTrackSortOrder(playlistId: string) {
    const lastTrack = (await this.prisma.asset.findFirst({
      where: { bgmPlaylistId: playlistId } as unknown as Prisma.AssetWhereInput,
      orderBy: {
        sortOrder: "desc",
      } as unknown as Prisma.AssetOrderByWithRelationInput,
    })) as unknown as BgmAssetRecord | null;
    return (lastTrack?.sortOrder ?? -1) + 1;
  }

  private async nextSfxTrackSortOrder(campaignId: string) {
    const lastTrack = (await this.prisma.asset.findFirst({
      where: { campaignId, kind: "SFX" },
      orderBy: {
        sortOrder: "desc",
      } as unknown as Prisma.AssetOrderByWithRelationInput,
    })) as unknown as BgmAssetRecord | null;
    return (lastTrack?.sortOrder ?? -1) + 1;
  }

  async createMapPin(slug: string, dto: UpsertMapPinDto) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.mapPin.create({
      data: {
        campaignId: campaign.id,
        ...dto,
      },
    });
  }

  private async findCampaignOrThrow(slug: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { slug } });

    if (!campaign) {
      throw new NotFoundException(`Campaign "${slug}" was not found.`);
    }

    return campaign;
  }

  private async getAllowPlayerTheme(campaignId: string) {
    const [row] = await this.prisma.$queryRaw<
      { allowPlayerTheme: boolean }[]
    >`SELECT "allowPlayerTheme" FROM "Campaign" WHERE "id" = ${campaignId}`;

    return row?.allowPlayerTheme ?? false;
  }

  private async findEncounterOrThrow(slug: string, encounterId: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, campaignId: campaign.id },
      include: {
        campaign: { include: { players: true } },
        creatures: { include: { creature: true } },
      },
    });

    if (!encounter) {
      throw new NotFoundException("Encounter was not found.");
    }

    return encounter;
  }

  private async advanceEncounterTurn(
    encounter: Awaited<ReturnType<CampaignsService["findEncounterOrThrow"]>>,
    actor: { type: "PLAYER" | "DM"; id: string },
  ) {
    if (encounter.status !== "ACTIVE") {
      throw new BadRequestException(
        "Only active encounters can advance turns.",
      );
    }

    const ruleNotes = normalizeEncounterRuleNotes(encounter.ruleNotes);
    if (ruleNotes.phase !== "IN_PROGRESS" || !ruleNotes.turnOrder.length) {
      throw new BadRequestException("The turn order is not ready yet.");
    }

    const current =
      ruleNotes.turnOrder[ruleNotes.currentTurnIndex] ?? ruleNotes.turnOrder[0];
    const actorMatches =
      current?.type === actor.type &&
      (current.id === actor.id || (actor.type === "DM" && actor.id === "dm"));
    if (!actorMatches) {
      throw new BadRequestException("It is not that actor's turn.");
    }

    const nextIndex =
      (ruleNotes.currentTurnIndex + 1) % ruleNotes.turnOrder.length;
    ruleNotes.currentTurnIndex = nextIndex;
    if (nextIndex === 0) {
      ruleNotes.round += 1;
    }

    return this.prisma.encounter.update({
      where: { id: encounter.id },
      data: { ruleNotes: ruleNotes as unknown as Prisma.InputJsonValue },
      include: { creatures: { include: { creature: true } } },
    });
  }

  private slugify(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private async validateCampaignNoteInput(
    slug: string,
    dto: CreateCampaignNoteDto,
  ) {
    const campaign = await this.findCampaignOrThrow(slug);
    const locationId = dto.locationId?.trim() || undefined;
    const playerIds = Array.from(new Set(dto.playerIds ?? [])).filter(Boolean);
    const triggerPlayerIds = Array.from(
      new Set(
        (dto.triggers ?? [])
          .map((trigger) => trigger.playerId?.trim())
          .filter((playerId): playerId is string => Boolean(playerId)),
      ),
    );
    const allPlayerIds = Array.from(
      new Set([...playerIds, ...triggerPlayerIds]),
    );

    if (locationId) {
      const location = await this.prisma.campaignLocation.findFirst({
        where: { id: locationId, campaignId: campaign.id },
        select: { id: true },
      });

      if (!location) {
        throw new NotFoundException("Location was not found in this campaign.");
      }
    }

    if (allPlayerIds.length) {
      const playerCount = await this.prisma.player.count({
        where: { id: { in: allPlayerIds }, campaignId: campaign.id },
      });

      if (playerCount !== allPlayerIds.length) {
        throw new BadRequestException(
          "Every attached player must belong to this campaign.",
        );
      }
    }

    return { campaign, locationId, playerIds };
  }

  private async nextCampaignNoteSortOrder(
    campaignId: string,
    locationId?: string,
  ) {
    const latest = await this.prisma.campaignNote.findFirst({
      where: { campaignId, locationId: locationId ?? null },
      select: { sortOrder: true },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    });

    return latest ? latest.sortOrder + 1 : 0;
  }

  private isCampaignNoteType(
    value?: string,
  ): value is CreateCampaignNoteDto["type"] {
    return (
      value === "STORY_POINT" ||
      value === "IMPORTANT_EVENT" ||
      value === "COMBAT_ENCOUNTER" ||
      value === "NONCOMBAT_ENCOUNTER" ||
      value === "LOOT_GEAR" ||
      value === "NPC_NOTE" ||
      value === "LOCATION_DETAIL"
    );
  }
}

function normalizeKeywords(value?: string[]) {
  return Array.from(
    new Set(
      (value ?? [])
        .flatMap((keyword) => keyword.split(","))
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function normalizeLocationDescription(
  value?: Array<{ sortOrder?: number; text?: string }>,
) {
  return (value ?? [])
    .map((description, index) => ({
      sortOrder:
        typeof description.sortOrder === "number"
          ? description.sortOrder
          : index,
      text: description.text?.trim() ?? "",
    }))
    .filter((description) => description.text) as Prisma.InputJsonValue;
}

function buildCampaignNoteAttachments(dto: CreateCampaignNoteDto) {
  return (dto.attachments ?? [])
    .filter((attachment) => attachment.name?.trim())
    .map((attachment) => ({
      type: attachment.type,
      name: attachment.name.trim(),
      details: attachment.details?.trim() ?? "",
      quantity: attachment.quantity,
      metadata: (attachment.metadata ?? {}) as Prisma.InputJsonObject,
    }));
}

function buildCampaignNoteTriggers(dto: CreateCampaignNoteDto) {
  return (dto.triggers ?? [])
    .filter((trigger) => trigger.label?.trim())
    .map((trigger, index) => ({
      type: trigger.type,
      label: trigger.label.trim(),
      description: trigger.description?.trim() ?? "",
      checkType: trigger.checkType?.trim() || undefined,
      difficultyClass: trigger.difficultyClass,
      player: trigger.playerId
        ? { connect: { id: trigger.playerId } }
        : undefined,
      metadata: (trigger.metadata ?? {}) as Prisma.InputJsonObject,
      sortOrder: trigger.sortOrder ?? index,
    }));
}

function isArchivedPlayer(player: unknown) {
  if (!player || typeof player !== "object" || Array.isArray(player)) {
    return false;
  }

  return Boolean((player as { archivedAt?: Date | string | null }).archivedAt);
}

function summarizeSheetChanges(
  previous: {
    stats: Prisma.JsonValue;
    equipment: Prisma.JsonValue;
    money: Prisma.JsonValue;
    rolls: Prisma.JsonValue;
    abilities: Prisma.JsonValue;
  },
  next: UpdateCharacterSheetDto,
) {
  const changedSections = [
    ["Character details", previous.stats, next.stats],
    ["Equipment", previous.equipment, next.equipment],
    ["Money", previous.money, next.money],
    ["Roll log", previous.rolls, next.rolls],
    ["Features and traits", previous.abilities, next.abilities],
  ]
    .filter(([, before, after]) => stableJson(before) !== stableJson(after))
    .map(([label]) => label);

  return changedSections.length
    ? `Updated ${changedSections.join(", ")}`
    : "Saved without field changes";
}

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function createEncounterRuleNotes(
  phase: EncounterRuleNotes["phase"],
  current?: EncounterRuleNotes,
): EncounterRuleNotes {
  return {
    reminders: current?.reminders ?? [
      "Roll initiative at the start of combat.",
      "Track concentration checks when a spellcaster takes damage.",
      "Use advantage or disadvantage before applying flat modifiers.",
    ],
    phase,
    initiativeRolls: current?.initiativeRolls ?? {},
    turnOrder: current?.turnOrder ?? [],
    currentTurnIndex: current?.currentTurnIndex ?? 0,
    round: current?.round ?? 1,
    startedAt: current?.startedAt,
    completedAt: current?.completedAt,
  };
}

function encounterCreatureCreateData(dto: CreateEncounterDto) {
  return dto.creatures?.length
    ? dto.creatures.map((creature) => ({
        creatureId: creature.creatureId,
        nickname: creature.nickname?.trim() || undefined,
        armorClass: creature.armorClass,
        maxHitPoints: creature.maxHitPoints,
        currentHp: creature.currentHp ?? creature.maxHitPoints,
        speed: creature.speed,
        initiative: creature.initiative,
        strength: creature.strength,
        dexterity: creature.dexterity,
        constitution: creature.constitution,
        intelligence: creature.intelligence,
        wisdom: creature.wisdom,
        charisma: creature.charisma,
        keyItems: (creature.keyItems ?? [])
          .map((item) => item.trim())
          .filter(Boolean),
      }))
    : (dto.creatureIds ?? []).map((creatureId) => ({ creatureId }));
}

function activeEncounterPlayers<T extends { archivedAt?: Date | string | null }>(
  players: T[],
) {
  return players.filter((player) => !player.archivedAt);
}

function resetEncounterRuleNotes(
  current: EncounterRuleNotes,
): EncounterRuleNotes {
  return {
    ...createEncounterRuleNotes("DRAFT", current),
    initiativeRolls: {},
    turnOrder: [],
    currentTurnIndex: 0,
    round: 1,
    startedAt: undefined,
    completedAt: undefined,
  };
}

function archiveEncounterRuleNotes(
  current: EncounterRuleNotes,
): EncounterRuleNotes {
  return {
    ...current,
    phase: "RESOLVED",
    completedAt: current.completedAt ?? new Date().toISOString(),
  };
}

function normalizeEncounterRuleNotes(
  value: Prisma.JsonValue,
): EncounterRuleNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEncounterRuleNotes("DRAFT");
  }

  const record = value as Record<string, unknown>;
  return {
    reminders: Array.isArray(record.reminders)
      ? record.reminders.filter(
          (reminder): reminder is string => typeof reminder === "string",
        )
      : createEncounterRuleNotes("DRAFT").reminders,
    phase: isEncounterPhase(record.phase) ? record.phase : "DRAFT",
    initiativeRolls: normalizeInitiativeRolls(record.initiativeRolls),
    turnOrder: normalizeTurnOrder(record.turnOrder),
    currentTurnIndex:
      typeof record.currentTurnIndex === "number" ? record.currentTurnIndex : 0,
    round:
      typeof record.round === "number" && record.round > 0 ? record.round : 1,
    startedAt:
      typeof record.startedAt === "string" ? record.startedAt : undefined,
    completedAt:
      typeof record.completedAt === "string" ? record.completedAt : undefined,
  };
}

function normalizeInitiativeRolls(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const rolls: Record<string, InitiativeRoll> = {};

  for (const [playerId, rawRoll] of Object.entries(value)) {
    if (!rawRoll || typeof rawRoll !== "object" || Array.isArray(rawRoll)) {
      continue;
    }
    const roll = rawRoll as Record<string, unknown>;
    if (typeof roll.roll !== "number" || typeof roll.playerName !== "string") {
      continue;
    }
    rolls[playerId] = {
      playerId,
      playerName: roll.playerName,
      roll: roll.roll,
    };
  }

  return rolls;
}

function normalizeTurnOrder(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((actor): actor is TurnActor => {
    if (!actor || typeof actor !== "object" || Array.isArray(actor))
      return false;
    const record = actor as Record<string, unknown>;
    return (
      (record.type === "PLAYER" || record.type === "DM") &&
      typeof record.id === "string" &&
      typeof record.name === "string" &&
      typeof record.roll === "number"
    );
  });
}

function isEncounterPhase(
  value: unknown,
): value is EncounterRuleNotes["phase"] {
  return (
    value === "DRAFT" ||
    value === "ROLLING" ||
    value === "IN_PROGRESS" ||
    value === "RESOLVED"
  );
}

function buildTurnOrder(
  players: Array<{ id: string; name: string }>,
  rolls: Record<string, InitiativeRoll>,
  creatures: Array<{
    id: string;
    nickname?: string | null;
    initiative?: number | null;
    creature: { name: string };
  }> = [],
) {
  return [
    ...players
      .map((player) => ({
        type: "PLAYER" as const,
        id: player.id,
        name: player.name,
        roll: rolls[player.id]?.roll ?? 0,
      }))
      .sort(
        (left, right) =>
          right.roll - left.roll || left.name.localeCompare(right.name),
      ),
    ...creatures.map((entry) => ({
      type: "DM" as const,
      id: entry.id,
      name: entry.nickname || entry.creature.name,
      roll: entry.initiative ?? 0,
    })),
    createDmTurnActor(),
  ].sort(
    (left, right) =>
      right.roll - left.roll || left.name.localeCompare(right.name),
  );
}

function createDmTurnActor(): TurnActor {
  return {
    type: "DM",
    id: "dm",
    name: "DM",
    roll: 0,
  };
}

function normalizePlaylistName(name: string) {
  return name.trim() || "Unassigned";
}

function normalizeTrackUrl(url: string) {
  return url.trim();
}

function normalizeTrackName(name: string | undefined, url: string) {
  const cleanName = name?.trim();
  if (cleanName) return cleanName;

  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}
