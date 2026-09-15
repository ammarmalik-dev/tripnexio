import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  // Step 16 (audit §3.6): Ticket/Visa OCR needs PDF support — visa
  // documents especially are commonly issued as PDFs, per CRM.md §18's own
  // "Visa PDF" wording. Passport photos stay image-only (unchanged).
  "application/pdf": "pdf",
};

/**
 * DEV-ONLY placeholder for real object storage — writes straight to
 * `public/uploads/<subdir>/`, which Next.js already serves as static files.
 * There is still no real cloud storage integration in this app (see
 * Document.fileUrl's own long-standing "no storage integration here" note)
 * — this exists specifically so document OCR has real bytes to work with
 * end-to-end. Before production: local disk doesn't survive a redeploy and
 * isn't shared across instances — swap this for S3/Cloudinary/similar,
 * keeping the same `saveUploadedFile` signature so callers don't change.
 */
export async function saveUploadedFile(base64Data: string, mimeType: string, subdir: string): Promise<{ url: string; absolutePath: string }> {
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) {
    throw new Error(`Unsupported file type "${mimeType}" — use JPEG, PNG, GIF, WebP, or PDF.`);
  }

  const dir = path.join(UPLOADS_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${extension}`;
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, Buffer.from(base64Data, "base64"));

  return { url: `/uploads/${subdir}/${filename}`, absolutePath };
}

/**
 * Best-effort delete of a file this app itself wrote (a local `/uploads/...`
 * path from saveUploadedFile) — used by the document-retention purge job
 * (Step 21, audit §7.5) and by the upload routes when a new file replaces
 * an old one (New_Visa.md §18: "old file is deleted"). Silently no-ops for
 * an external http(s) URL (the CRM's "paste an already-hosted URL" flow) —
 * this app doesn't own that file and has no business deleting it. Swallows
 * "file already gone" (ENOENT) since the caller's goal ("this file no
 * longer exists on disk") is already satisfied either way; other errors
 * are logged, not thrown, since a failed cleanup shouldn't block whatever
 * DB update the caller is also making.
 */
export async function deleteUploadedFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith("/")) return;

  const absolutePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    console.error(`[local-file-storage] couldn't delete "${fileUrl}"`, error);
  }
}

/**
 * Reads file bytes back given a `Document.fileUrl` — handles both a
 * relative path this app itself wrote (via saveUploadedFile, read straight
 * off disk) and a real external http(s) URL (fetched over the network,
 * e.g. one a staff member pasted in via the CRM's existing "attach an
 * already-hosted URL" upload flow).
 */
export async function readFileBytes(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
  if (fileUrl.startsWith("/")) {
    const absolutePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
    const buffer = await fs.readFile(absolutePath);
    const extension = path.extname(absolutePath).slice(1).toLowerCase();
    const mimeType = Object.entries(EXTENSION_BY_MIME).find(([, ext]) => ext === extension)?.[0];
    if (!mimeType) throw new Error(`Can't tell the file type from "${fileUrl}" — expected .jpg/.png/.gif/.webp/.pdf.`);
    return { base64: buffer.toString("base64"), mimeType };
  }

  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Couldn't fetch "${fileUrl}" (${response.status}).`);
  const mimeType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!Object.keys(EXTENSION_BY_MIME).includes(mimeType)) {
    throw new Error(`"${fileUrl}" isn't a supported file type (got "${mimeType}") — expected JPEG, PNG, GIF, WebP, or PDF.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType };
}
