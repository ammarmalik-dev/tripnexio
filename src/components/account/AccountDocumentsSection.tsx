"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toaster";
import { patchJson, ApiError } from "@/lib/api/client";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { OutstandingDocument } from "@/lib/account/outstanding-documents";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
const MAX_BYTES = 3 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function DocumentRow({ document, onUploaded }: { document: OutstandingDocument; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return setError("Use a JPEG, PNG, GIF, WebP image or a PDF.");
    if (file.size > MAX_BYTES) return setError("That file is too large (3MB max).");
    setError(null);
    setUploading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      await patchJson(`/api/account/documents/${document.id}/upload`, { fileBase64, mimeType: file.type });
      toast.success("Document uploaded.");
      onUploaded();
    } catch (uploadError) {
      toast.error(uploadError instanceof ApiError ? uploadError.message : "Couldn't upload that file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Upload className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
            {document.type}
          </span>
          <span className="text-xs text-ink-tertiary">
            {[document.serviceType ? SERVICE_TYPE_LABELS[document.serviceType] : null, document.leadReference, document.bookingDisplayId, document.passengerName]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <label className="cursor-pointer rounded-md bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-accent ring-1 ring-hairline hover:bg-surface-3">
          {uploading ? "Uploading..." : "Choose file"}
          <input type="file" accept={ALLOWED_TYPES.join(",")} className="sr-only" onChange={handleChange} disabled={uploading} />
        </label>
      </div>
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}

/**
 * Step 55 — "anything requested after the fact" upload surface on
 * `/account`, for any Document a staff member has flagged REQUIRED/MISSING
 * across any of the customer's services (not just Return Ticket/OTB's
 * post-payment checklist, which stays on `/pay/<token>`).
 */
export function AccountDocumentsSection({ documents }: { documents: OutstandingDocument[] }) {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink-heading">Documents Needed</h2>
      {documents.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="h-5 w-5" aria-hidden="true" />}
          title="Nothing outstanding"
          description="If our team ever needs an extra document from you, it'll show up here."
        />
      ) : (
        documents.map((document) => (
          <DocumentRow key={document.id} document={document} onUploaded={() => router.refresh()} />
        ))
      )}
    </section>
  );
}
