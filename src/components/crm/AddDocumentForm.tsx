"use client";

import { useEffect, useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface AddDocumentFormProps {
  /** Omitted on a Lead (client corrections 2026-10-05): the document then belongs to the chosen passenger. */
  bookingId?: string;
  /** Client doc 2026-10-15 (I6) — on the lead page, the lead the document belongs to. */
  leadId?: string;
  passengers: { id: string; fullName: string }[];
  onAdded: () => void;
}

/**
 * Client testing 2026-10-09 (E10) — the document is picked from the Document
 * Master (Admin → Document Master), not typed. Only while the master is empty
 * or can't be read does the free-text box remain, so staff are never blocked.
 */
export function AddDocumentForm({ bookingId, leadId, passengers, onAdded }: AddDocumentFormProps) {
  const [type, setType] = useState("");
  const [masterTypes, setMasterTypes] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<{ id: string; name: string }[]>("/api/crm/document-types");
        if (!cancelled) setMasterTypes(result);
      } catch {
        if (!cancelled) setMasterTypes([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  const [passengerId, setPassengerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!type.trim()) return;
    setSubmitting(true);
    try {
      await postJson("/api/documents", { bookingId, leadId, passengerId: (passengerId || (bookingId ? "" : passengers[0]?.id)) || undefined, type: type.trim() });
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
      {masterTypes && masterTypes.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-doc-type" className="text-sm font-medium text-ink-heading">
            Document
          </label>
          <select
            id="add-doc-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-11 w-60")}
          >
            <option value="">Select from Document Master</option>
            {masterTypes.map((option) => (
              <option key={option.id} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <TextField
          label="Document Type"
          name="documentType"
          placeholder={masterTypes === null ? "Loading…" : "e.g. PASSPORT"}
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="w-48"
        />
      )}
      {passengers.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-doc-passenger" className="text-sm font-medium text-ink-heading">
            {bookingId ? "Passenger (optional)" : "Passenger"}
          </label>
          <select
            id="add-doc-passenger"
            value={passengerId}
            onChange={(event) => setPassengerId(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-11 w-48")}
          >
            {bookingId ? <option value="">None</option> : null}
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
