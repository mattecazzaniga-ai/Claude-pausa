import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

const TEXT_EXTENSIONS = new Set(["csv", "txt"]);

/** Extracts plain text from a coach-uploaded evaluation sheet — PDF, DOCX, CSV or TXT. Images are handled separately via Gemini vision, not text extraction. */
export async function extractTextFromFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    return buffer.toString("utf-8");
  }

  throw new Error(`Formato file non supportato: .${ext}. Usa PDF, DOCX, CSV, TXT o una foto (JPG/PNG).`);
}

export const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024; // 8MB
