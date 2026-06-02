import { vi } from 'vitest';

export type MockPrismaService = ReturnType<typeof createMockPrismaService>;

export function createMockPrismaService() {
  return {
    campaign: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    player: {
      create: vi.fn(),
      update: vi.fn()
    },
    quest: {
      create: vi.fn()
    },
    creature: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    encounter: {
      create: vi.fn()
    },
    asset: {
      create: vi.fn()
    },
    mapPin: {
      create: vi.fn()
    }
  };
}
