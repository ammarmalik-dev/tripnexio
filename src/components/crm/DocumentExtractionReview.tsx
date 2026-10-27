"use client";

import { useEffect, useState } from "react";
import { ScanLine, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { OcrCrossCheck } from "./OcrCrossCheck";

type ExtractionType = "TICKET" | "VISA";
type ExtractedFields = Record<string, string | undefined>;

interface ExtractionData {
  id: string;
  extractionType: ExtractionType;
  provider: string;
  status: "PENDING_REVIEW" | "CONFIRMED" | "REJECTED";
  extractedFields: ExtractedFields;
  createdAt: string;
  /** Client doc 2026-10-15 (J4) — the check against the entered details. */
  crossCheck?: unknown;
}


/** CRM.md §17/§18 (Step 16) — the exact fields each type asks for, in display order. */
const FIELD_CONFIG: Record<ExtractionType, { key: string; label: string }[]> = {
  TICKET: [
    { key: "airline", label: "Airline" },
    { key: "flightNumber", label: "Flight Number" },
    { key: "pnr", label: "PNR" },
    { key: "passengerName", label: "Passenger" },
    { key: "departureAirport", label: "Departure Airport" },
    { key: "arrivalAirport", label: "Arrival Airport" },
    { key: "departureDate", label: "Departure Date" },
    { key: "departureTime", label: "Departure Time" },
    { key: "arrivalDate", label: "Arrival Date" },
    { key: "arrivalTime", label: "Arrival Time" },
    { key: "ticketNumber", label: "Ticket Number" },
    { key: "baggageAllowance", label: "Baggage" },
  ],
  VISA: [
    { key: "passengerName", label: "Passenger" },
    { key: "passportNumber", label: "Passport Number" },
    { key: "visaNumber", label: "Visa Number" },
    { key: "visaType", label: "Visa Type" },
    { key: "issueDate", label: "Issue Date" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "validity", label: "Validity" },
  ],
};

function ReviewCard({ extraction, onResolved }: { extraction: ExtractionData; onResolved: () => void }) {
  const [fields, setFields] = useState<ExtractedFields>(extraction.extractedFields);
  const [submitting, setSubmitting] = useState<"confirm" | "reject" | null>(null);
  const isPlaceholderProvider = extraction.provider.startsWith("placeholder");
  const config = FIELD_CONFIG[extraction.extractionType];

  const handleConfirm = async () => {
    setSubmitting("confirm");
    try {
      await patchJson(`/api/document-extractions/${extraction.id}`, { action: "confirm", fields });
      toast.success(`${extraction.extractionType === "TICKET" ? "Ticket" : "Visa"} details confirmed.`);
      onResolved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't confirm these details. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    setSubmitting("reject");
    try {
      await patchJson(`/api/document-extractions/${extraction.id}`, { action: "reject" });
      toast.success("Extraction rejected — nothing was saved.");
      onResolved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't reject this extraction. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-glass-border bg-surface-2 p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-accent">
        <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
        {extraction.extractionType === "TICKET" ? "Ticket" : "Visa"} details extracted — review before confirming
      </span>
      <OcrCrossCheck value={extraction.crossCheck} />
      {!isPlaceholderProvider && config.every((field) => !extraction.extractedFields[field.key]) ? (
        <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          No details could be read from this file. Enter them below, or upload a clearer copy.
        </p>
      ) : null}
      {isPlaceholderProvider ? (
        <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          SAMPLE data — no real OCR provider configured yet, this is placeholder output, not read from the uploaded document.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {config.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            name={field.key}
            value={fields[field.key] ?? ""}
            onChange={(e) => setFields({ ...fields, [field.key]: e.target.value })}
          />
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleReject()} isLoading={submitting === "reject"} disabled={submitting !== null}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Reject
        </Button>
        <Button type="button" size="sm" onClick={() => void handleConfirm()} isLoading={submitting === "confirm"} disabled={submitting !== null}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Confirm
        </Button>
      </div>
    </div>
  );
}

/**
 * Sits next to a TICKET/VISA-type document row on the Booking detail page —
 * shows the OCR-extracted fields for staff to review/edit/confirm before
 * anything is treated as final. Step 16 (audit §3.6). See
 * src/lib/ocr/{extract-ticket,extract-visa}.ts and
 * /api/document-extractions/[id] — no path from OCR to a confirmed record
 * skips this review step.
 *
 * Client doc 2026-10-27 (C9) — one upload button per document: the row's own
 * DocumentUploadButton (PATCH /api/documents/[id]/upload) already runs OCR for
 * passport / visa / ticket types, so this no longer has its own
 * "Upload … (auto-extract)" button. `refreshKey` (the row's file + status)
 * reloads the extraction after a new upload.
 */
export function DocumentExtractionReview({
  documentId,
  refreshKey,
}: {
  documentId: string;
  /** Changes whenever the document's file or status changes (e.g. `${fileUrl}|${status}`). */
  refreshKey?: string;
}) {
  const [extractions, setExtractions] = useState<ExtractionData[]>([]);

  const reload = async () => {
    try {
      const result = await getJson<ExtractionData[]>(`/api/document-extractions?documentId=${documentId}`);
      setExtractions(result);
    } catch {
      // Non-critical — the document row still renders fine without this section populated.
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getJson<ExtractionData[]>(`/api/document-extractions?documentId=${documentId}`);
        if (cancelled) return;
        setExtractions(result);
      } catch {
        // Non-critical.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [documentId, refreshKey]);

  const pending = extractions.find((extraction) => extraction.status === "PENDING_REVIEW");
  if (!pending) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <ReviewCard key={pending.id} extraction={pending} onResolved={() => void reload()} />
    </div>
  );
}
