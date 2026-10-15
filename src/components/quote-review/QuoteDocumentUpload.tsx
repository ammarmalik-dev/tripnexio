"use client";

import { useState } from "react";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

export interface UploadPassengerView {
  id: string;
  fullName: string;
  documents: { type: string; status: string }[];
}

const TYPES = [
  { type: "PASSPORT", label: "Passport copy" },
  { type: "VISA_COPY", label: "Current visa copy" },
] as const;

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/png", "image/jpeg"];

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Uploaded — under review",
  VERIFIED: "Validated",
  REJECTED: "Rejected — please upload again",
};

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Client doc 2026-10-15 — Visa Extension / Visa Change: each passenger's
 * passport and current visa copy, uploaded from the quote link before the
 * quotation (PDF, PNG or JPG, 3MB max). Our team validates them and then
 * shares the quotation.
 */
export function QuoteDocumentUpload({ token, passengers }: { token: string; passengers: UploadPassengerView[] }) {
  const [state, setState] = useState(passengers);
  const [busy, setBusy] = useState<string | null>(null);

  const upload = async (passengerId: string, type: string, file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please upload a PDF, PNG or JPG file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That file is larger than 3MB. Please upload a smaller copy.");
      return;
    }
    const key = `${passengerId}:${type}`;
    setBusy(key);
    try {
      const fileBase64 = await readAsBase64(file);
      const saved = await postJson<{ passengerId: string; type: string; status: string }>(`/api/quote/${token}/documents`, {
        passengerId,
        type,
        fileBase64,
        mimeType: file.type,
      });
      setState((current) =>
        current.map((passenger) =>
          passenger.id === passengerId
            ? { ...passenger, documents: [...passenger.documents.filter((doc) => doc.type !== type), { type, status: saved.status }] }
            : passenger
        )
      );
      toast.success("Uploaded. Our team will validate it.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "We couldn't upload that file. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (state.length === 0) return null;

  return (
    <section aria-labelledby="quote-docs-heading" className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div>
        <h2 id="quote-docs-heading" className="text-base font-semibold text-ink-heading">
          Upload your documents
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Upload each passenger&apos;s passport and current visa copy (PDF, PNG or JPG, under 3MB). Our team will validate the documents and share your quotation.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {state.map((passenger) => (
          <li key={passenger.id} className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
            <p className="text-sm font-medium text-ink-primary">{passenger.fullName}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TYPES.map((entry) => {
                const doc = passenger.documents.find((item) => item.type === entry.type);
                const key = `${passenger.id}:${entry.type}`;
                const done = doc && doc.status !== "REJECTED";
                return (
                  <div key={entry.type} className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-primary">{entry.label}</p>
                      <p className={cn("text-xs", doc?.status === "REJECTED" ? "text-error" : done ? "text-success" : "text-ink-tertiary")}>
                        {doc ? (STATUS_LABELS[doc.status] ?? doc.status) : "Not uploaded yet"}
                      </p>
                    </div>
                    <label
                      className={cn(
                        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-on-dark-primary focus-within:ring-2 focus-within:ring-accent",
                        done ? "bg-ink-secondary/70" : "bg-accent"
                      )}
                    >
                      {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <FileUp className="h-3.5 w-3.5" aria-hidden="true" />}
                      {done ? "Replace" : "Choose file"}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                        className="sr-only"
                        disabled={busy !== null}
                        aria-label={`${entry.label} for ${passenger.fullName}`}
                        onChange={(event) => {
                          void upload(passenger.id, entry.type, event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
