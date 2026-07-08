import { execFile } from "child_process";
import { mkdtemp, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { extname, join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function extractDocumentText(fileName: string, content: Buffer) {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".pdf") {
    return extractPdfText(fileName, content);
  }

  return content.toString("utf8");
}

async function extractPdfText(fileName: string, content: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), "dnd-reference-"));
  const inputPath = join(directory, sanitizeFileName(fileName));

  await writeFile(inputPath, content);

  try {
    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", inputPath, "-"],
      { maxBuffer: 50 * 1024 * 1024 },
    );
    const text = normalizeExtractedText(stdout);

    if (!text) {
      throw new Error("No extractable text was found in the PDF.");
    }

    return text;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw new Error(
        "PDF import requires the pdftotext command. In Docker this is installed automatically; locally install poppler-utils.",
      );
    }

    throw error;
  } finally {
    await unlink(inputPath).catch(() => undefined);
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-") || "reference.pdf";
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t?\r[ \t]*\u00a0?/g, " ")
    .replace(/\r/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\u00ad/g, "")
    .replace(/\t/g, " ")
    .replace(/[^\S\n\f]+$/gm, "")
    .trim();
}
