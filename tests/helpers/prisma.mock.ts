import { vi } from "vitest";

export type MockPrismaService = ReturnType<typeof createMockPrismaService>;

export function createMockPrismaService() {
  return {
    campaign: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    player: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quest: {
      create: vi.fn(),
    },
    creature: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    encounter: {
      create: vi.fn(),
    },
    asset: {
      create: vi.fn(),
    },
    mapPin: {
      create: vi.fn(),
    },
    campaignLocation: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    campaignNote: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    campaignNotePlayer: {
      create: vi.fn(),
    },
    campaignNoteAttachment: {
      create: vi.fn(),
    },
    characterSheetRevision: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    knowledgeDocument: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    knowledgeChunk: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
}
