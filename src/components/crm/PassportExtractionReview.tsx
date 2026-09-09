"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ScanLine, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, patchJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface ExtractedFields {
  fullName?: string;
  passportNumber?: string;
  nationality?: string;
  dob?: string;
  sex?: string;
  expiryDate?: string;
  issuingCountry?: string;
}

interface ExtractionData {
  id: string;
  provider: string;
  status: "PENDING_REVIEW" | "CONFIRMED" | "REJECTED";
  extractedFields: ExtractedFields;
  mrzRaw: string | null;
  mrzValid: boolean;
  createdAt: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function toBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve({ base64: result.split(",")[1] ?? "", mimeType: file.type });
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function ReviewCard({ extraction, onResolved }: { extraction: ExtractionData; onResolved: () => void }) {
  const [fields, setFields] = useState<ExtractedFields>(extraction.extractedFields);
  const [submitting, setSubmitting] = useState<"confirm" | "reject" | null>(null);
  const isPlaceholderProvider = extraction.provider.startsWith("placeholder");

  const handleConfirm = async () => {
    setSubmitting("confirm");
    try {
      await patchJson(`/api/document-extractions/${extraction.id}`, { action: "confirm", fields });
      toast.success("Passport details applied to the passenger record.");
      onResolved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't apply these details. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    setSubmitting("reject");
    try {
      await patchJson(`/api/document-extractions/${extraction.id}`, { action: "reject" });
      toast.success("Extraction rejected — nothing was changed on the passenger.");
      onResolved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't reject this extraction. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-glass-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-accent">
          <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
          Passport details extracted — review before saving
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", extraction.mrzValid ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
          {extraction.mrzRaw ? (extraction.mrzValid ? "MRZ verified" : "MRZ found — checksum mismatch, double-check") : "No MRZ found — visual reading only"}
        </span>
      </div>
      {isPlaceholderProvider ? (
        <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          SAMPLE data — no real OCR provider configured yet, this is placeholder output, not read from the uploaded image.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Full Name" name="fullName" value={fields.fullName ?? ""} onChange={(e) => setFields({ ...fields, fullName: e.target.value })} />
        <TextField
          label="Passport Number"
          name="passportNumber"
          value={fields.passportNumber ?? ""}
          onChange={(e) => setFields({ ...fields, passportNumber: e.target.value })}
        />
        <TextField label="Nationality" name="nationality" value={fields.nationality ?? ""} onChange={(e) => setFields({ ...fields, nationality: e.target.value })} />
        <TextField label="Date of Birth" name="dob" type="date" value={fields.dob ?? ""} onChange={(e) => setFields({ ...fields, dob: e.target.value })} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleReject()} isLoading={submitting === "reject"} disabled={submitting !== null}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Reject
        </Button>
        <Button type="button" size="sm" onClick={() => void handleConfirm()} isLoading={submitting === "confirm"} disabled={submitting !== null}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Confirm &amp; Apply
        </Button>
      </div>
    </div>
  );
}

/**
 * Sits inside each passenger card on the Lead detail page — lets staff
 * upload a passport photo directly (or shows whatever the customer already
 * attached at submission time) and review/edit/confirm the OCR-extracted
 * fields before anything touches the Passenger record. See
 * src/lib/ocr/extract-passport.ts and /api/document-extractions/[id] — no
 * path from OCR to the database skips this review step.
 */
export function PassportExtractionReview({ passengerId }: { passengerId: string }) {
  const [extractions, setExtractions] = useState<ExtractionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    try {
      const result = await getJson<ExtractionData[]>(`/api/document-extractions?passengerId=${passengerId}`);
      setExtractions(result);
    } catch {
      // Non-critical — the passenger card still renders fine without this section populated.
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getJson<ExtractionData[]>(`/api/document-extractions?passengerId=${passengerId}`);
        if (cancelled) return;
        setExtractions(result);
      } catch {
        // Non-critical — the passenger card still renders fine without this section populated.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [passengerId]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    setUploading(true);
    try {
      const { base64, mimeType } = await toBase64(file);
      await postJson(`/api/passengers/${passengerId}/passport-photo`, { imageBase64: base64, mimeType });
      toast.success("Passport photo uploaded — extracting details...");
      await reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload that photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return null;

  const pending = extractions.find((extraction) => extraction.status === "PENDING_REVIEW");

  return (
    <div className="mt-3 flex flex-col gap-2">
      {pending ? (
        <ReviewCard extraction={pending} onResolved={() => void reload()} />
      ) : (
        <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-glass-border hover:bg-white/[0.03]">
          <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
          {uploading ? "Uploading..." : "Upload Passport Photo (auto-extract)"}
          <input type="file" accept={ALLOWED_TYPES.join(",")} className="hidden" disabled={uploading} onChange={(e) => void handleUpload(e)} />
        </label>
      )}
    </div>
  );
}
