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

  it("chunks SRD race text into named race trait sections", () => {
    const chunks = chunkDocument(
      "SRD_CC_v5.1.pdf",
      [
        "Races",
        "Racial Traits",
        "Dwarf",
        "Dwarf Traits",
        "Your dwarf character has an assortment of inborn abilities.",
      ].join("\n"),
    );

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Dwarf Traits",
          sectionPath: ["Races", "Dwarf", "Dwarf Traits"],
          text: expect.stringContaining("inborn abilities"),
        }),
      ]),
    );
  });

  it("chunks two-column SRD spell lists by class and spell level", () => {
    const chunks = chunkDocument(
      "SRD_CC_v5.1.pdf",
      [
        "Spell Lists                                                 Druid Spells",
        "Bard Spells                                                 Cantrips (0 Level)",
        "Cantrips (0 Level)                                          Druidcraft",
        "Dancing Lights                                              Guidance",
        "Light                                                       1st Level",
        "1st Level                                                   Animal Friendship",
        "Animal Friendship                                           Cure Wounds",
      ].join("\n"),
    );

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Cantrips (0 Level)",
          sectionPath: ["Spell Lists", "Druid Spells", "Cantrips (0 Level)"],
          text: expect.stringContaining("Druidcraft"),
        }),
        expect.objectContaining({
          title: "1st Level",
          sectionPath: ["Spell Lists", "Druid Spells", "1st Level"],
          text: expect.stringContaining("Animal Friendship"),
        }),
      ]),
    );
  });
});

describe("KnowledgeService", () => {
  let prisma: MockPrismaService;
  let service: KnowledgeService;
  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new KnowledgeService(
      prisma as never,
      new LocalEmbeddingService(),
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

  it("can require whole-word matches for exact reference terms", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-rat",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Rat",
        sectionPath: ["Monsters", "Rat"],
        pageNumber: 378,
        text: "Rat. Tiny beast, unaligned.",
        textPreview: "Rat. Tiny beast, unaligned.",
        embedding: await embedding.embed("tiny beast animal"),
      },
      {
        id: "chunk-aberration",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Aberration",
        sectionPath: ["Monster Types", "Aberration"],
        pageNumber: 254,
        text: "Aberrations are utterly alien beings.",
        textPreview: "Aberrations are utterly alien beings.",
        embedding: await embedding.embed("rat"),
      },
    ]);

    const results = await service.search(
      "silver-keep",
      "rat",
      "RulesOnly",
      "SRD",
      undefined,
      { wholeWords: true },
    );

    expect(results.map((result) => result.id)).toEqual(["chunk-rat"]);
  });

  it("retrieves class feature chunks by exact terms when vector similarity is weak", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-class",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Ranger",
        sectionPath: ["Classes", "Ranger"],
        pageNumber: 32,
        text: "Ranger Class Features include hit points, proficiencies, and equipment.",
        textPreview:
          "Ranger Class Features include hit points, proficiencies, and equipment.",
        embedding: await embedding.embed("unrelated downtime crafting rules"),
      },
    ]);

    const results = await service.search(
      "silver-keep",
      "What class features do rangers get?",
      "RulesOnly",
      "SRD",
    );

    expect(results[0]).toEqual(
      expect.objectContaining({
        title: "Ranger",
        pageNumber: 32,
      }),
    );
  });

  it("prefers SRD weapon table chunks over monster weapon attack text", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-monster",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Goblin",
        sectionPath: ["Monsters", "Goblin"],
        pageNumber: 160,
        text: "Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target.",
        textPreview:
          "Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target.",
        embedding: await embedding.embed("weapon attack monster scimitar"),
      },
      {
        id: "chunk-weapons",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Weapons",
        sectionPath: ["Equipment", "Weapons"],
        pageNumber: 70,
        text: "Simple Melee Weapons\nClub\nDagger\nGreatclub\nSimple Ranged Weapons\nCrossbow, light\nDart\nShortbow\nMartial Melee Weapons\nBattleaxe\nLongsword\nWarhammer\nMartial Ranged Weapons\nLongbow\nNet\nWeapon Properties",
        textPreview:
          "Simple Melee Weapons Club Dagger Greatclub Simple Ranged Weapons Crossbow, light Dart Shortbow",
        embedding: await embedding.embed("unrelated lodging expenses"),
      },
    ]);

    const results = await service.search(
      "silver-keep",
      "List the weapons available to players",
      "RulesOnly",
      "SRD",
    );

    expect(results[0]).toEqual(
      expect.objectContaining({
        id: "chunk-weapons",
        title: "Weapons",
      }),
    );
  });

  it("includes retrieved weapon names in a deterministic rulebook answer", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-weapons",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Weapons",
        sectionPath: ["Equipment", "Weapons"],
        pageNumber: 70,
        text: "Simple Melee Weapons\nClub\nDagger\nGreatclub\nMartial Ranged Weapons\nLongbow\nNet",
        textPreview:
          "Simple Melee Weapons Club Dagger Greatclub Martial Ranged Weapons Longbow Net",
        embedding: await embedding.embed("weapon table"),
      },
    ]);

    const result = await service.chat(
      "silver-keep",
      "List the weapons available to players",
    );

    expect(result.answer).toContain("Quick Reference");
    expect(result.answer).toContain(
      "Weapons found: Club, Dagger, Greatclub, Longbow, Net.",
    );
  });

  it("includes retrieved playable race names in a deterministic rulebook answer", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-races",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Races",
        sectionPath: ["Races"],
        pageNumber: 3,
        text: "Dwarf Traits\nElf Traits\nHalfling Traits\nHuman Traits\nDragonborn Traits\nGnome Traits\nHalf-Elf Traits\nHalf-Orc Traits\nTiefling Traits",
        textPreview:
          "Dwarf Traits Elf Traits Halfling Traits Human Traits Dragonborn Traits",
        embedding: await embedding.embed("race traits"),
      },
    ]);

    const result = await service.chat(
      "silver-keep",
      "What races can players choose?",
    );

    expect(result.answer).toContain("Quick Reference");
    expect(result.answer).toContain(
      "Playable races found: Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc, Tiefling.",
    );
  });

  it("prefers the Druid spell list for class spell questions", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-monster-druid",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Druid",
        sectionPath: ["Monsters", "Druid"],
        pageNumber: 399,
        text: "Spellcasting. The druid is a 4th-level spellcaster. Its spellcasting ability is Wisdom.",
        textPreview:
          "Spellcasting. The druid is a 4th-level spellcaster. Its spellcasting ability is Wisdom.",
        embedding: await embedding.embed("druid spellcasting monster"),
      },
      {
        id: "chunk-druid-spells",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Spell Lists",
        sectionPath: ["Spell Lists"],
        pageNumber: 107,
        text: "Druid Spells\nCantrips (0 Level)\nDruidcraft\nGuidance\nMending\n1st Level\nAnimal Friendship\nCure Wounds\nEntangle\n2nd Level\nBarkskin\nMoonbeam",
        textPreview:
          "Druid Spells Cantrips Druidcraft Guidance Mending 1st Level Animal Friendship Cure Wounds Entangle",
        embedding: await embedding.embed("unrelated character options"),
      },
    ]);

    const results = await service.search(
      "silver-keep",
      "What spells can Druids cast?",
      "RulesOnly",
      "SRD",
    );

    expect(results[0]).toEqual(
      expect.objectContaining({
        id: "chunk-druid-spells",
        pageNumber: 107,
      }),
    );
  });

  it("includes the Druid spell list in a deterministic rulebook answer", async () => {
    const embedding = new LocalEmbeddingService();
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        id: "chunk-druid-spells",
        documentId: "doc-1",
        sourceName: "SRD 5.1",
        sourceType: "SRD",
        title: "Spell Lists",
        sectionPath: ["Spell Lists"],
        pageNumber: 107,
        text: "Druid Spells\nCantrips (0 Level)\nDruidcraft\nGuidance\nMending\n1st Level\nAnimal Friendship\nCure Wounds\nEntangle",
        textPreview:
          "Druid Spells Cantrips Druidcraft Guidance Mending 1st Level Animal Friendship Cure Wounds Entangle",
        embedding: await embedding.embed("druid spell list"),
      },
    ]);

    const result = await service.chat(
      "silver-keep",
      "What spells can Druids cast?",
    );

    expect(result.answer).toContain("Quick Reference");
    expect(result.answer).toContain("Druid spells found:");
    expect(result.answer).toContain("Cantrips: Druidcraft, Guidance");
    expect(result.answer).toContain("1st Level: Animal Friendship");
    expect(result.answer).toContain("9th Level: Foresight");
  });

  it("answers rulebook questions directly from retrieved sources", async () => {
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

    expect(result.answer).toContain("Rulebook Answer");
    expect(result.answer).toContain("Roll initiative at the start of combat.");
    expect(result.answerMode).toBe("retrieval");
    expect(result.sources).toHaveLength(1);
  });
});
