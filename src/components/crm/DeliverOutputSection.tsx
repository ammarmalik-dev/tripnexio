"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { FilePickerButton } from "@/components/forms/FilePickerButton";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { OUTPUT_TYPES, OUTPUT_TYPE_LABELS, isOutputType, type OutputType } from "@/lib/outputs/output-types";
import { cn } from "@/lib/cn";

/** Client doc 2026-10-20 (L1) — PDF, PNG or JPG. */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

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
 * (the booking also moves to its service's matching status). Client doc
 * 2026-10-20 (B5): every passenger is listed with Delivered / Pending, staff
 * tick the pending ones this file is for (one file may cover several), with a
 * coloured Choose File button.
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
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const delivered = documents.filter((document) => isOutputType(document.type) && document.deliveredAt);
  const passengerName = (id: string | null) => passengers.find((p) => p.id === id)?.fullName ?? "Whole booking";
  const deliveredFor = (passengerId: string) =>
    delivered.some((document) => document.type === outputType && (document.passengerId === passengerId || document.passengerId === null));
  const pendingIds = passengers.filter((passenger) => !deliveredFor(passenger.id)).map((passenger) => passenger.id);
  // A single passenger / single pending passenger needs no choice.
  const chosen = passengers.length <= 1 ? passengers.map((p) => p.id) : selected.length > 0 ? selected : pendingIds.length === 1 ? pendingIds : [];

  const handleFile = (picked: File | null) => {
    setFileError(null);
    if (picked && !ALLOWED_TYPES.includes(picked.type)) {
      setFileError("Use a PDF, PNG or JPG file.");
      setFile(null);
      return;
    }
    if (picked && picked.size > MAX_BYTES) {
      setFileError("That file is larger than 8MB.");
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const deliver = async () => {
    if (!file || chosen.length === 0) return;
    setSending(true);
    try {
      const fileBase64 = await readAsBase64(file);
      await postJson(`/api/bookings/${bookingId}/outputs`, { outputType, passengerId: chosen[0] ?? null, passengerIds: chosen, fileBase64 });
      toast.success(`${OUTPUT_TYPE_LABELS[outputType]} delivered to the customer.`);
      setFile(null);
      setSelected([]);
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
      <div className="flex flex-col gap-3">
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
              className={cn(fieldControlClass, fieldBorderClass(false), "sm:max-w-xs")}
            >
              {allowedOutputTypes.map((type) => (
                <option key={type} value={type}>
                  {OUTPUT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          )}
        </FormField>

        {passengers.length > 1 ? (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium text-ink-heading">For (tick the passengers this file is for)</legend>
            {passengers.map((passenger) => {
              const done = deliveredFor(passenger.id);
              return (
                <label key={passenger.id} className="flex items-center gap-2 text-sm text-ink-primary">
                  <input type="checkbox" checked={chosen.includes(passenger.id)} disabled={sending || done} onChange={() => toggle(passenger.id)} />
                  {passenger.fullName}
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", done ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                    {done ? "Delivered" : "Pending"}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : null}

        <FormField label="File (PDF, PNG or JPG)" htmlFor="deliver-file" error={fileError ?? undefined}>
          <FilePickerButton id="deliver-file" accept={ALLOWED_TYPES.join(",")} fileName={file?.name ?? null} onFile={handleFile} disabled={sending} />
        </FormField>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={() => void deliver()} isLoading={sending} disabled={!file || chosen.length === 0}>
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
