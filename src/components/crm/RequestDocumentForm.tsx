"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

/**
 * P11 — ask one passenger for an extra document with a reason. The customer
 * gets WhatsApp/email with a secure upload link, and a collection Task is
 * created for staff.
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
  const [open, setOpen] = useState(false);
  const [passengerId, setPassengerId] = useState(passengers[0]?.id ?? "");
  const [documentName, setDocumentName] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)} disabled={passengers.length === 0}>
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        Request a document
      </Button>
    );
  }

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      await postJson(`/api/bookings/${bookingId}/document-requests`, { passengerId, documentName: documentName.trim(), reason: reason.trim() });
      toast.success("Document requested — the customer has been sent an upload link.");
      setDocumentName("");
      setReason("");
      setOpen(false);
      onRequested();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't request this document. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-hairline p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Passenger" htmlFor="request-doc-passenger" error={errors.passengerId?.[0]}>
          <select
            id="request-doc-passenger"
            value={passengerId}
            disabled={saving}
            onChange={(e) => setPassengerId(e.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.passengerId))}
          >
            {passengers.map((passenger) => (
              <option key={passenger.id} value={passenger.id}>
                {passenger.fullName}
              </option>
            ))}
          </select>
        </FormField>
        <TextField label="Document" name="request-doc-name" placeholder="e.g. Bank statement" value={documentName} onChange={(e) => setDocumentName(e.target.value)} error={errors.documentName?.[0]} disabled={saving} />
        <TextField label="Reason (shown to the customer)" name="request-doc-reason" value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason?.[0]} disabled={saving} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} isLoading={saving} disabled={documentName.trim().length < 2 || reason.trim().length < 3}>
          Send request
        </Button>
      </div>
    </div>
  );
}
