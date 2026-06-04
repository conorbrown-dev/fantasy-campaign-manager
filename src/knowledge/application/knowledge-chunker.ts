import { createHash } from "crypto";
import { extname } from "path";
import { KnowledgeChunkInput } from "../domain/knowledge.types";

const targetChunkLength = 1400;
const maxChunkLength = 2400;

export function hashContent(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function chunkDocument(
  fileName: string,
  content: string,
): KnowledgeChunkInput[] {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".pdf") {
    return chunkPdfTextDocument(content);
  }

  if (extension === ".json") {
    return chunkJsonDocument(content);
  }

  if (extension === ".md" || extension === ".markdown") {
    return chunkMarkdownDocument(content);
  }

  return chunkTextDocument(content, "Imported Text", []);
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
