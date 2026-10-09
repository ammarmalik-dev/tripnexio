"use client";

import { useState, type ChangeEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { OUTPUT_TYPES, OUTPUT_TYPE_LABELS, isOutputType, type OutputType } from "@/lib/outputs/output-types";
import { cn } from "@/lib/cn";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
const MAX_BYTES = 3 * 1024 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

interface DeliveredDocument {
  id: string;
  type: string;
  passengerId: string | null;
  fileUrl: string | null;
  deliveredAt?: string | null;
  /** P27 - set when the retention job deleted the file. */
  purgedAt?: string | null;
}

/**
 * P09 — "Upload & Deliver" on Booking detail: pick what's being delivered and
 * for whom, upload the file, and the customer gets it by WhatsApp + email
 * (the booking also moves to its service's matching status). Lists what's
 * already been delivered, with the time.
 */
export function DeliverOutputSection({
  bookingId,
  passengers,
  documents,
  onDelivered,
  defaultOutputType = "VISA_PDF",
  allowedOutputTypes = OUTPUT_TYPES,
}: {
  bookingId: string;
  passengers: { id: string; fullName: string }[];
  documents: DeliveredDocument[];
  onDelivered: () => void;
  /** P17 — the output this booking's service normally delivers. */
  defaultOutputType?: OutputType;
  /** Client testing 2026-10-09 (E11) — only this service's outputs; one = picked automatically. */
  allowedOutputTypes?: readonly OutputType[];
}) {
  const [outputType, setOutputType] = useState<OutputType>(defaultOutputType);
  const [passengerId, setPassengerId] = useState(passengers[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const delivered = documents.filter((document) => isOutputType(document.type) && document.deliveredAt);
  const passengerName = (id: string | null) => passengers.find((p) => p.id === id)?.fullName ?? "Whole booking";

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setFileError(null);
    if (picked && !ALLOWED_TYPES.includes(picked.type)) {
      setFileError("Use a PDF or an image (JPEG, PNG, GIF, WebP).");
      setFile(null);
      return;
    }
    if (picked && picked.size > MAX_BYTES) {
      setFileError("That file is larger than 3MB.");
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const deliver = async () => {
    if (!file) return;
    setSending(true);
    try {
      const fileBase64 = await readAsBase64(file);
      await postJson(`/api/bookings/${bookingId}/outputs`, { outputType, passengerId: passengerId || null, fileBase64 });
      toast.success(`${OUTPUT_TYPE_LABELS[outputType]} delivered to the customer.`);
      setFile(null);
      setInputKey((n) => n + 1);
      onDelivered();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't deliver this document. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Deliver to customer</h2>
        <span className="text-xs text-ink-tertiary">Sent by WhatsApp and email with a secure link.</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <FormField label="Document" htmlFor="deliver-type">
          {allowedOutputTypes.length === 1 ? (
            <p id="deliver-type" className={cn(fieldControlClass, fieldBorderClass(false), "flex items-center bg-surface-2 font-medium")}>
              {OUTPUT_TYPE_LABELS[allowedOutputTypes[0]]}
            </p>
          ) : (
            <select
              id="deliver-type"
              value={outputType}
              disabled={sending}
              onChange={(e) => setOutputType(e.target.value as OutputType)}
              className={cn(fieldControlClass, fieldBorderClass(false))}
            >
              {allowedOutputTypes.map((type) => (
                <option key={type} value={type}>
                  {OUTPUT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="For" htmlFor="deliver-passenger">
          <select
            id="deliver-passenger"
            value={passengerId}
            disabled={sending}
            onChange={(e) => setPassengerId(e.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false))}
          >
            {passengers.map((passenger) => (
              <option key={passenger.id} value={passenger.id}>
                {passenger.fullName}
              </option>
            ))}
            <option value="">Whole booking</option>
          </select>
        </FormField>
        <FormField label="File" htmlFor="deliver-file" error={fileError ?? undefined}>
          <input
            key={inputKey}
            id="deliver-file"
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            disabled={sending}
            onChange={handleFile}
            className="text-sm text-ink-secondary"
          />
        </FormField>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={() => void deliver()} isLoading={sending} disabled={!file}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Upload &amp; Deliver
        </Button>
      </div>

      {delivered.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-hairline pt-3">
          {delivered.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-ink-primary">
                {OUTPUT_TYPE_LABELS[document.type as OutputType]} · {passengerName(document.passengerId)}
              </span>
              <span className="flex items-center gap-3 text-xs text-ink-tertiary">
                Delivered {new Date(document.deliveredAt as string).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {document.fileUrl ? (
                  <a href={document.fileUrl} target="_blank" rel="noopener noreferrer" className="text-ink-accent underline">
                    View
                  </a>
                ) : document.purgedAt ? (
                  <span>Deleted after retention period</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
