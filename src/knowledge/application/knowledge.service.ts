import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { PrismaService } from "../../prisma/prisma.service";
import {
  KnowledgeSourceType,
  RetrievalMode,
  RetrievedKnowledgeChunk,
} from "../domain/knowledge.types";
import { extractDocumentText } from "./document-text-extractor";
import { chunkDocument, hashContent } from "./knowledge-chunker";
import { LocalEmbeddingService } from "./local-embedding.service";
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

const rulesTypes = ["SRD", "Open5e", "FiveEBits"] as const;
const homebrewTypes = [
  "Homebrew",
  "CustomMonster",
  "CustomSpell",
  "HouseRule",
] as const;

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
      if (existing.status !== "FAILED" && existing.chunks.length > 0) {
        return existing;
      }

      await this.prisma.knowledgeDocument.delete({
        where: { id: existing.id },
      });
    }

    return this.importDocument(slug, input);
  }

  private async getBundledSrdInput(): Promise<ImportKnowledgeInput> {
    const fileName = "SRD_CC_v5.1.pdf";
    const filePath = join(process.cwd(), fileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `${fileName} was not found at the project root.`,
      );
    }

    return {
      sourceName: "SRD 5.1 Creative Commons",
      sourceType: "SRD",
      originalFileName: fileName,
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
  ): Promise<RetrievedKnowledgeChunk[]> {
    let chunks = await this.retrieveChunks(
      slug,
      question,
      mode,
      sourceType,
      limit,
    );

    if (!chunks.length && shouldEnsureBundledSrd(mode, sourceType)) {
      await this.importBundledSrd(slug);
      chunks = await this.retrieveChunks(
        slug,
        question,
        mode,
        sourceType,
        limit,
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
  ): Promise<RetrievedKnowledgeChunk[]> {
    const campaign = await this.findCampaignOrThrow(slug);
    const queryEmbedding = await this.embeddings.embed(question);
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        campaignId: campaign.id,
        indexStatus: "INDEXED",
        sourceType: sourceType ? sourceType : { in: sourceTypesForMode(mode) },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return chunks
      .map((chunk) => {
        const embedding = Array.isArray(chunk.embedding)
          ? (chunk.embedding as number[])
          : [];
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
            this.embeddings
              .cosineSimilarity(queryEmbedding, embedding)
              .toFixed(4),
          ),
        };
      })
      .filter((chunk) => chunk.relevanceScore > 0.05)
      .sort((left, right) => right.relevanceScore - left.relevanceScore)
      .slice(0, limit);
  }

  async chat(
    slug: string,
    question: string,
    mode: RetrievalMode = "RulesOnly",
  ) {
    const chunks = await this.search(slug, question, mode, undefined, 5);
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
    } catch (error) {
      llmStatus =
        error instanceof Error
          ? `unavailable: ${error.message}`
          : "unavailable";
      answer = [
        "Direct Answer",
        "The local LLM is not available, so I could not generate a full answer. I did retrieve relevant source context below.",
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
          `[${index + 1}] ${chunk.sourceName} (${chunk.sourceType}) - ${chunk.sectionPath.join(" > ") || chunk.title}\n${chunk.text}`,
      )
      .join("\n\n");

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

Default answer format:
Direct Answer
Rules Basis
DM Ruling Suggestion
Example at the Table
Sources Used

Question:
${question}

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

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
