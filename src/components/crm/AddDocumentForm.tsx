"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface AddDocumentFormProps {
  bookingId: string;
  passengers: { id: string; fullName: string }[];
  onAdded: () => void;
}

/** e.g. "PASSPORT", "VISA_COPY", "TICKET" — Document.type is free text since the set varies per service. */
export function AddDocumentForm({ bookingId, passengers, onAdded }: AddDocumentFormProps) {
  const [type, setType] = useState("");
  const [passengerId, setPassengerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!type.trim()) return;
    setSubmitting(true);
    try {
      await postJson("/api/documents", { bookingId, passengerId: passengerId || undefined, type: type.trim() });
      toast.success("Document requirement added.");
      setType("");
      setPassengerId("");
      onAdded();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this document. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <TextField
        label="Document Type"
        name="documentType"
        placeholder="e.g. PASSPORT"
        value={type}
        onChange={(event) => setType(event.target.value)}
        className="w-48"
      />
      {passengers.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-doc-passenger" className="text-sm font-medium text-ink-heading">
            Passenger (optional)
          </label>
          <select
            id="add-doc-passenger"
            value={passengerId}
            onChange={(event) => setPassengerId(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-11 w-48")}
          >
            <option value="">None</option>
            {passengers.map((passenger) => (
              <option key={passenger.id} value={passenger.id}>
                {passenger.fullName}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Button type="submit" size="sm" isLoading={submitting} disabled={!type.trim()}>
        Add
      </Button>
    </form>
  );
}
