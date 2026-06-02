import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import { DmAuthGuard } from '../../src/campaigns/interfaces/dm-auth.guard';
import { createMockPrismaService, MockPrismaService } from '../helpers/prisma.mock';

function contextFor(headers: Record<string, string>, params: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, params })
    })
  } as ExecutionContext;
}

describe('DmAuthGuard', () => {
  let prisma: MockPrismaService;
  let guard: DmAuthGuard;
  let jwt: JwtService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    guard = new DmAuthGuard(prisma as never);
    jwt = new JwtService({ secret: process.env.JWT_SECRET });
  });

  it('rejects requests without a bearer token', async () => {
    await expect(guard.canActivate(contextFor({}, { slug: 'silver-keep' }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('rejects a valid token for a different campaign slug', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-2' });
    const token = jwt.sign({ campaignId: 'campaign-1', role: 'DM' });

    await expect(
      guard.canActivate(contextFor({ authorization: `Bearer ${token}` }, { slug: 'silver-keep' }))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows a DM token that matches the route campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1' });
    const token = jwt.sign({ campaignId: 'campaign-1', role: 'DM' });

    await expect(
      guard.canActivate(contextFor({ authorization: `Bearer ${token}` }, { slug: 'silver-keep' }))
    ).resolves.toBe(true);
  });
});

