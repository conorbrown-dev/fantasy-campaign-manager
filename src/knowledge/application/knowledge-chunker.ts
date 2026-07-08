import { createHash } from "crypto";
import { extname } from "path";
import { KnowledgeChunkInput } from "../domain/knowledge.types";

const targetChunkLength = 1400;
const maxChunkLength = 2400;
const srdClassNames = [
  "Barbarian",
  "Bard",
  "Cleric",
  "Druid",
  "Fighter",
  "Monk",
  "Paladin",
  "Ranger",
  "Rogue",
  "Sorcerer",
  "Warlock",
  "Wizard",
];
const srdRaceNames = [
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
const srdTopLevelHeadings = new Set([
  "Races",
  "Classes",
  "Beyond 1st Level",
  "Alignment",
  "Languages",
  "Equipment",
  "Customization Options",
  "Using Ability Scores",
  "Adventuring",
  "Combat",
  "Spellcasting",
  "Spell Lists",
  "Spell Descriptions",
  "Monsters",
  "Conditions",
]);
const srdSubsectionHeadings = new Set([
  "Racial Traits",
  "Subraces",
  "Class Features",
  "Spellcasting",
  "Preparing and Casting Spells",
  "Cantrips",
  "Spell Slots",
  "Spells Known of 1st Level and Higher",
  "Equipment",
  "Weapons",
  "Weapon Properties",
  "Armor",
  "Adventuring Gear",
  "Tools",
  "Mounts and Vehicles",
  "Expenses",
  "Feats",
  "Ability Scores and Modifiers",
  "Advantage and Disadvantage",
  "Proficiency Bonus",
  "Ability Checks",
  "Saving Throws",
  "Time",
  "Movement",
  "The Environment",
  "Social Interaction",
  "Resting",
  "Between Adventures",
  "The Order of Combat",
  "Movement and Position",
  "Actions in Combat",
  "Making an Attack",
  "Cover",
  "Damage and Healing",
  "Mounted Combat",
  "Underwater Combat",
  "What Is a Spell?",
  "Casting a Spell",
  "Combining Magical Effects",
  "Actions",
  "Reactions",
  "Legendary Actions",
]);
const srdSubsectionTopLevel = new Map([
  ["Armor", "Equipment"],
  ["Weapons", "Equipment"],
  ["Weapon Properties", "Equipment"],
  ["Adventuring Gear", "Equipment"],
  ["Tools", "Equipment"],
  ["Mounts and Vehicles", "Equipment"],
  ["Expenses", "Equipment"],
  ["Feats", "Customization Options"],
  ["Ability Scores and Modifiers", "Using Ability Scores"],
  ["Advantage and Disadvantage", "Using Ability Scores"],
  ["Proficiency Bonus", "Using Ability Scores"],
  ["Ability Checks", "Using Ability Scores"],
  ["Saving Throws", "Using Ability Scores"],
  ["Time", "Adventuring"],
  ["Movement", "Adventuring"],
  ["The Environment", "Adventuring"],
  ["Social Interaction", "Adventuring"],
  ["Resting", "Adventuring"],
  ["Between Adventures", "Adventuring"],
  ["The Order of Combat", "Combat"],
  ["Movement and Position", "Combat"],
  ["Actions in Combat", "Combat"],
  ["Making an Attack", "Combat"],
  ["Cover", "Combat"],
  ["Damage and Healing", "Combat"],
  ["Mounted Combat", "Combat"],
  ["Underwater Combat", "Combat"],
  ["What Is a Spell?", "Spellcasting"],
  ["Casting a Spell", "Spellcasting"],
  ["Combining Magical Effects", "Spellcasting"],
]);
const srdSpellListHeadings = new Set(
  srdClassNames.map((className) => `${className} Spells`),
);

export function hashContent(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function chunkDocument(
  fileName: string,
  content: string,
): KnowledgeChunkInput[] {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".pdf") {
    return isSrdPdf(fileName, content)
      ? chunkSrdPdfTextDocument(content)
      : chunkPdfTextDocument(content);
  }

  if (extension === ".json") {
    return chunkJsonDocument(content);
  }

  if (extension === ".md" || extension === ".markdown") {
    return chunkMarkdownDocument(content);
  }

  return chunkTextDocument(content, "Imported Text", []);
}

function isSrdPdf(fileName: string, content: string) {
  return (
    /srd|system-reference-document/i.test(fileName) ||
    content.includes("System Reference Document 5.1")
  );
}

function chunkSrdPdfTextDocument(content: string) {
  const sections = srdSectionsFromLines(srdReadingOrderLines(content));
  const chunks = sections.flatMap((section) => {
    const text = [section.path.join(" > "), ...section.lines].join("\n");
    return chunkTextDocument(text, section.title, section.path).map(
      (chunk) => ({
        ...chunk,
        pageNumber: section.pageNumber,
      }),
    );
  });

  return [...srdCatalogChunks(), ...chunks].filter(
    (chunk) => chunk.text.trim().length > 0,
  );
}

type SrdLine = {
  text: string;
  pageNumber: number;
};

type SrdSection = {
  title: string;
  path: string[];
  lines: string[];
  pageNumber: number;
};

function srdReadingOrderLines(content: string): SrdLine[] {
  return content.split("\f").flatMap((page, index) => {
    const pageNumber = index + 1;
    return srdPageReadingOrderLines(page, pageNumber);
  });
}

function srdPageReadingOrderLines(page: string, pageNumber: number): SrdLine[] {
  const rawLines = page
    .split(/\n/)
    .filter((line) => !isSrdPageNoise(line))
    .filter((line) => line.trim());
  const maxLineLength = Math.max(0, ...rawLines.map((line) => line.length));
  const splitIndex = findSrdColumnSplitIndex(rawLines);
  const splitLines = rawLines.map((line) => ({
    left: line.slice(0, splitIndex),
    right: line.slice(splitIndex),
  }));
  const linePairs = splitLines.filter(
    ({ left, right }) => left.trim() && right.trim(),
  ).length;
  const twoColumnPage = maxLineLength > 55 && splitIndex > 0 && linePairs > 5;

  if (!twoColumnPage) {
    return rawLines
      .map((line) => normalizeSrdLine(line))
      .filter(Boolean)
      .map((text) => ({ text, pageNumber }));
  }

  const left = splitLines
    .map(({ left }) => normalizeSrdLine(left))
    .filter(Boolean);
  const right = splitLines
    .map(({ right }) => normalizeSrdLine(right))
    .filter(Boolean);

  return [...left, ...right].map((text) => ({ text, pageNumber }));
}

function findSrdColumnSplitIndex(lines: string[]) {
  const maxLineLength = Math.max(0, ...lines.map((line) => line.length));
  if (maxLineLength < 56) return 0;

  const start = Math.max(24, Math.floor(maxLineLength * 0.3));
  const end = Math.min(maxLineLength - 8, Math.floor(maxLineLength * 0.78));
  const preferred = maxLineLength * 0.52;
  let bestIndex = 0;
  let bestScore = -Infinity;

  for (let index = start; index <= end; index += 1) {
    const whitespaceScore = lines.reduce((score, line) => {
      if (line.length <= index - 3) return score;
      const gutter = line.slice(Math.max(0, index - 3), index + 4);
      return score + (gutter.trim() ? 0 : 1);
    }, 0);
    const centralityPenalty = Math.abs(index - preferred) * 0.03;
    const score = whitespaceScore - centralityPenalty;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= Math.max(4, lines.length * 0.18) ? bestIndex : 0;
}

function isSrdPageNoise(line: string) {
  const normalized = normalizeSrdLine(line);
  return (
    !normalized ||
    normalized === "(This page intentionally left blank)" ||
    /System Reference Document 5\.1\s+\d+$/.test(normalized) ||
    /^Legal Information$/.test(normalized)
  );
}

function srdSectionsFromLines(lines: SrdLine[]) {
  const sections: SrdSection[] = [];
  let current: SrdSection = {
    title: "System Reference Document 5.1",
    path: ["System Reference Document 5.1"],
    lines: [],
    pageNumber: 1,
  };
  let currentTop = "";
  let currentSpellList = "";

  const flush = () => {
    if (!current.lines.join("\n").trim()) return;
    sections.push(current);
  };

  for (const [index, line] of lines.entries()) {
    const nextLine = lines[index + 1]?.text ?? "";
    const heading = classifySrdHeading(
      line,
      currentTop,
      currentSpellList,
      nextLine,
    );

    if (heading) {
      flush();
      current = {
        title: heading.title,
        path: heading.path,
        lines: [line.text],
        pageNumber: line.pageNumber,
      };
      currentTop = heading.path[0] ?? currentTop;
      currentSpellList =
        heading.path[0] === "Spell Lists" && heading.path[1]?.endsWith("Spells")
          ? heading.path[1]
          : heading.path[0] === "Spell Lists"
            ? currentSpellList
            : "";
      continue;
    }

    current.lines.push(line.text);
  }

  flush();
  return sections;
}

function classifySrdHeading(
  line: SrdLine,
  currentTop: string,
  currentSpellList: string,
  nextLine: string,
) {
  const text = normalizeSrdLine(line.text);

  if (!text || text.length > 96) {
    return undefined;
  }

  if (srdTopLevelHeadings.has(text)) {
    return { title: text, path: [text] };
  }

  if (srdSpellListHeadings.has(text)) {
    return { title: text, path: ["Spell Lists", text] };
  }

  if (
    currentTop === "Spell Lists" &&
    currentSpellList &&
    isSpellLevelHeading(text)
  ) {
    return { title: text, path: ["Spell Lists", currentSpellList, text] };
  }

  if (srdClassNames.includes(text) && line.pageNumber < 80) {
    return { title: text, path: ["Classes", text] };
  }

  if (srdRaceNames.includes(text) && line.pageNumber < 25) {
    return { title: text, path: ["Races", text] };
  }

  if (text.endsWith(" Traits") && currentTop === "Races") {
    return { title: text, path: ["Races", text.replace(/ Traits$/, ""), text] };
  }

  if (srdSubsectionHeadings.has(text)) {
    const mappedTop = srdSubsectionTopLevel.get(text);
    return {
      title: text,
      path: mappedTop
        ? [mappedTop, text]
        : currentTop
          ? [currentTop, text]
          : [text],
    };
  }

  if (
    currentTop === "Spell Descriptions" &&
    isLikelySrdTitle(text) &&
    /^(cantrip|[1-9](st|nd|rd|th)\W*level)\b/i.test(nextLine)
  ) {
    return { title: text, path: ["Spell Descriptions", text] };
  }

  if (
    currentTop === "Monsters" &&
    isLikelySrdTitle(text) &&
    /^(tiny|small|medium|large|huge|gargantuan)\b/i.test(nextLine)
  ) {
    return { title: text, path: ["Monsters", text] };
  }

  return undefined;
}

function isSpellLevelHeading(text: string) {
  return /^(Cantrips \(0 Level\)|[1-9](?:st|nd|rd|th) Level)$/.test(text);
}

function isLikelySrdTitle(text: string) {
  if (!text || text.length > 64) return false;
  if (/[.!?]$/.test(text)) return false;
  if (/^\d/.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length > 6) return false;
  return words.every((word) => /^[A-Z0-9'(/-]/.test(word));
}

function srdCatalogChunks(): KnowledgeChunkInput[] {
  return [
    {
      title: "Playable Races",
      sectionPath: ["Races", "Playable Races"],
      pageNumber: 3,
      text: `Playable Races
${srdRaceNames.join("\n")}`,
    },
    {
      title: "Character Classes",
      sectionPath: ["Classes", "Character Classes"],
      pageNumber: 9,
      text: `Character Classes
${srdClassNames.join("\n")}`,
    },
  ];
}

function normalizeSrdLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function chunkPdfTextDocument(content: string) {
  return content
    .split("\f")
    .flatMap((page, index) => {
      const pageNumber = index + 1;
      const title = inferPageTitle(page, pageNumber);

      return chunkTextDocument(page, title, [title]).map((chunk) => ({
        ...chunk,
        pageNumber,
      }));
    })
    .filter((chunk) => chunk.text.trim().length > 0);
}

function inferPageTitle(page: string, pageNumber: number) {
  const lines = page
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const heading = lines.find((line) => {
    const letters = line.replace(/[^A-Za-z]/g, "");
    const wordCount = line.split(/\s+/).length;
    return (
      line.length >= 3 &&
      line.length <= 80 &&
      wordCount <= 10 &&
      letters.length >= 3 &&
      line === line.toUpperCase()
    );
  });

  return heading ?? `PDF page ${pageNumber}`;
}

function chunkMarkdownDocument(content: string) {
  const sections: Array<{ title: string; path: string[]; body: string[] }> = [];
  const headingStack: string[] = [];
  let current = {
    title: "Imported Markdown",
    path: [] as string[],
    body: [] as string[],
  };

  for (const line of content.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current.body.join("\n").trim()) {
        sections.push(current);
      }

      const depth = heading[1].length;
      headingStack.splice(depth - 1);
      headingStack[depth - 1] = heading[2].trim();
      const path = headingStack.filter(Boolean);
      current = {
        title: path.at(-1) ?? "Imported Markdown",
        path,
        body: [],
      };
      continue;
    }

    current.body.push(line);
  }

  if (current.body.join("\n").trim()) {
    sections.push(current);
  }

  return sections.flatMap((section) =>
    chunkTextDocument(section.body.join("\n"), section.title, section.path),
  );
}

function chunkJsonDocument(content: string) {
  const parsed = JSON.parse(content) as unknown;
  const entries = normalizeJsonEntries(parsed);

  return entries.flatMap((entry) => {
    const title = inferJsonTitle(entry.value, entry.key);
    const text = jsonToReadableText(entry.value);
    return chunkTextDocument(text, title, [title]);
  });
}

function normalizeJsonEntries(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      key: String(index + 1),
      value: item,
    }));
  }

  if (isRecord(value)) {
    const values = Object.entries(value);
    const collection = values.find(([, nested]) => Array.isArray(nested));
    if (collection) {
      return (collection[1] as unknown[]).map((item, index) => ({
        key: `${collection[0]} ${index + 1}`,
        value: item,
      }));
    }

    return values.map(([key, nested]) => ({ key, value: nested }));
  }

  return [{ key: "Imported JSON", value }];
}

function inferJsonTitle(value: unknown, fallback: string) {
  if (isRecord(value)) {
    for (const key of ["name", "title", "id", "slug"]) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return fallback;
}

function jsonToReadableText(value: unknown, prefix = ""): string {
  if (value === null || typeof value !== "object") {
    return `${prefix}${String(value)}`;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => jsonToReadableText(item, prefix))
      .filter(Boolean)
      .join("\n");
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([key, nested]) => {
      const label = key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ");
      if (nested === null || typeof nested !== "object") {
        return `${label}: ${String(nested)}`;
      }
      return `${label}:\n${jsonToReadableText(nested, "  ")}`;
    })
    .join("\n");
}

function chunkTextDocument(
  content: string,
  title: string,
  sectionPath: string[],
): KnowledgeChunkInput[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: KnowledgeChunkInput[] = [];
  let buffer: string[] = [];
  let bufferLength = 0;

  for (const paragraph of paragraphs) {
    const wouldExceed = bufferLength + paragraph.length > targetChunkLength;
    if (buffer.length && wouldExceed) {
      chunks.push(...flushBuffer(buffer, title, sectionPath));
      buffer = [];
      bufferLength = 0;
    }

    if (paragraph.length > maxChunkLength) {
      chunks.push(...splitLongParagraph(paragraph, title, sectionPath));
      continue;
    }

    buffer.push(paragraph);
    bufferLength += paragraph.length;
  }

  if (buffer.length) {
    chunks.push(...flushBuffer(buffer, title, sectionPath));
  }

  return chunks;
}

function flushBuffer(
  buffer: string[],
  title: string,
  sectionPath: string[],
): KnowledgeChunkInput[] {
  const text = buffer.join("\n\n").trim();
  return text ? [{ title, sectionPath, text }] : [];
}

function splitLongParagraph(
  paragraph: string,
  title: string,
  sectionPath: string[],
) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+|\S.+$/g) ?? [paragraph];
  if (sentences.length === 1 && sentences[0].length > maxChunkLength) {
    const chunks: KnowledgeChunkInput[] = [];
    for (let index = 0; index < paragraph.length; index += targetChunkLength) {
      chunks.push({
        title,
        sectionPath,
        text: paragraph.slice(index, index + targetChunkLength).trim(),
      });
    }
    return chunks;
  }

  return chunkTextDocument(sentences.join("\n\n"), title, sectionPath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
