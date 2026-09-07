import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * DEV-ONLY placeholder for real object storage — writes straight to
 * `public/uploads/<subdir>/`, which Next.js already serves as static files.
 * There is still no real cloud storage integration in this app (see
 * Document.fileUrl's own long-standing "no storage integration here" note)
 * — this exists specifically so passport-image OCR has real bytes to work
 * with end-to-end. Before production: local disk doesn't survive a
 * redeploy and isn't shared across instances — swap this for S3/Cloudinary/
 * similar, keeping the same `saveUploadedImage` signature so callers don't
 * change.
 */
export async function saveUploadedImage(base64Data: string, mimeType: string, subdir: string): Promise<{ url: string; absolutePath: string }> {
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) {
    throw new Error(`Unsupported image type "${mimeType}" — use JPEG, PNG, GIF, or WebP.`);
  }

  const dir = path.join(UPLOADS_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${extension}`;
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, Buffer.from(base64Data, "base64"));

  return { url: `/uploads/${subdir}/${filename}`, absolutePath };
}

/**
 * Reads image bytes back given a `Document.fileUrl` — handles both a
 * relative path this app itself wrote (via saveUploadedImage, read straight
 * off disk) and a real external http(s) URL (fetched over the network,
 * e.g. one a staff member pasted in via the CRM's existing "attach an
 * already-hosted URL" upload flow).
 */
export async function readImageBytes(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
  if (fileUrl.startsWith("/")) {
    const absolutePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
    const buffer = await fs.readFile(absolutePath);
    const extension = path.extname(absolutePath).slice(1).toLowerCase();
    const mimeType = Object.entries(EXTENSION_BY_MIME).find(([, ext]) => ext === extension)?.[0];
    if (!mimeType) throw new Error(`Can't tell the image type from "${fileUrl}" — expected .jpg/.png/.gif/.webp.`);
    return { base64: buffer.toString("base64"), mimeType };
  }

  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Couldn't fetch "${fileUrl}" (${response.status}).`);
  const mimeType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!Object.keys(EXTENSION_BY_MIME).includes(mimeType)) {
    throw new Error(`"${fileUrl}" isn't a supported image type (got "${mimeType}") — expected JPEG, PNG, GIF, or WebP.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType };
}
