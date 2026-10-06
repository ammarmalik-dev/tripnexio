"use client";

import { useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

const ACCEPTED = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"] as const;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Client corrections 2026-10-05 — staff upload a customer's document file
 * manually, from the Lead or the Booking (PATCH /api/documents/[id]/upload,
 * documents.edit; validated server-side, max 8MB). The document moves to
 * Uploaded / Received.
 */
export function DocumentUploadButton({ documentId, hasFile, onUploaded }: { documentId: string; hasFile: boolean; onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(ACCEPTED as readonly string[]).includes(file.type)) {
      toast.error("Use a JPEG, PNG, GIF, WebP or PDF file.");
      return;
    }
    setBusy(true);
    try {
      await patchJson(`/api/documents/${documentId}/upload`, { fileBase64: await readAsBase64(file), mimeType: file.type });
      toast.success("File uploaded.");
      onUploaded();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-accent hover:underline">
      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
      {busy ? "Uploading…" : hasFile ? "Replace file" : "Upload file"}
      <input type="file" accept={ACCEPTED.join(",")} className="sr-only" disabled={busy} onChange={(event) => void handleChange(event)} />
    </label>
  );
}
