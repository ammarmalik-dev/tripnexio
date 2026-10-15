"use client";

import { useState } from "react";
import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface RequestRow {
  passengerId: string;
  documentName: string;
  reason: string;
}

/**
 * P11 / client doc 2026-10-15 (I6) — ask for extra documents, for one or more
 * passengers at once, each with a reason. The customer gets ONE WhatsApp /
 * email listing which passenger needs which document, with the secure upload
 * link; a collection Task is created for staff per document.
 */
export function RequestDocumentForm({
  bookingId,
  passengers,
  onRequested,
}: {
  bookingId: string;
  passengers: { id: string; fullName: string }[];
  onRequested: () => void;
}) {
  const blankRow = (): RequestRow => ({ passengerId: passengers[0]?.id ?? "", documentName: "", reason: "" });
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RequestRow[]>(() => [blankRow()]);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)} disabled={passengers.length === 0}>
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        Request documents
      </Button>
    );
  }

  const update = (index: number, patch: Partial<RequestRow>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const valid = rows.every((row) => row.passengerId && row.documentName.trim().length >= 2 && row.reason.trim().length >= 3);

  const submit = async () => {
    setSaving(true);
    try {
      await postJson(`/api/bookings/${bookingId}/document-requests`, {
        items: rows.map((row) => ({ passengerId: row.passengerId, documentName: row.documentName.trim(), reason: row.reason.trim() })),
      });
      toast.success(
        rows.length > 1
          ? "Documents requested — the customer has been sent one message with the upload link."
          : "Document requested — the customer has been sent an upload link."
      );
      setRows([blankRow()]);
      setOpen(false);
      onRequested();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't request these documents. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const control = cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-hairline p-3">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_36px] gap-2 px-1 text-xs font-medium text-ink-secondary sm:grid">
        <span>Passenger</span>
        <span>Document</span>
        <span>Reason (shown to the customer)</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_36px]">
          <select
            aria-label={`Passenger for request ${index + 1}`}
            value={row.passengerId}
            disabled={saving}
            onChange={(e) => update(index, { passengerId: e.target.value })}
            className={control}
          >
            {passengers.map((passenger) => (
              <option key={passenger.id} value={passenger.id}>
                {passenger.fullName}
              </option>
            ))}
          </select>
          <input
            aria-label={`Document for request ${index + 1}`}
            placeholder="e.g. Bank statement"
            value={row.documentName}
            disabled={saving}
            onChange={(e) => update(index, { documentName: e.target.value })}
            className={control}
          />
          <input
            aria-label={`Reason for request ${index + 1}`}
            placeholder="Why it is needed"
            value={row.reason}
            disabled={saving}
            onChange={(e) => update(index, { reason: e.target.value })}
            className={control}
          />
          <button
            type="button"
            disabled={rows.length === 1 || saving}
            onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
            aria-label={`Remove request ${index + 1}`}
            className="flex h-9 items-center justify-center rounded-md text-ink-tertiary hover:text-error disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setRows((current) => [...current, blankRow()])} disabled={saving || rows.length >= 20}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add another
        </Button>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void submit()} isLoading={saving} disabled={!valid}>
            Send request
          </Button>
        </div>
      </div>
    </div>
  );
}
