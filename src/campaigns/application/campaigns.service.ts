import {
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
  CreateCreatureDto,
  CreateEncounterDto,
  CreatePlayerDto,
  CreateQuestDto,
  UpdateCharacterSheetDto,
  UpsertMapPinDto,
} from "../interfaces/dtos";

const defaultSheet = {
  stats: {
    level: 1,
    className: "",
    species: "",
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  equipment: { items: [] },
  money: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
  rolls: [],
  abilities: [],
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

    return this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
      select: {
        id: true,
        name: true,
        slug: true,
        theme: true,
        currentBgmAssetId: true,
        bgmStartedAt: true,
        players: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
            stats: true,
            equipment: true,
            money: true,
            rolls: true,
            abilities: true,
          },
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
      },
    });
  }

  async getDmCampaign(slug: string) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
      include: {
        players: true,
        quests: { include: { loot: true, subQuests: true } },
        encounters: { include: { creatures: { include: { creature: true } } } },
        assets: true,
        mapPins: true,
      },
    });
  }

  async createPlayer(slug: string, dto: CreatePlayerDto) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.player.create({
      data: {
        campaignId: campaign.id,
        name: dto.name,
        iconUrl: dto.iconUrl,
        ...defaultSheet,
      },
    });
  }

  async updateCharacterSheet(playerId: string, dto: UpdateCharacterSheetDto) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: {
        stats: dto.stats as Prisma.InputJsonValue,
        equipment: dto.equipment as Prisma.InputJsonValue,
        money: dto.money as Prisma.InputJsonValue,
        rolls: dto.rolls as Prisma.InputJsonValue,
        abilities: dto.abilities as Prisma.InputJsonValue,
      },
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

  async searchCreatures(query?: string, environment?: string) {
    return this.prisma.creature.findMany({
      where: {
        name: query ? { contains: query, mode: "insensitive" } : undefined,
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

    return this.prisma.encounter.create({
      data: {
        campaignId: campaign.id,
        name: dto.name,
        mapAssetId: dto.mapAssetId,
        ruleNotes: {
          reminders: [
            "Roll initiative at the start of combat.",
            "Track concentration checks when a spellcaster takes damage.",
            "Use advantage or disadvantage before applying flat modifiers.",
          ],
        },
        creatures: {
          create: (dto.creatureIds ?? []).map((creatureId) => ({ creatureId })),
        },
      },
      include: { creatures: { include: { creature: true } } },
    });
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

  async createAsset(slug: string, dto: CreateAssetDto) {
    const campaign = await this.findCampaignOrThrow(slug);

    return this.prisma.asset.create({
      data: {
        campaignId: campaign.id,
        ...dto,
      },
    });
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

  private slugify(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
}
