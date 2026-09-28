import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "../db";
import { checkBase64Upload } from "../uploads/validate-upload";

/** Private upload directory — deliberately OUTSIDE public/, so nothing here is ever served statically. */
const PRIVATE_UPLOADS_ROOT = path.join(process.cwd(), "storage", "uploads");
/** Files written before private storage existed; still readable/deletable, never written to again. */
const LEGACY_PUBLIC_ROOT = path.join(process.cwd(), "public");
export const FILE_URL_PREFIX = "/api/files/";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  // Step 16 (audit §3.6): Ticket/Visa OCR needs PDF support.
  "application/pdf": "pdf",
};

/** A private-disk file id: `<uuid>.<ext>`. A bare `<uuid>` is a FileBlob row. */
const DISK_FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp|pdf)$/;

export class UploadValidationError extends Error {
  constructor(
    message: string,
    readonly status: 413 | 415
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function mimeTypeForExtension(extension: string): string | undefined {
  return Object.entries(EXTENSION_BY_MIME).find(([, ext]) => ext === extension)?.[0];
}

/**
 * Stores an uploaded file and returns the URL it is served from — always a
 * `/api/files/<id>` URL, which enforces access control. The declared MIME
 * type is ignored: the real type is detected from the bytes, and size/type
 * are validated server-side (UploadValidationError on failure).
 *
 * Private local disk first (a VPS). On a host with no writable disk
 * (serverless), or when FILE_STORAGE=db, the bytes go into the database
 * (FileBlob) instead. Private
 * disk files are stored flat by random id.
 */
export async function saveUploadedFile(base64Data: string): Promise<{ url: string; absolutePath: string }> {
  const check = checkBase64Upload(base64Data);
  if (!check.ok) throw new UploadValidationError(check.message, check.status);
  const { buffer, mimeType } = check;
  const extension = EXTENSION_BY_MIME[mimeType];

  if (process.env.FILE_STORAGE !== "db") {
    try {
      await fs.mkdir(PRIVATE_UPLOADS_ROOT, { recursive: true });
      const fileId = `${crypto.randomUUID()}.${extension}`;
      const absolutePath = path.join(PRIVATE_UPLOADS_ROOT, fileId);
      await fs.writeFile(absolutePath, buffer);
      return { url: `${FILE_URL_PREFIX}${fileId}`, absolutePath };
    } catch (error) {
      console.warn("[file-storage] local disk isn't writable, storing in the database instead:", (error as Error).message);
    }
  }

  const id = crypto.randomUUID();
  await db.fileBlob.create({ data: { id, mimeType, data: new Uint8Array(buffer) } });
  return { url: `${FILE_URL_PREFIX}${id}`, absolutePath: "" };
}

/** Reads a stored file by its `/api/files/<id>` id — a private-disk file or a FileBlob row. Returns null when it doesn't exist. */
export async function readStoredFile(fileId: string): Promise<{ data: Buffer; mimeType: string } | null> {
  if (DISK_FILE_ID.test(fileId)) {
    try {
      const data = await fs.readFile(path.join(PRIVATE_UPLOADS_ROOT, fileId));
      const mimeType = mimeTypeForExtension(path.extname(fileId).slice(1));
      return mimeType ? { data, mimeType } : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  const blob = await db.fileBlob.findUnique({ where: { id: fileId } });
  return blob ? { data: Buffer.from(blob.data), mimeType: blob.mimeType } : null;
}

/** Absolute path of a legacy `/uploads/...` file, or null when the URL would escape public/uploads. */
function legacyPublicPath(fileUrl: string): string | null {
  const uploadsRoot = path.join(LEGACY_PUBLIC_ROOT, "uploads");
  const absolutePath = path.resolve(LEGACY_PUBLIC_ROOT, fileUrl.replace(/^\//, ""));
  return absolutePath.startsWith(uploadsRoot + path.sep) ? absolutePath : null;
}

/**
 * Best-effort delete of a file this app itself wrote — used by the
 * document-retention purge job and by upload routes when a new file replaces
 * an old one. Silently no-ops for an external http(s) URL. Swallows "file
 * already gone"; other errors are logged, not thrown, since a failed cleanup
 * shouldn't block the caller's DB update.
 */
export async function deleteUploadedFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith("/")) return;

  let absolutePath: string | null = null;
  if (fileUrl.startsWith(FILE_URL_PREFIX)) {
    const fileId = fileUrl.slice(FILE_URL_PREFIX.length);
    if (!DISK_FILE_ID.test(fileId)) {
      await db.fileBlob.deleteMany({ where: { id: fileId } });
      return;
    }
    absolutePath = path.join(PRIVATE_UPLOADS_ROOT, fileId);
  } else {
    absolutePath = legacyPublicPath(fileUrl);
  }
  if (!absolutePath) return;

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    console.error(`[local-file-storage] couldn't delete a stored file (${(error as NodeJS.ErrnoException).code ?? "unknown error"})`);
  }
}

/**
 * Reads file bytes back given a `Document.fileUrl` — a stored `/api/files/<id>`
 * file or a legacy `/uploads/...` path. An external http(s) URL (the CRM's
 * "attach an already-hosted URL" flow) is never fetched.
 */
export async function readFileBytes(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
  if (fileUrl.startsWith(FILE_URL_PREFIX)) {
    const stored = await readStoredFile(fileUrl.slice(FILE_URL_PREFIX.length));
    if (!stored) throw new Error("Stored file no longer exists.");
    return { base64: stored.data.toString("base64"), mimeType: stored.mimeType };
  }

  if (fileUrl.startsWith("/")) {
    const absolutePath = legacyPublicPath(fileUrl);
    if (!absolutePath) throw new Error("Invalid stored file path.");
    const buffer = await fs.readFile(absolutePath);
    const mimeType = mimeTypeForExtension(path.extname(absolutePath).slice(1).toLowerCase());
    if (!mimeType) throw new Error("Can't tell the stored file's type — expected .jpg/.png/.gif/.webp/.pdf.");
    return { base64: buffer.toString("base64"), mimeType };
  }

  // No arbitrary network fetches (SSRF): only files this app stored itself can be read back.
  throw new Error("Only files uploaded to TripNexio can be read; external links aren't fetched.");
}
