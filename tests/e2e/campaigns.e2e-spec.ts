import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CampaignsService } from '../../src/campaigns/application/campaigns.service';
import { CampaignsController } from '../../src/campaigns/interfaces/campaigns.controller';
import { DmAuthGuard } from '../../src/campaigns/interfaces/dm-auth.guard';
import { PrismaService } from '../../src/prisma/prisma.service';

type CampaignRecord = {
  id: string;
  name: string;
  slug: string;
  theme: string;
  dmPasswordHash: string;
  currentBgmAssetId?: string | null;
  bgmStartedAt?: Date | null;
};

describe('Campaigns API e2e', () => {
  let app: INestApplication;
  const campaigns = new Map<string, CampaignRecord>();
  const players: unknown[] = [];

  const prisma = {
    campaign: {
      create: vi.fn(async ({ data, select }) => {
        const campaign = {
          id: `campaign-${campaigns.size + 1}`,
          name: data.name,
          slug: data.slug,
          theme: data.theme,
          dmPasswordHash: data.dmPasswordHash,
          currentBgmAssetId: null,
          bgmStartedAt: null
        };
        campaigns.set(campaign.slug, campaign);
        return selectCampaign(campaign, select);
      }),
      findUnique: vi.fn(async ({ where }) => {
        return campaigns.get(where.slug) ?? [...campaigns.values()].find((campaign) => campaign.id === where.id) ?? null;
      }),
      findUniqueOrThrow: vi.fn(async ({ where, select, include }) => {
        const campaign =
          campaigns.get(where.slug) ?? [...campaigns.values()].find((item) => item.id === where.id);
        if (!campaign) throw new Error('not found');

        if (select) {
          return {
            ...selectCampaign(campaign, select),
            players,
            quests: [],
            mapPins: []
          };
        }

        if (include) {
          return {
            ...campaign,
            players,
            quests: [],
            encounters: [],
            assets: [],
            mapPins: []
          };
        }

        return campaign;
      })
    },
    player: {
      create: vi.fn(async ({ data }) => {
        const player = { id: `player-${players.length + 1}`, ...data };
        players.push(player);
        return player;
      })
    },
    creature: {
      findMany: vi.fn(async () => [
        {
          id: 'ice-wraith',
          name: 'Ice Wraith',
          preferredEnvironment: 'icy tundra',
          hitPoints: 45,
          armorClass: 14
        }
      ])
    }
  };

  beforeEach(async () => {
    campaigns.clear();
    players.splice(0);
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [
        CampaignsService,
        DmAuthGuard,
        {
          provide: PrismaService,
          useValue: prisma
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a campaign, lets a player join, and protects the DM view', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/campaigns')
      .send({ name: 'The Silver Keep', dmPassword: 'secret-pass' })
      .expect(201);

    expect(created.body).toMatchObject({
      name: 'The Silver Keep',
      slug: 'the-silver-keep',
      theme: 'PURPLE_LILAC'
    });

    const storedCampaign = campaigns.get('the-silver-keep');
    expect(storedCampaign).toBeDefined();
    await expect(argon2.verify(storedCampaign!.dmPasswordHash, 'secret-pass')).resolves.toBe(true);

    await request(app.getHttpServer())
      .post('/api/campaigns/the-silver-keep/players')
      .send({ name: 'Mira' })
      .expect(201);

    const playerView = await request(app.getHttpServer()).get('/api/campaigns/the-silver-keep').expect(200);
    expect(playerView.body.players).toHaveLength(1);
    expect(playerView.body.players[0]).toMatchObject({ name: 'Mira' });

    await request(app.getHttpServer()).get('/api/campaigns/the-silver-keep/dm').expect(401);

    const login = await request(app.getHttpServer())
      .post('/api/campaigns/the-silver-keep/dm/login')
      .send({ password: 'secret-pass' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/campaigns/the-silver-keep/dm')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
  });

});

function selectCampaign(campaign: CampaignRecord, select?: Record<string, boolean>) {
  if (!select) return campaign;

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => [key, campaign[key as keyof CampaignRecord]])
  );
}
