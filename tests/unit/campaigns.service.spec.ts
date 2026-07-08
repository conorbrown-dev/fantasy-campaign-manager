import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it } from 'vitest';
import { CampaignsService } from '../../src/campaigns/application/campaigns.service';
import { createMockPrismaService, MockPrismaService } from '../helpers/prisma.mock';

describe('CampaignsService', () => {
  let prisma: MockPrismaService;
  let service: CampaignsService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CampaignsService(prisma as never);
  });

  it('creates a campaign with a slug, default theme, and hashed DM password', async () => {
    prisma.campaign.create.mockResolvedValue({
      id: 'campaign-1',
      name: 'The Silver Keep',
      slug: 'the-silver-keep',
      theme: 'PURPLE_LILAC'
    });

    const result = await service.createCampaign({
      name: 'The Silver Keep',
      dmPassword: 'secret-pass'
    });

    expect(result.slug).toBe('the-silver-keep');
    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'The Silver Keep',
          slug: 'the-silver-keep',
          theme: 'PURPLE_LILAC',
          dmPasswordHash: expect.any(String)
        })
      })
    );

    const created = prisma.campaign.create.mock.calls[0][0].data;
    await expect(argon2.verify(created.dmPasswordHash, 'secret-pass')).resolves.toBe(true);
  });

  it('creates a player with a D&D 5e starter sheet', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      slug: 'silver-keep',
      dmPasswordHash: 'hash'
    });
    prisma.player.findFirst.mockResolvedValue(null);
    prisma.player.create.mockResolvedValue({ id: 'player-1', name: 'Mira' });

    await service.createPlayer('silver-keep', { name: 'Mira', accessCode: '1234' });

    expect(prisma.player.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: 'campaign-1',
        name: 'Mira',
        accessCodeHash: expect.any(String),
        stats: expect.objectContaining({
          level: 1,
          strength: 10,
          charisma: 10,
          identity: expect.objectContaining({
            characterName: ''
          }),
          skills: expect.objectContaining({
            perception: expect.any(Object)
          })
        }),
        equipment: expect.objectContaining({ items: [] }),
        money: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
        rolls: [],
        abilities: []
      })
    });

    const created = prisma.player.create.mock.calls[0][0].data;
    await expect(argon2.verify(created.accessCodeHash, '1234')).resolves.toBe(true);
  });

  it('returns an existing player when the access code matches', async () => {
    const accessCodeHash = await argon2.hash('2468');
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      slug: 'silver-keep',
      dmPasswordHash: 'hash'
    });
    prisma.player.findFirst.mockResolvedValue({
      id: 'player-1',
      name: 'Mira',
      accessCodeHash
    });

    const result = await service.createPlayer('silver-keep', {
      name: 'Mira',
      accessCode: '2468'
    });

    expect(result).toMatchObject({ id: 'player-1', name: 'Mira' });
    expect(prisma.player.create).not.toHaveBeenCalled();
  });

  it('claims a legacy player without an access code', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      slug: 'silver-keep',
      dmPasswordHash: 'hash'
    });
    prisma.player.findFirst.mockResolvedValue({
      id: 'player-1',
      name: 'Mira',
      accessCodeHash: null,
      iconUrl: null
    });
    prisma.player.update.mockResolvedValue({ id: 'player-1', name: 'Mira' });

    await service.createPlayer('silver-keep', {
      name: 'Mira',
      accessCode: '2468'
    });

    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 'player-1' },
      data: expect.objectContaining({
        accessCodeHash: expect.any(String)
      })
    });
  });

  it('updates a character sheet payload', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'player-1',
      stats: { level: 2 },
      equipment: { items: [] },
      money: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
      rolls: [],
      abilities: []
    });
    prisma.player.update.mockResolvedValue({ id: 'player-1', name: 'Mira' });

    const sheet = {
      stats: { level: 3, className: 'Wizard', species: 'Elf', strength: 8, dexterity: 14 },
      equipment: { items: ['spellbook', 'wand'] },
      money: { copper: 0, silver: 5, electrum: 0, gold: 20, platinum: 1 },
      rolls: [{ label: 'Arcana', value: 18 }],
      abilities: ['Mage Hand', 'Shield']
    };

    await service.updateCharacterSheet('player-1', sheet);

    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 'player-1' },
      data: sheet
    });
    expect(prisma.characterSheetRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        playerId: 'player-1',
        summary: expect.stringContaining('Updated'),
        stats: sheet.stats,
        equipment: sheet.equipment,
        money: sheet.money,
        rolls: sheet.rolls,
        abilities: sheet.abilities
      })
    });
  });

  it('searches creatures by name and preferred environment', async () => {
    prisma.creature.findMany.mockResolvedValue([]);

    await service.searchCreatures('wraith', 'icy');

    expect(prisma.creature.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: 'wraith', mode: 'insensitive' } },
          { preferredEnvironment: { contains: 'wraith', mode: 'insensitive' } },
          { notes: { contains: 'wraith', mode: 'insensitive' } }
        ],
        preferredEnvironment: { contains: 'icy', mode: 'insensitive' }
      },
      orderBy: { name: 'asc' },
      take: 25
    });
  });
});
