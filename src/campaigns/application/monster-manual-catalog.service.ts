import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, mkdir, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { PrismaService } from "../../prisma/prisma.service";
import { hashContent } from "../../knowledge/application/knowledge-chunker";

const execFileAsync = promisify(execFile);
const maxCatalogResults = 50;
const minimumBundledSrdMonsterEntries = 50;

type ImportMonsterManualInput = {
  title?: string;
  originalFileName: string;
  mimeType?: string;
  filePath: string;
  duplicateBehavior?: "throw" | "return";
  minimumEntryCount?: number;
};

type MonsterCatalogSearchOptions = {
  wholeWords?: boolean;
};

type ParsedMonsterEntry = {
  name: string;
  sizeType: string;
  sourceText: string;
  armorClass?: number;
  hitPoints?: number;
  challengeRating?: string;
};

type MonsterStart = {
  name: string;
  typeLine: string;
  typeIndex: number;
  nameIndex: number;
};

@Injectable()
export class MonsterManualCatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async importBundledSrd(slug: string) {
    const fileName = "SRD_CC_v5.1.pdf";
    const filePath = join(process.cwd(), fileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `${fileName} was not found at the project root.`,
      );
    }

    return this.importManual(slug, {
      title: "SRD 5.1 Monster Reference",
      originalFileName: fileName,
      mimeType: "application/pdf",
      filePath,
      duplicateBehavior: "return",
      minimumEntryCount: minimumBundledSrdMonsterEntries,
    });
  }

  async importManual(slug: string, input: ImportMonsterManualInput) {
    const campaign = await this.findCampaignOrThrow(slug);
    const content = await readFile(input.filePath);
    const contentHash = hashContent(content);
    const duplicate = await this.prisma.monsterManualDocument.findUnique({
      where: {
        campaignId_contentHash: {
          campaignId: campaign.id,
          contentHash,
        },
      },
    });

    const minimumEntryCount = input.minimumEntryCount ?? 1;
    if (duplicate && duplicate.entryCount >= minimumEntryCount) {
      if (input.duplicateBehavior === "return") {
        return this.prisma.monsterManualDocument.findUniqueOrThrow({
          where: { id: duplicate.id },
          include: { entries: true },
        });
      }

      throw new ConflictException({
        message: "This monster manual PDF has already been imported.",
        documentId: duplicate.id,
      });
    }

    if (duplicate) {
      await this.prisma.monsterManualDocument.delete({
        where: { id: duplicate.id },
      });
    }

    const pageCount = await this.getPdfPageCount(input.filePath);
    const document = await this.prisma.monsterManualDocument.create({
      data: {
        campaignId: campaign.id,
        title: input.title?.trim() || input.originalFileName,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        contentHash,
        pageCount,
        status: "PROCESSING",
      },
    });

    try {
      const entries = [];
      const outputDirectory = join(
        process.cwd(),
        "uploads",
        safePathPart(slug),
        "monster-manuals",
        document.id,
      );
      await mkdir(outputDirectory, { recursive: true });

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const pageText = await this.extractPageText(input.filePath, pageNumber);
        const parsedEntries = parseMonsterEntries(pageText);
        if (!parsedEntries.length) continue;

        const pageImageUrl = await this.renderPageImage(
          input.filePath,
          outputDirectory,
          slug,
          document.id,
          pageNumber,
        );

        for (const parsed of parsedEntries) {
          const creature = await this.upsertCreature(
            campaign.id,
            parsed,
            pageImageUrl,
          );
          entries.push(
            await this.prisma.monsterCatalogEntry.create({
              data: {
                campaignId: campaign.id,
                documentId: document.id,
                creatureId: creature.id,
                name: parsed.name,
                pageNumber,
                pageImageUrl,
                sizeType: parsed.sizeType,
                armorClass: parsed.armorClass,
                hitPoints: parsed.hitPoints,
                challengeRating: parsed.challengeRating,
                sourceText: parsed.sourceText,
                searchText: buildSearchText(parsed),
              },
            }),
          );
        }
      }

      return this.prisma.monsterManualDocument.update({
        where: { id: document.id },
        data: {
          status: "IMPORTED",
          entryCount: entries.length,
          errorMessage: null,
        },
        include: { entries: true },
      });
    } catch (error) {
      await this.prisma.monsterManualDocument.update({
        where: { id: document.id },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Monster manual import failed.",
        },
      });
      throw error;
    }
  }

  async search(
    slug: string,
    query = "",
    options: MonsterCatalogSearchOptions = {},
  ) {
    const campaign = await this.findCampaignOrThrow(slug);
    const normalizedQuery = normalizeText(query).toLowerCase();
    const tokens = normalizedQuery
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2);

    const entries = await this.prisma.monsterCatalogEntry.findMany({
      where: {
        campaignId: campaign.id,
        ...(tokens.length
          ? {
              OR: [
                { name: { contains: normalizedQuery, mode: "insensitive" } },
                ...tokens.map((token) => ({
                  searchText: { contains: token, mode: "insensitive" as const },
                })),
              ],
            }
          : {}),
      },
      include: { document: true },
      orderBy: [{ name: "asc" }, { pageNumber: "asc" }],
      take: tokens.length ? 250 : maxCatalogResults,
    });

    return entries
      .map((entry) => ({
        id: entry.id,
        creatureId: entry.creatureId,
        name: entry.name,
        pageNumber: entry.pageNumber,
        pageImageUrl: entry.pageImageUrl,
        sizeType: entry.sizeType,
        armorClass: entry.armorClass,
        hitPoints: entry.hitPoints,
        challengeRating: entry.challengeRating,
        sourceName: entry.document.title,
        textPreview: preview(entry.sourceText),
        relevanceScore: scoreEntry(entry, normalizedQuery, tokens, options),
      }))
      .filter((entry) => !tokens.length || entry.relevanceScore > 0)
      .sort((left, right) => right.relevanceScore - left.relevanceScore)
      .slice(0, maxCatalogResults);
  }

  async listDocuments(slug: string) {
    const campaign = await this.findCampaignOrThrow(slug);
    return this.prisma.monsterManualDocument.findMany({
      where: { campaignId: campaign.id },
      orderBy: { importedAt: "desc" },
    });
  }

  private async upsertCreature(
    campaignId: string,
    entry: ParsedMonsterEntry,
    imageUrl: string,
  ) {
    const creatureId = `manual-${hashContent(`${campaignId}:${entry.name}`)
      .slice(0, 18)
      .toLowerCase()}`;

    return this.prisma.creature.upsert({
      where: { id: creatureId },
      update: {
        imageUrl,
        armorClass: entry.armorClass,
        hitPoints: entry.hitPoints,
        preferredEnvironment: inferEnvironmentText(entry.sourceText),
        attackInfo: inferAttackInfo(entry.sourceText) as Prisma.InputJsonValue,
        rolls: inferRolls(entry.sourceText) as Prisma.InputJsonValue,
        notes: preview(entry.sourceText, 1800),
      },
      create: {
        id: creatureId,
        name: entry.name,
        imageUrl,
        preferredEnvironment: inferEnvironmentText(entry.sourceText),
        armorClass: entry.armorClass,
        hitPoints: entry.hitPoints,
        attackInfo: inferAttackInfo(entry.sourceText) as Prisma.InputJsonValue,
        rolls: inferRolls(entry.sourceText) as Prisma.InputJsonValue,
        notes: preview(entry.sourceText, 1800),
      },
    });
  }

  private async getPdfPageCount(filePath: string) {
    try {
      const { stdout } = await execFileAsync("pdfinfo", [filePath]);
      const match = /^Pages:\s+(\d+)$/m.exec(stdout);
      if (!match) {
        throw new Error("Could not determine PDF page count.");
      }
      return Number(match[1]);
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new Error(
          "Monster manual import requires pdfinfo from poppler-utils.",
        );
      }
      throw error;
    }
  }

  private async extractPageText(filePath: string, pageNumber: number) {
    try {
      const { stdout } = await execFileAsync(
        "pdftotext",
        [
          "-raw",
          "-enc",
          "UTF-8",
          "-f",
          String(pageNumber),
          "-l",
          String(pageNumber),
          filePath,
          "-",
        ],
        { maxBuffer: 8 * 1024 * 1024 },
      );
      const text = normalizeText(stdout);
      return hasStatBlockMarkers(text)
        ? text
        : await this.extractPageTextWithOcr(filePath, pageNumber);
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new Error(
          "Monster manual import requires pdftotext from poppler-utils.",
        );
      }
      throw error;
    }
  }

  private async extractPageTextWithOcr(filePath: string, pageNumber: number) {
    const directory = await mkdtemp(join(tmpdir(), "monster-manual-ocr-"));
    const outputPrefix = join(directory, "page");
    const imagePath = `${outputPrefix}.png`;

    try {
      await execFileAsync("pdftoppm", [
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-singlefile",
        "-png",
        "-r",
        "200",
        filePath,
        outputPrefix,
      ]);

      const { stdout } = await execFileAsync(
        "tesseract",
        [imagePath, "stdout", "-l", "eng"],
        { maxBuffer: 8 * 1024 * 1024 },
      );
      return normalizeText(stdout);
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new Error(
          "Monster manual import needs tesseract-ocr for image-only PDFs.",
        );
      }
      throw error;
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }

  private async renderPageImage(
    filePath: string,
    outputDirectory: string,
    slug: string,
    documentId: string,
    pageNumber: number,
  ) {
    const baseName = `page-${String(pageNumber).padStart(3, "0")}`;
    const outputPrefix = join(outputDirectory, baseName);
    try {
      await execFileAsync("pdftoppm", [
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-singlefile",
        "-jpeg",
        "-r",
        "120",
        filePath,
        outputPrefix,
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new Error(
          "Monster manual import requires pdftoppm from poppler-utils.",
        );
      }
      throw error;
    }

    return `/uploads/${safePathPart(slug)}/monster-manuals/${documentId}/${baseName}.jpg`;
  }

  private async findCampaignOrThrow(slug: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { slug } });

    if (!campaign) {
      throw new NotFoundException(`Campaign "${slug}" was not found.`);
    }

    return campaign;
  }
}

export function parseMonsterEntries(pageText: string): ParsedMonsterEntry[] {
  const lines = normalizeText(pageText)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const starts = findMonsterStarts(lines);

  return starts.map((start, index) => {
    const next = starts[index + 1];
    const blockLines = lines.slice(
      start.nameIndex,
      next ? next.nameIndex : lines.length,
    );
    const sourceText = blockLines.join("\n");
    return {
      name: start.name,
      sizeType: start.typeLine,
      sourceText,
      armorClass: parseLeadingNumber(sourceText, /Armor\s+Class\s+(\d+)/i),
      hitPoints: parseLeadingNumber(sourceText, /Hit\s+Points\s+(\d+)/i),
      challengeRating: parseChallengeRating(sourceText),
    };
  });
}

function findMonsterStarts(lines: string[]) {
  const starts: MonsterStart[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!isCreatureTypeLine(lines[index])) continue;
    const nameIndex = findNameLineIndex(lines, index - 1);
    if (nameIndex === -1) continue;
    starts.push({
      name: lines[nameIndex],
      typeLine: lines[index],
      typeIndex: index,
      nameIndex,
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!/Armor\s+Class/i.test(lines[index])) continue;
    const nameIndex = findNameLineIndex(lines, index - 1, 8);
    if (
      nameIndex === -1 ||
      starts.some((start) => start.nameIndex === nameIndex)
    ) {
      continue;
    }

    const typeIndex = findTypeLineIndex(lines, nameIndex + 1, index - 1);
    if (typeIndex === -1) continue;

    starts.push({
      name: lines[nameIndex],
      typeLine: lines[typeIndex],
      typeIndex,
      nameIndex,
    });
  }

  return starts.sort((left, right) => left.nameIndex - right.nameIndex);
}

function hasStatBlockMarkers(text: string) {
  return /Armor\s+Class|Hit\s+Points|Challenge\s+/i.test(text);
}

function findNameLineIndex(lines: string[], fromIndex: number, lookBehind = 4) {
  for (
    let index = fromIndex;
    index >= Math.max(0, fromIndex - lookBehind);
    index -= 1
  ) {
    if (isLikelyMonsterName(lines[index])) return index;
  }
  return -1;
}

function findTypeLineIndex(
  lines: string[],
  startIndex: number,
  endIndex: number,
) {
  for (let index = startIndex; index <= endIndex; index += 1) {
    if (isCreatureTypeLine(lines[index])) return index;
  }
  return -1;
}

function isCreatureTypeLine(line: string) {
  return /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead)\b/i.test(
    line,
  );
}

function isLikelyMonsterName(line: string) {
  if (!line || line.length > 80) return false;
  if (/[.!?:]$/.test(line)) return false;
  if (isCreatureTypeLine(line)) return false;
  if (!/^[A-Z][A-Za-z' -]*(?:\([A-Za-z' -]+\))?$/.test(line)) return false;
  if (
    /Armor\s+Class|Hit\s+Points|Speed|Challenge|Languages|Senses/i.test(line)
  ) {
    return false;
  }
  if (commonHeadingOrArticle(line)) return false;
  return !/^(Actions|Reactions|Legendary Actions|Monsters|Angels|Dragons|Demons|Devils|Appendix)/i.test(
    line,
  );
}

function commonHeadingOrArticle(line: string) {
  return /^(A|An|The|And|Or|Of|In|On|At|To|For|With|From|By|As|If|When|While|Once|Each|One|Two|Three|This|That|These|Those)$/i.test(
    line,
  );
}

function parseLeadingNumber(text: string, pattern: RegExp) {
  const match = pattern.exec(text);
  return match ? Number(match[1]) : undefined;
}

function parseChallengeRating(text: string) {
  const match = /Challenge\s+([0-9/]+|—|-)\s+\(/i.exec(text);
  return match?.[1];
}

function inferAttackInfo(text: string) {
  const actionLines = text
    .split(/\n/)
    .filter((line) => /Attack:|Hit:|Multiattack/i.test(line))
    .slice(0, 8);

  return {
    summary:
      actionLines.join(" ").replace(/\s+/g, " ").trim() || "See source page.",
  };
}

function inferRolls(text: string) {
  const abilityMatch =
    /STR\s+DEX\s+CON\s+INT\s+WIS\s+CHA\s+([\s\S]{0,160}?)(?:Saving Throws|Skills|Damage|Senses|Languages|Challenge)/i.exec(
      text,
    );
  const values =
    abilityMatch?.[1]
      ?.match(/\d+\s+\([^)]+\)/g)
      ?.map((value) => Number(/^(\d+)/.exec(value)?.[1] ?? 0)) ?? [];

  return values.length >= 6
    ? {
        strength: values[0],
        dexterity: values[1],
        constitution: values[2],
        intelligence: values[3],
        wisdom: values[4],
        charisma: values[5],
      }
    : {};
}

function inferEnvironmentText(text: string) {
  const lower = text.toLowerCase();
  const keywords = [
    "arctic",
    "cold",
    "ice",
    "frost",
    "fire",
    "forest",
    "swamp",
    "mountain",
    "desert",
    "underground",
    "water",
    "aquatic",
    "cave",
    "fiend",
    "undead",
    "dragon",
    "celestial",
  ].filter((keyword) => lower.includes(keyword));

  return keywords.length
    ? keywords.join(", ")
    : "Imported monster manual creature";
}

function buildSearchText(entry: ParsedMonsterEntry) {
  return normalizeText(
    [
      entry.name,
      entry.sizeType,
      entry.challengeRating ? `challenge ${entry.challengeRating}` : "",
      inferEnvironmentText(entry.sourceText),
      entry.sourceText,
    ].join("\n"),
  ).toLowerCase();
}

function scoreEntry(
  entry: { name: string; searchText: string; sourceText?: string },
  query: string,
  tokens: string[],
  options: MonsterCatalogSearchOptions = {},
) {
  if (!tokens.length) return 0;
  const name = entry.name.toLowerCase();
  const searchText = entry.searchText.toLowerCase();
  if (options.wholeWords && !hasWholeWordMatches(entry, tokens)) {
    return 0;
  }

  let score =
    options.wholeWords && exactWholeWordMatch(name, query)
      ? 20
      : name.includes(query)
        ? 20
        : 0;

  for (const token of tokens) {
    if (options.wholeWords) {
      if (
        tokenVariants(token).some((variant) =>
          exactWholeWordMatch(name, variant),
        )
      ) {
        score += 6;
      }
      if (
        tokenVariants(token).some((variant) =>
          exactWholeWordMatch(searchText, variant),
        )
      ) {
        score += 1;
      }
    } else {
      if (name.includes(token)) score += 6;
      if (searchText.includes(token)) score += 1;
    }
  }

  return score;
}

function hasWholeWordMatches(
  entry: { name: string; searchText: string; sourceText?: string },
  tokens: string[],
) {
  const haystack = normalizeWholeWordSearch(
    [entry.name, entry.searchText, entry.sourceText ?? ""].join(" "),
  );
  return tokens.every((token) =>
    tokenVariants(token).some((variant) =>
      wholeWordPattern(variant).test(haystack),
    ),
  );
}

function exactWholeWordMatch(text: string, query: string) {
  const normalizedQuery = normalizeWholeWordSearch(query).trim();
  if (!normalizedQuery) return false;
  return wholeWordPattern(normalizedQuery).test(normalizeWholeWordSearch(text));
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

function preview(text: string, length = 360) {
  return normalizeText(text).replace(/\s+/g, " ").trim().slice(0, length);
}

function normalizeText(text: string) {
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

function safePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}
