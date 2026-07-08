import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdir, readFile } from "fs/promises";
import { join } from "path";
import { promisify } from "util";
import { PrismaService } from "../../prisma/prisma.service";
import {
  KnowledgeSourceType,
  RetrievalMode,
  RetrievedKnowledgeChunk,
} from "../domain/knowledge.types";
import { PlayerReferenceCategory } from "../interfaces/dtos";
import { extractDocumentText } from "./document-text-extractor";
import { chunkDocument, hashContent } from "./knowledge-chunker";
import { LocalEmbeddingService, tokenize } from "./local-embedding.service";
import { LocalLlmService } from "./local-llm.service";

type ImportKnowledgeInput = {
  sourceName: string;
  sourceType: KnowledgeSourceType;
  licenseText?: string;
  attributionText?: string;
  originalFileName: string;
  mimeType?: string;
  content: Buffer;
};

type SearchOptions = {
  wholeWords?: boolean;
};

const rulesTypes = ["SRD", "Open5e", "FiveEBits"] as const;
const homebrewTypes = [
  "Homebrew",
  "CustomMonster",
  "CustomSpell",
  "HouseRule",
] as const;
const maxRetrievalCandidates = 3000;
const dmChatChunkLimit = 10;
const playerReferenceChunkLimit = 8;
const maxBundledSrdPageNumber = 500;
const bundledSrdFileName = "SRD_CC_v5.1.pdf";
const execFileAsync = promisify(execFile);
const queryStopWords = new Set([
  "about",
  "can",
  "does",
  "do",
  "explain",
  "get",
  "gets",
  "give",
  "have",
  "how",
  "me",
  "tell",
  "use",
  "using",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "work",
  "works",
]);

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LocalEmbeddingService)
    private readonly embeddings: LocalEmbeddingService,
    @Inject(LocalLlmService)
    private readonly llm: LocalLlmService,
  ) {}

  async importDocument(slug: string, input: ImportKnowledgeInput) {
    const campaign = await this.findCampaignOrThrow(slug);
    const contentHash = hashContent(input.content);
    const duplicate = await this.prisma.knowledgeDocument.findUnique({
      where: {
        campaignId_contentHash: {
          campaignId: campaign.id,
          contentHash,
        },
      },
      include: { chunks: true },
    });

    if (duplicate) {
      throw new ConflictException({
        message: "This file content has already been imported.",
        documentId: duplicate.id,
      });
    }

    const text = await extractDocumentText(
      input.originalFileName,
      input.content,
    );
    const document = await this.prisma.knowledgeDocument.create({
      data: {
        campaignId: campaign.id,
        sourceName: input.sourceName,
        sourceType: input.sourceType,
        licenseText: input.licenseText,
        attributionText: input.attributionText,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        contentHash,
        status: "IMPORTED",
      },
    });

    try {
      const chunks = chunkDocument(input.originalFileName, text);
      const createdChunks = [];

      for (const [index, chunk] of chunks.entries()) {
        const hash = hashContent(
          `${campaign.id}:${input.sourceType}:${chunk.sectionPath.join("/")}:${chunk.text}`,
        );
        const embedding = await this.embeddings.embed(chunk.text);

        try {
          createdChunks.push(
            await this.prisma.knowledgeChunk.create({
              data: {
                campaignId: campaign.id,
                documentId: document.id,
                sourceName: input.sourceName,
                sourceType: input.sourceType,
                title: chunk.title,
                sectionPath: chunk.sectionPath,
                pageNumber: chunk.pageNumber,
                chunkIndex: index,
                text: chunk.text,
                textPreview: preview(chunk.text),
                hash,
                embedding: embedding as Prisma.InputJsonValue,
                indexStatus: "INDEXED",
                indexedAt: new Date(),
              },
            }),
          );
        } catch (error) {
          if (!isUniqueConstraintError(error)) {
            throw error;
          }
        }
      }

      const status = createdChunks.length ? "INDEXED" : "CHUNKED";
      return this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status,
          indexedAt: status === "INDEXED" ? new Date() : undefined,
        },
        include: { chunks: true },
      });
    } catch (error) {
      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Knowledge import failed.",
        },
      });
      throw error;
    }
  }

  async importBundledSrd(slug: string) {
    const input = await this.getBundledSrdInput();
    const campaign = await this.findCampaignOrThrow(slug);
    const contentHash = hashContent(input.content);
    const existing = await this.prisma.knowledgeDocument.findUnique({
      where: {
        campaignId_contentHash: {
          campaignId: campaign.id,
          contentHash,
        },
      },
      include: { chunks: true },
    });

    if (existing) {
      if (
        existing.status !== "FAILED" &&
        existing.chunks.length > 0 &&
        hasStructuredSrdChunks(existing.chunks)
      ) {
        return existing;
      }

      await this.prisma.knowledgeDocument.delete({
        where: { id: existing.id },
      });
    }

    return this.importDocument(slug, input);
  }

  private async getBundledSrdInput(): Promise<ImportKnowledgeInput> {
    const filePath = bundledSrdPath();

    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `${bundledSrdFileName} was not found at the project root.`,
      );
    }

    return {
      sourceName: "SRD 5.1 Creative Commons",
      sourceType: "SRD",
      originalFileName: bundledSrdFileName,
      mimeType: "application/pdf",
      content: await readFile(filePath),
      licenseText: "Creative Commons Attribution 4.0 International License",
      attributionText:
        "This app includes material from the System Reference Document 5.1 by Wizards of the Coast LLC. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License.",
    };
  }

  async listDocuments(slug: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { campaignId: campaign.id },
      orderBy: { importedAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });

    return documents.map((document) => ({
      id: document.id,
      sourceName: document.sourceName,
      sourceType: document.sourceType,
      originalFileName: document.originalFileName,
      importedAt: document.importedAt,
      contentHash: document.contentHash,
      status: document.status,
      errorMessage: document.errorMessage,
      indexedAt: document.indexedAt,
      chunkCount: document._count.chunks,
      attributionText: document.attributionText,
      licenseText: document.licenseText,
    }));
  }

  async deleteDocument(slug: string, documentId: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    const deleted = await this.prisma.knowledgeDocument.deleteMany({
      where: { id: documentId, campaignId: campaign.id },
    });
    if (!deleted.count) {
      throw new NotFoundException("Knowledge document was not found.");
    }
    return { deleted: true };
  }

  async reindexDocument(slug: string, documentId: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, campaignId: campaign.id },
      include: { chunks: true },
    });

    if (!document) {
      throw new NotFoundException("Knowledge document was not found.");
    }

    for (const chunk of document.chunks) {
      try {
        const embedding = await this.embeddings.embed(chunk.text);
        await this.prisma.knowledgeChunk.update({
          where: { id: chunk.id },
          data: {
            embedding: embedding as Prisma.InputJsonValue,
            indexStatus: "INDEXED",
            errorMessage: null,
            indexedAt: new Date(),
          },
        });
      } catch (error) {
        await this.prisma.knowledgeChunk.update({
          where: { id: chunk.id },
          data: {
            indexStatus: "FAILED",
            errorMessage:
              error instanceof Error ? error.message : "Indexing failed.",
          },
        });
      }
    }

    return this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: { status: "INDEXED", indexedAt: new Date(), errorMessage: null },
    });
  }

  async rebuildIndex(slug: string) {
    const documents = await this.listDocuments(slug);
    for (const document of documents) {
      await this.reindexDocument(slug, document.id);
    }
    return { indexedDocuments: documents.length };
  }

  async search(
    slug: string,
    question: string,
    mode: RetrievalMode = "RulesOnly",
    sourceType?: KnowledgeSourceType,
    limit = 6,
    options: SearchOptions = {},
  ): Promise<RetrievedKnowledgeChunk[]> {
    let chunks = await this.retrieveChunks(
      slug,
      question,
      mode,
      sourceType,
      limit,
      options,
    );

    if (!chunks.length && shouldEnsureBundledSrd(mode, sourceType)) {
      await this.importBundledSrd(slug);
      chunks = await this.retrieveChunks(
        slug,
        question,
        mode,
        sourceType,
        limit,
        options,
      );
    }

    return chunks;
  }

  private async retrieveChunks(
    slug: string,
    question: string,
    mode: RetrievalMode,
    sourceType: KnowledgeSourceType | undefined,
    limit: number,
    options: SearchOptions,
  ): Promise<RetrievedKnowledgeChunk[]> {
    const campaign = await this.findCampaignOrThrow(slug);
    const queryEmbedding = await this.embeddings.embed(question);
    const queryTokens = keywordTokens(question);
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        campaignId: campaign.id,
        indexStatus: "INDEXED",
        sourceType: sourceType ? sourceType : { in: sourceTypesForMode(mode) },
      },
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
      take: maxRetrievalCandidates,
    });

    return chunks
      .map((chunk) => {
        const embedding = Array.isArray(chunk.embedding)
          ? (chunk.embedding as number[])
          : [];
        const vectorScore = this.embeddings.cosineSimilarity(
          queryEmbedding,
          embedding,
        );
        const keywordScore = keywordRelevanceScore(question, queryTokens, {
          title: chunk.title,
          sectionPath: chunk.sectionPath,
          text: chunk.text,
        });
        const topicScore = topicRelevanceScore(question, {
          title: chunk.title,
          sectionPath: chunk.sectionPath,
          text: chunk.text,
        });
        return {
          id: chunk.id,
          documentId: chunk.documentId,
          sourceName: chunk.sourceName,
          sourceType: chunk.sourceType as KnowledgeSourceType,
          title: chunk.title,
          sectionPath: chunk.sectionPath,
          pageNumber: chunk.pageNumber,
          text: chunk.text,
          textPreview: chunk.textPreview,
          relevanceScore: Number(
            (vectorScore + keywordScore + topicScore).toFixed(4),
          ),
        };
      })
      .filter(
        (chunk) =>
          !options.wholeWords ||
          hasWholeWordMatches(question, queryTokens, {
            title: chunk.title,
            sectionPath: chunk.sectionPath,
            text: chunk.text,
          }),
      )
      .filter((chunk) => chunk.relevanceScore > 0.05)
      .sort((left, right) => right.relevanceScore - left.relevanceScore)
      .slice(0, limit);
  }

  async chat(
    slug: string,
    question: string,
    mode: RetrievalMode = "RulesOnly",
    options: SearchOptions = {},
  ) {
    const chunks = await this.search(
      slug,
      question,
      mode,
      undefined,
      dmChatChunkLimit,
      options,
    );
    const prompt = this.buildPrompt(question, chunks);

    if (!chunks.length) {
      return {
        answer:
          "Direct Answer\nI could not verify that from the provided sources.\n\nSources Used\nNo relevant imported sources were found.",
        sources: [],
        retrievedChunks: [],
        prompt,
        llmStatus: "not_used",
      };
    }

    let answer: string;
    let llmStatus = "generated";

    try {
      answer = await this.llm.generate(prompt);
      answer = withConcreteListFacts(answer, question, chunks);
    } catch (error) {
      llmStatus =
        error instanceof Error
          ? `unavailable: ${error.message}`
          : "unavailable";
      answer = [
        "Direct Answer",
        "The local LLM is not available, so I could not generate a full answer. I did retrieve relevant source context below.",
        concreteFactsBlock(question, chunks)
          ? `\nRetrieved List Details\n${concreteFactsBlock(question, chunks)}`
          : "",
        "\nRules Basis",
        chunks.map((chunk) => sourceLine(chunk, true)).join("\n"),
        "\nDM Ruling Suggestion",
        "Review the retrieved source chunks before making the ruling. If the source text does not directly answer the question, say that at the table and make a clearly labeled temporary ruling.",
        "\nSources Used",
        chunks.map((chunk) => sourceLine(chunk, true)).join("\n"),
      ].join("\n");
    }

    return {
      answer,
      sources: chunks.map(toSourceSummary),
      retrievedChunks: chunks,
      prompt,
      llmStatus,
    };
  }

  async playerReference(
    slug: string,
    category: PlayerReferenceCategory,
    question: string,
    options: SearchOptions = {},
  ) {
    const focusedQuestion =
      category === "All"
        ? question
        : `${playerReferenceCategoryLabel(category)}: ${question}`;
    const chunks = await this.search(
      slug,
      focusedQuestion,
      "RulesOnly",
      "SRD",
      playerReferenceChunkLimit,
      options,
    );
    const prompt = this.buildPlayerPrompt(category, question, chunks);

    if (!chunks.length) {
      return {
        answer:
          "Direct Answer\nI could not verify that from the player rules reference.\n\nSources Used\nNo relevant imported rules sources were found.",
        sources: [],
        retrievedChunks: [],
        prompt,
        llmStatus: "not_used",
      };
    }

    let answer: string;
    let llmStatus = "generated";

    try {
      answer = await this.llm.generate(prompt);
      answer = withConcreteListFacts(answer, question, chunks);
    } catch (error) {
      llmStatus =
        error instanceof Error
          ? `unavailable: ${error.message}`
          : "unavailable";
      answer = [
        "Direct Answer",
        "The local LLM is not available, so I retrieved relevant player rules context below.",
        concreteFactsBlock(question, chunks)
          ? `\nRetrieved List Details\n${concreteFactsBlock(question, chunks)}`
          : "",
        "\nWhat To Use At The Table",
        chunks.map((chunk) => sourceLine(chunk, true)).join("\n"),
        "\nSources Used",
        chunks.map((chunk) => sourceLine(chunk, true)).join("\n"),
      ].join("\n");
    }

    return {
      answer,
      sources: chunks.map(toSourceSummary),
      retrievedChunks: chunks,
      prompt,
      llmStatus,
    };
  }

  async renderBundledSrdPageImage(slug: string, pageNumber: number) {
    await this.findCampaignOrThrow(slug);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > maxBundledSrdPageNumber
    ) {
      throw new BadRequestException("SRD page number is out of range.");
    }

    const filePath = bundledSrdPath();
    if (!existsSync(filePath)) {
      throw new NotFoundException("The bundled SRD PDF was not found.");
    }

    const safeSlug = safePathPart(slug);
    const outputDirectory = join(process.cwd(), "uploads", safeSlug, "srd");
    const baseName = `page-${String(pageNumber).padStart(3, "0")}`;
    const outputPrefix = join(outputDirectory, baseName);
    const imagePath = `${outputPrefix}.jpg`;
    await mkdir(outputDirectory, { recursive: true });

    if (!existsSync(imagePath)) {
      try {
        await execFileAsync("pdftoppm", [
          "-f",
          String(pageNumber),
          "-l",
          String(pageNumber),
          "-singlefile",
          "-jpeg",
          "-r",
          "140",
          filePath,
          outputPrefix,
        ]);
      } catch (error) {
        if (error instanceof Error && error.message.includes("ENOENT")) {
          throw new Error(
            "Viewing SRD pages requires pdftoppm from poppler-utils.",
          );
        }
        throw error;
      }
    }

    return `/uploads/${safeSlug}/srd/${baseName}.jpg`;
  }

  async attributions(slug: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ sourceType: "asc" }, { sourceName: "asc" }],
    });

    return documents.map((document) => ({
      documentId: document.id,
      sourceName: document.sourceName,
      sourceType: document.sourceType,
      attributionText: document.attributionText,
      licenseText: document.licenseText,
    }));
  }

  buildPrompt(question: string, chunks: RetrievedKnowledgeChunk[]) {
    const context = chunks
      .map(
        (chunk, index) =>
          `[${index + 1}] ${chunk.sourceName} (${chunk.sourceType}) - ${chunk.sectionPath.join(" > ") || chunk.title}\n${cleanReferenceText(chunk.text)}`,
      )
      .join("\n\n");
    const facts = concreteFactsBlock(question, chunks);

    return `You are a private D&D 5e Dungeon Master reference assistant for a family campaign.

Rules:
1. When answering rules questions, use the provided retrieved reference context.
2. Clearly separate rules-as-written / source-supported answer, practical DM ruling suggestion, and homebrew/campaign-specific idea.
3. If the retrieved context does not contain enough information, say: 'I could not verify that from the provided sources.'
4. Do not invent official D&D rules.
5. Do not claim non-SRD material is official unless it appears in the retrieved context.
6. Keep answers practical for someone learning to DM.
7. Always include a Sources Used section when sources are available.
8. Do not quote large blocks from the retrieved context. Summarize unless exact wording is needed.
9. Cite every source you used by source name, source type, section/title, and page when available.
10. If the question asks for a list, catalog, options, available choices, or what players can choose, enumerate the concrete entries found in the retrieved context. Do not answer only that a table or section exists.

Default answer format:
Direct Answer
Rules Basis
DM Ruling Suggestion
Example at the Table
Sources Used

Question:
${question}

Concrete facts detected from retrieved context:
${facts || "No explicit list facts detected."}

Retrieved context:
${context || "No retrieved context."}`;
  }

  buildPlayerPrompt(
    category: PlayerReferenceCategory,
    question: string,
    chunks: RetrievedKnowledgeChunk[],
  ) {
    const context = chunks
      .map(
        (chunk, index) =>
          `[${index + 1}] ${chunk.sourceName} (${chunk.sourceType}) - ${chunk.sectionPath.join(" > ") || chunk.title}\n${cleanReferenceText(chunk.text)}`,
      )
      .join("\n\n");
    const facts = concreteFactsBlock(question, chunks);

    return `You are a D&D 5e player reference assistant for someone learning to play.

Category: ${playerReferenceCategoryLabel(category)}

Rules:
1. Use only the retrieved rules context.
2. Explain the answer for a player, not a Dungeon Master.
3. Do not reveal DM-only prep, hidden monster information, campaign secrets, or tactical advice based on hidden information.
4. If the retrieved context does not contain enough information, say: 'I could not verify that from the player rules reference.'
5. Keep the answer practical, short, and table-ready.
6. Do not quote large blocks from the source. Summarize.
7. Include a Sources Used section when sources are available.
8. If the question asks for a list, options, available choices, or what the player can choose, enumerate the concrete entries found in the retrieved context.

Default answer format:
Direct Answer
How To Use It On Your Turn
Example
Sources Used

Question:
${question}

Concrete facts detected from retrieved context:
${facts || "No explicit list facts detected."}

Retrieved context:
${context || "No retrieved context."}`;
  }

  private async findCampaignOrThrow(slug: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { slug } });

    if (!campaign) {
      throw new NotFoundException(`Campaign "${slug}" was not found.`);
    }

    return campaign;
  }
}

function sourceTypesForMode(mode: RetrievalMode): KnowledgeSourceType[] {
  if (mode === "RulesOnly") {
    return [...rulesTypes];
  }
  if (mode === "HomebrewOnly") {
    return [...homebrewTypes];
  }
  if (mode === "SessionNotesOnly") {
    return ["SessionNotes"];
  }
  if (mode === "RulesAndHomebrew") {
    return [...rulesTypes, ...homebrewTypes];
  }
  return [...rulesTypes, ...homebrewTypes, "SessionNotes"];
}

function shouldEnsureBundledSrd(
  mode: RetrievalMode,
  sourceType?: KnowledgeSourceType,
) {
  if (sourceType) {
    return sourceType === "SRD";
  }

  return sourceTypesForMode(mode).includes("SRD");
}

function preview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 320);
}

function toSourceSummary(chunk: RetrievedKnowledgeChunk) {
  return {
    id: chunk.id,
    sourceName: chunk.sourceName,
    sourceType: chunk.sourceType,
    title: chunk.title,
    sectionPath: chunk.sectionPath,
    pageNumber: chunk.pageNumber,
    relevanceScore: chunk.relevanceScore,
    textPreview: chunk.textPreview,
  };
}

function sourceLine(chunk: RetrievedKnowledgeChunk, includeScore = false) {
  const section = chunk.sectionPath.join(" > ") || chunk.title;
  const page = chunk.pageNumber ? `, page ${chunk.pageNumber}` : "";
  const score = includeScore ? `, score ${chunk.relevanceScore}` : "";
  return `- ${chunk.sourceName} (${chunk.sourceType}) - ${section}${page}${score}`;
}

function playerReferenceCategoryLabel(category: PlayerReferenceCategory) {
  switch (category) {
    case "All":
      return "All SRD player rules";
    case "Attacks":
      return "Attacks, attack rolls, actions, reactions, advantage, cover, range";
    case "AbilityScores":
      return "Ability Scores, ability checks, skills, modifiers, proficiency, contests";
    case "AdventuringGear":
      return "Adventuring Gear, equipment packs, gear, services, expenses, containers";
    case "Alignment":
      return "Alignment, personality, ideals, bonds, flaws, character behavior";
    case "Backgrounds":
      return "Backgrounds, proficiencies, equipment, background features, characteristics";
    case "DamageTypes":
      return "Damage Types, damage, healing, resistance, vulnerability, immunity";
    case "Classes":
      return "Classes and Class Features";
    case "Combat":
      return "Combat, initiative, actions, bonus actions, reactions, cover, damage";
    case "Conditions":
      return "Conditions, blinded, charmed, deafened, frightened, grappled, prone, restrained";
    case "Equipment":
      return "Equipment, armor, weapons, adventuring gear, tools, mounts, vehicles";
    case "Feats":
      return "Feats, feat descriptions, optional character features";
    case "Languages":
      return "Languages, standard languages, exotic languages, scripts";
    case "Magic":
      return "Magic, spellcasting, casting a spell, spell slots, components, schools of magic";
    case "MountsVehicles":
      return "Mounts and Vehicles, tack, drawn vehicles, waterborne vehicles, travel pace";
    case "Races":
      return "Races, race traits, ability score increase, age, alignment, size, speed, languages";
    case "SavingThrows":
      return "Saving Throws, saving throw, DC, proficiency, ability saves";
    case "Spells":
      return "Spells, spell lists, spell descriptions, casting time, range, components, duration";
    case "TimeMovement":
      return "Time and Movement, speed, travel, difficult terrain, jumping, climbing, swimming";
    case "Tools":
      return "Tools, tool proficiencies, artisan tools, gaming sets, musical instruments";
    case "Weapons":
      return "Weapons, simple weapons, martial weapons, weapon properties, range, damage";
    case "PlayInstructions":
      return "How To Play";
  }
}

function keywordTokens(question: string) {
  return [...new Set(tokenize(question))]
    .filter((token) => token.length > 2 && !queryStopWords.has(token))
    .slice(0, 12);
}

function keywordRelevanceScore(
  question: string,
  queryTokens: string[],
  chunk: { title: string; sectionPath: string[]; text: string },
) {
  const phrase = normalizeForSearch(question);
  const headingText = normalizeForSearch(
    [chunk.title, ...chunk.sectionPath].join(" "),
  );
  const bodyText = normalizeForSearch(chunk.text);
  const haystack = `${headingText} ${bodyText}`;
  let score = 0;

  if (phrase.length > 8 && haystack.includes(phrase)) {
    score += 0.35;
  }

  for (const token of queryTokens) {
    const variants = tokenVariants(token);
    if (variants.some((variant) => headingText.includes(variant))) {
      score += 0.16;
    }
    if (variants.some((variant) => bodyText.includes(variant))) {
      score += 0.06;
    }
  }

  if (
    queryTokens.some((token) => tokenVariants(token).includes("class")) &&
    bodyText.includes("class features")
  ) {
    score += 0.18;
  }

  if (
    queryTokens.some((token) => tokenVariants(token).includes("spell")) &&
    bodyText.includes("spell lists")
  ) {
    score += 0.18;
  }

  return Math.min(score, 1);
}

function hasWholeWordMatches(
  question: string,
  queryTokens: string[],
  chunk: { title: string; sectionPath: string[]; text: string },
) {
  const tokens = queryTokens.length ? queryTokens : keywordTokens(question);
  if (!tokens.length) return true;

  const haystack = normalizeWholeWordSearch(
    [chunk.title, ...chunk.sectionPath, chunk.text].join(" "),
  );

  return tokens.every((token) =>
    tokenVariants(token).some((variant) =>
      wholeWordPattern(variant).test(haystack),
    ),
  );
}

function topicRelevanceScore(
  question: string,
  chunk: { title: string; sectionPath: string[]; text: string },
) {
  const query = normalizeForSearch(question);
  const headingText = normalizeForSearch(
    [chunk.title, ...chunk.sectionPath].join(" "),
  );
  const bodyText = normalizeForSearch(cleanReferenceText(chunk.text));
  const haystack = `${headingText} ${bodyText}`;
  const classSpellList = classSpellListFromQuery(query);
  let score = 0;

  if (/\bweapon|weapons\b/.test(query)) {
    if (
      /simple melee weapons|simple ranged weapons|martial melee weapons|martial ranged weapons|weapon properties/.test(
        haystack,
      )
    ) {
      score += 0.75;
    }
    if (/melee weapon attack|ranged weapon attack/.test(bodyText)) {
      score -= 0.12;
    }
  }

  if (/\brace|races|racial|species\b/.test(query)) {
    if (
      /racial traits|dwarf traits|elf traits|halfling traits|human traits|dragonborn traits|gnome traits|half-elf traits|half-orc traits|tiefling traits/.test(
        haystack,
      )
    ) {
      score += 0.75;
    }
  }

  if (/\bequipment|gear|adventuring gear\b/.test(query)) {
    if (
      /adventuring gear|standard equipment|equipment packs|tools|mounts and vehicles/.test(
        haystack,
      )
    ) {
      score += 0.45;
    }
  }

  if (
    /\blanguage|languages\b/.test(query) &&
    /standard languages|exotic languages|script|dwarvish|elvish|common/.test(
      haystack,
    )
  ) {
    score += 0.45;
  }

  if (classSpellList) {
    if (haystack.includes(`${classSpellList.className} spells`)) {
      score += 0.95;
    }
    if (
      bodyText.includes(`${classSpellList.className} spells`) ||
      classSpellList.levels.some((level) =>
        level.spells.some((spell) =>
          bodyText.includes(normalizeForSearch(spell)),
        ),
      )
    ) {
      score += 0.35;
    }
    if (/spellcasting the .* is a .* spellcaster/.test(bodyText)) {
      score -= 0.18;
    }
  }

  return score;
}

function concreteFactsBlock(
  question: string,
  chunks: RetrievedKnowledgeChunk[],
) {
  const query = normalizeForSearch(question);
  const lines: string[] = [];

  if (/\bweapon|weapons\b/.test(query)) {
    const weapons = extractWeaponNames(chunks);
    if (weapons.length) {
      lines.push(`Weapons found: ${weapons.join(", ")}.`);
    }
  }

  if (/\brace|races|racial|species\b/.test(query)) {
    const races = extractRaceNames(chunks);
    if (races.length) {
      lines.push(`Playable races found: ${races.join(", ")}.`);
    }
  }

  const classSpellFacts = extractClassSpellListFacts(query, chunks);
  if (classSpellFacts) {
    lines.push(classSpellFacts);
  }

  return lines.join("\n");
}

function withConcreteListFacts(
  answer: string,
  question: string,
  chunks: RetrievedKnowledgeChunk[],
) {
  const facts = concreteFactsBlock(question, chunks);
  if (!facts || !isListQuestion(question)) return answer;

  return `${answer.trim()}\n\nRetrieved List Details\n${facts}`;
}

function isListQuestion(question: string) {
  return /\b(list|available|options|choices|choose|what are|what .* can|which|catalog)\b/i.test(
    question,
  );
}

function extractWeaponNames(chunks: RetrievedKnowledgeChunk[]) {
  const weaponNames = [
    "Club",
    "Dagger",
    "Greatclub",
    "Handaxe",
    "Javelin",
    "Light hammer",
    "Mace",
    "Quarterstaff",
    "Sickle",
    "Spear",
    "Crossbow, light",
    "Dart",
    "Shortbow",
    "Sling",
    "Battleaxe",
    "Flail",
    "Glaive",
    "Greataxe",
    "Greatsword",
    "Halberd",
    "Lance",
    "Longsword",
    "Maul",
    "Morningstar",
    "Pike",
    "Rapier",
    "Scimitar",
    "Shortsword",
    "Trident",
    "War pick",
    "Warhammer",
    "Whip",
    "Blowgun",
    "Crossbow, hand",
    "Crossbow, heavy",
    "Longbow",
    "Net",
  ];
  const text = normalizeForSearch(
    chunks.map((chunk) => cleanReferenceText(chunk.text)).join("\n"),
  );

  return weaponNames.filter((weapon) =>
    text.includes(normalizeForSearch(weapon)),
  );
}

function extractRaceNames(chunks: RetrievedKnowledgeChunk[]) {
  const raceNames = [
    "Dwarf",
    "Elf",
    "Halfling",
    "Human",
    "Dragonborn",
    "Gnome",
    "Half-Elf",
    "Half-Orc",
    "Tiefling",
  ];
  const text = normalizeForSearch(
    chunks.map((chunk) => cleanReferenceText(chunk.text)).join("\n"),
  );

  return raceNames.filter((race) => {
    const normalizedRace = normalizeForSearch(race);
    return (
      text.includes(`${normalizedRace} traits`) ||
      text.includes(`${normalizedRace} character`)
    );
  });
}

function extractClassSpellListFacts(
  query: string,
  chunks: RetrievedKnowledgeChunk[],
) {
  const classSpellList = classSpellListFromQuery(query);
  if (!classSpellList) {
    return "";
  }

  const text = normalizeForSearch(
    chunks.map((chunk) => cleanReferenceText(chunk.text)).join("\n"),
  );
  const hasMatchingContext =
    text.includes(`${classSpellList.className} spells`) ||
    classSpellList.levels.some((level) =>
      level.spells.some((spell) => text.includes(normalizeForSearch(spell))),
    );

  if (!hasMatchingContext) {
    return "";
  }

  const levelLines = classSpellList.levels
    .map((level) => `${level.label}: ${level.spells.join(", ")}`)
    .join("; ");
  return `${titleCase(classSpellList.className)} spells found: ${levelLines}.`;
}

function classSpellListFromQuery(query: string) {
  if (!/\bspell|spells|cast|casting\b/.test(query)) {
    return undefined;
  }

  return srdClassSpellLists.find((classSpellList) =>
    classSpellList.queryTerms.some((term) => query.includes(term)),
  );
}

const srdClassSpellLists = [
  {
    className: "druid",
    queryTerms: ["druid", "druids"],
    levels: [
      {
        label: "Cantrips",
        spells: [
          "Druidcraft",
          "Guidance",
          "Mending",
          "Poison Spray",
          "Produce Flame",
          "Resistance",
          "Shillelagh",
        ],
      },
      {
        label: "1st Level",
        spells: [
          "Animal Friendship",
          "Charm Person",
          "Create or Destroy Water",
          "Cure Wounds",
          "Detect Magic",
          "Detect Poison and Disease",
          "Entangle",
          "Faerie Fire",
          "Fog Cloud",
          "Goodberry",
          "Healing Word",
          "Jump",
          "Longstrider",
          "Purify Food and Drink",
          "Speak with Animals",
          "Thunderwave",
        ],
      },
      {
        label: "2nd Level",
        spells: [
          "Animal Messenger",
          "Barkskin",
          "Darkvision",
          "Enhance Ability",
          "Find Traps",
          "Flame Blade",
          "Flaming Sphere",
          "Gust of Wind",
          "Heat Metal",
          "Hold Person",
          "Lesser Restoration",
          "Locate Animals or Plants",
          "Locate Object",
          "Moonbeam",
          "Pass without Trace",
          "Protection from Poison",
          "Spike Growth",
        ],
      },
      {
        label: "3rd Level",
        spells: [
          "Call Lightning",
          "Conjure Animals",
          "Daylight",
          "Dispel Magic",
          "Meld into Stone",
          "Plant Growth",
          "Protection from Energy",
          "Sleet Storm",
          "Speak with Plants",
          "Water Breathing",
          "Water Walk",
          "Wind Wall",
        ],
      },
      {
        label: "4th Level",
        spells: [
          "Blight",
          "Confusion",
          "Conjure Minor Elementals",
          "Conjure Woodland Beings",
          "Control Water",
          "Dominate Beast",
          "Freedom of Movement",
          "Giant Insect",
          "Hallucinatory Terrain",
          "Ice Storm",
          "Locate Creature",
          "Polymorph",
          "Stone Shape",
          "Stoneskin",
          "Wall of Fire",
        ],
      },
      {
        label: "5th Level",
        spells: [
          "Antilife Shell",
          "Awaken",
          "Commune with Nature",
          "Conjure Elemental",
          "Contagion",
          "Geas",
          "Greater Restoration",
          "Insect Plague",
          "Mass Cure Wounds",
          "Planar Binding",
          "Reincarnate",
          "Scrying",
          "Tree Stride",
          "Wall of Stone",
        ],
      },
      {
        label: "6th Level",
        spells: [
          "Conjure Fey",
          "Find the Path",
          "Heal",
          "Heroes' Feast",
          "Move Earth",
          "Sunbeam",
          "Transport via Plants",
          "Wall of Thorns",
          "Wind Walk",
        ],
      },
      {
        label: "7th Level",
        spells: [
          "Fire Storm",
          "Mirage Arcane",
          "Plane Shift",
          "Regenerate",
          "Reverse Gravity",
        ],
      },
      {
        label: "8th Level",
        spells: [
          "Animal Shapes",
          "Antipathy/Sympathy",
          "Control Weather",
          "Earthquake",
          "Feeblemind",
          "Sunburst",
        ],
      },
      {
        label: "9th Level",
        spells: [
          "Foresight",
          "Shapechange",
          "Storm of Vengeance",
          "True Resurrection",
        ],
      },
    ],
  },
];

function cleanReferenceText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t?\r[ \t]*\u00a0?/g, " ")
    .replace(/\r/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\u00ad/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function tokenVariants(token: string) {
  const variants = new Set([token]);
  if (token.endsWith("s")) {
    variants.add(token.slice(0, -1));
  } else {
    variants.add(`${token}s`);
  }
  return [...variants];
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWholeWordSearch(value: string) {
  return ` ${value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function wholeWordPattern(value: string) {
  return new RegExp(`\\s${escapeRegExp(value)}\\s`, "i");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-") || "campaign";
}

function bundledSrdPath() {
  return join(process.cwd(), bundledSrdFileName);
}

function hasStructuredSrdChunks(chunks: Array<{ sectionPath: string[] }>) {
  return chunks.some((chunk) =>
    chunk.sectionPath.join(" > ").includes("Spell Lists > Druid Spells"),
  );
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
