import { ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { chunkDocument } from "../../src/knowledge/application/knowledge-chunker";
import { KnowledgeService } from "../../src/knowledge/application/knowledge.service";
import { LocalEmbeddingService } from "../../src/knowledge/application/local-embedding.service";
import {
  createMockPrismaService,
  MockPrismaService,
} from "../helpers/prisma.mock";

describe("knowledge chunking", () => {
  it("chunks markdown by heading paths", () => {
    const chunks = chunkDocument(
      "rules.md",
      "# Combat\n\nRoll initiative.\n\n## Conditions\n\nA prone creature has special movement limits.",
    );

    expect(chunks).toEqual([
      expect.objectContaining({
        title: "Combat",
        sectionPath: ["Combat"],
        text: "Roll initiative.",
      }),
      expect.objectContaining({
        title: "Conditions",
        sectionPath: ["Combat", "Conditions"],
        text: "A prone creature has special movement limits.",
      }),
    ]);
  });

  it("preserves JSON entity boundaries", () => {
    const chunks = chunkDocument(
      "monsters.json",
      JSON.stringify({
        monsters: [
          { name: "Clockwork Newt", armorClass: 13 },
          { name: "Lantern Imp", hitPoints: 7 },
        ],
      }),
    );

    expect(chunks.map((chunk) => chunk.title)).toEqual([
      "Clockwork Newt",
      "Lantern Imp",
    ]);
  });
});

describe("KnowledgeService", () => {
  let prisma: MockPrismaService;
  let service: KnowledgeService;
  const llm = {
    generate: async () =>
      "Direct Answer\nGenerated from the local model.\n\nSources Used\n- SRD 5.1 (SRD) - Combat",
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new KnowledgeService(
      prisma as never,
      new LocalEmbeddingService(),
      llm as never,
    );
    prisma.campaign.findUnique.mockResolvedValue({
      id: "campaign-1",
      slug: "silver-keep",
    });
  });

  it("imports and indexes a markdown rules document", async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue(null);
    prisma.knowledgeDocument.create.mockResolvedValue({
      id: "doc-1",
      sourceName: "SRD 5.1",
      sourceType: "SRD",
    });
    prisma.knowledgeChunk.create.mockImplementation(async ({ data }) => ({
      id: `chunk-${data.chunkIndex}`,
      ...data,
    }));
    prisma.knowledgeDocument.update.mockImplementation(async ({ data }) => ({
      id: "doc-1",
      ...data,
      chunks: [{ id: "chunk-0" }],
    }));

    const result = await service.importDocument("silver-keep", {
      sourceName: "SRD 5.1",
      sourceType: "SRD",
      originalFileName: "rules.md",
      content: Buffer.from("# Combat\n\nRoll initiative."),
      attributionText:
        "This app includes material from the System Reference Document 5.1.",
    });

    expect(result.status).toBe("INDEXED");
    expect(prisma.knowledgeChunk.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "campaign-1",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Combat",
        sectionPath: ["Combat"],
        indexStatus: "INDEXED",
        embedding: expect.any(Array),
      }),
    });
  });

  it("imports and indexes a homebrew note", async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue(null);
    prisma.knowledgeDocument.create.mockResolvedValue({ id: "doc-1" });
    prisma.knowledgeChunk.create.mockResolvedValue({ id: "chunk-1" });
    prisma.knowledgeDocument.update.mockResolvedValue({
      id: "doc-1",
      status: "INDEXED",
      chunks: [{ id: "chunk-1" }],
    });

    await service.importDocument("silver-keep", {
      sourceName: "Silver Keep Notes",
      sourceType: "Homebrew",
      originalFileName: "notes.md",
      content: Buffer.from("# NPCs\n\nMira trusts the moon gate."),
    });

    expect(prisma.knowledgeChunk.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceType: "Homebrew",
        title: "NPCs",
      }),
    });
  });

  it("prevents duplicate imports by content hash", async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: "doc-existing",
      chunks: [],
    });

    await expect(
      service.importDocument("silver-keep", {
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        originalFileName: "rules.md",
        content: Buffer.from("# Combat\n\nRoll initiative."),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("retrieves relevant chunks and filters by source mode", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Combat",
        sectionPath: ["Combat"],
        pageNumber: null,
        text: "Roll initiative at the start of combat.",
        textPreview: "Roll initiative at the start of combat.",
        embedding: await embedding.embed(
          "Roll initiative at the start of combat.",
        ),
      },
    ]);

    const results = await service.search(
      "silver-keep",
      "initiative",
      "RulesOnly",
    );

    expect(prisma.knowledgeChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: { in: ["SRD", "Open5e", "FiveEBits"] },
        }),
      }),
    );
    expect(results[0]).toEqual(
      expect.objectContaining({
        sourceName: "SRD 5.1",
        relevanceScore: expect.any(Number),
      }),
    );
  });

  it("constructs the DM assistant prompt with retrieved context", () => {
    const prompt = service.buildPrompt("How does initiative work?", [
      {
        id: "chunk-1",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Combat",
        sectionPath: ["Combat"],
        text: "Roll initiative at the start of combat.",
        textPreview: "Roll initiative at the start of combat.",
        relevanceScore: 0.9,
      },
    ]);

    expect(prompt).toContain("Do not invent official D&D rules.");
    expect(prompt).toContain("How does initiative work?");
    expect(prompt).toContain("Roll initiative at the start of combat.");
  });

  it("answers chat questions with the configured local LLM", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Combat",
        sectionPath: ["Combat"],
        pageNumber: null,
        text: "Roll initiative at the start of combat.",
        textPreview: "Roll initiative at the start of combat.",
        embedding: await embedding.embed(
          "Roll initiative at the start of combat.",
        ),
      },
    ]);

    const result = await service.chat(
      "silver-keep",
      "How does initiative work?",
    );

    expect(result.answer).toContain("Generated from the local model.");
    expect(result.llmStatus).toBe("generated");
    expect(result.sources).toHaveLength(1);
  });
});
