import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "../db";

/**
 * Client doc 16 Nov (L4) — Knowledge Centre documents: PDF, DOC and DOCX, one file per upload request (the screen
 * sends several in a row with a progress bar each). The real type is read from the bytes, never the browser's claim.
 * Files live in a private folder (never public/) or, on a host without a writable disk, in FileBlob.
 */
export const KNOWLEDGE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const KNOWLEDGE_DOCUMENT_TYPES = {
  "application/pdf": { extension: "pdf", label: "PDF" },
  "application/msword": { extension: "doc", label: "DOC" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: "docx", label: "DOCX" },
} as const;

export type KnowledgeDocumentMime = keyof typeof KNOWLEDGE_DOCUMENT_TYPES;

const ROOT = path.join(process.cwd(), "storage", "knowledge");
const DISK_KEY = /^disk:([0-9a-f-]{36}\.(pdf|doc|docx))$/;
const OLE_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** PDF / DOC (OLE compound file) / DOCX (a zip carrying word/ parts); null for anything else. */
export function sniffKnowledgeDocument(buffer: Buffer): KnowledgeDocumentMime | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(OLE_HEADER)) return "application/msword";
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    // A zip: only a Word document (it has word/document.xml) is accepted, never an arbitrary archive.
    return buffer.includes("word/document.xml") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : null;
  }
  return null;
}

/** Stores the bytes; returns the storageKey for KnowledgeDocument. */
export async function saveKnowledgeFile(buffer: Buffer, mimeType: KnowledgeDocumentMime): Promise<string> {
  if (process.env.FILE_STORAGE !== "db") {
    try {
      await fs.mkdir(ROOT, { recursive: true });
      const file = `${crypto.randomUUID()}.${KNOWLEDGE_DOCUMENT_TYPES[mimeType].extension}`;
      await fs.writeFile(path.join(ROOT, file), buffer);
      return `disk:${file}`;
    } catch (error) {
      console.warn("[knowledge-files] local disk isn't writable, storing in the database instead:", (error as Error).message);
    }
  }
  const id = crypto.randomUUID();
  await db.fileBlob.create({ data: { id, mimeType, data: new Uint8Array(buffer) } });
  return `blob:${id}`;
}

export async function readKnowledgeFile(storageKey: string): Promise<Buffer | null> {
  const disk = DISK_KEY.exec(storageKey);
  if (disk) {
    try {
      return await fs.readFile(path.join(ROOT, disk[1]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  if (storageKey.startsWith("blob:")) {
    const blob = await db.fileBlob.findUnique({ where: { id: storageKey.slice(5) } });
    return blob ? Buffer.from(blob.data) : null;
  }
  return null;
}

/** Best-effort removal of the stored bytes (the row is deleted by the caller). */
export async function deleteKnowledgeFile(storageKey: string): Promise<void> {
  const disk = DISK_KEY.exec(storageKey);
  try {
    if (disk) await fs.unlink(path.join(ROOT, disk[1]));
    else if (storageKey.startsWith("blob:")) await db.fileBlob.deleteMany({ where: { id: storageKey.slice(5) } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[knowledge-files] couldn't delete a stored file", (error as Error).name);
  }
}

/** A file name safe for a Content-Disposition header (keeps the extension). */
export function safeDownloadName(fileName: string): string {
  return fileName.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "document";
}
