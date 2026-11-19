"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/forms/DateField";
import { AirportSearchField } from "@/components/forms/AirportSearchField";
import { ConfirmActionDialog } from "@/components/crm/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { ApiError, patchJson } from "@/lib/api/client";
import { leadDetailsEditSchema, type LeadDetailsEditValues } from "@/lib/validation/lead-details-edit-schema";
import type { ServiceType } from "@/generated/prisma/enums";

function text(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

/**
 * Client doc 16 Nov (J11) — "Edit details" on a manual lead: the service's own fields in one form (travel date, the
 * flight route and return date, visa expiry, expected return date). Saving asks for a reason (audited). Passengers are
 * edited in Applicants — there is no separate Add Passenger on a manual lead.
 */
export function LeadDetailsEditor({
  leadId,
  serviceType,
  details,
  onSaved,
}: {
  leadId: string;
  serviceType: ServiceType;
  details: Record<string, unknown>;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<LeadDetailsEditValues | null>(null);
  const [saving, setSaving] = useState(false);
  const isFlight = serviceType === "FLIGHT_SPECIAL_FARE";
  const isVisaStatus = serviceType === "VISA_EXTENSION" || serviceType === "VISA_CHANGE";
  const isReturnTicket = serviceType === "RETURN_TICKET";
  const methods = useForm<LeadDetailsEditValues>({
    resolver: zodResolver(leadDetailsEditSchema),
    defaultValues: {
      travelDate: text(details.travelDate),
      origin: typeof details.origin === "string" ? details.origin : "",
      destination: typeof details.destination === "string" ? details.destination : "",
      returnDate: text(details.returnDate),
      visaExpiryDate: text(serviceType === "VISA_CHANGE" ? details.visaLastDate : details.visaExpiryDate),
      expectedReturnDate: text(details.expectedReturnDate),
    },
  });
  const {
    register,
    formState: { errors },
  } = methods;

  const save = async (reason: string) => {
    if (!pending) return;
    setSaving(true);
    try {
      const result = await patchJson<{ changed: boolean }>(`/api/leads/${leadId}/details`, { ...pending, reason });
      toast.success(result.changed ? "Lead details updated." : "Nothing changed.");
      setPending(null);
      setOpen(false);
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages?.[0]) methods.setError(field as keyof LeadDetailsEditValues, { type: "server", message: messages[0] });
        }
      }
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the lead details.");
      setPending(null);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Edit details
      </Button>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="flex w-full flex-col gap-4 rounded-lg border border-hairline bg-surface-2 p-4">
        {isFlight ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AirportSearchField name="origin" label="Departure City / Airport" required error={errors.origin?.message} />
            <AirportSearchField name="destination" label="Arrival City / Airport" required error={errors.destination?.message} />
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isVisaStatus ? null : <DateField {...register("travelDate")} name="travelDate" label="Travel Date" required error={errors.travelDate?.message} />}
          {isFlight ? (
            <DateField {...register("returnDate")} name="returnDate" label="Return Date (round trip only)" hint="Leave empty for a one-way flight." error={errors.returnDate?.message} />
          ) : null}
          {isVisaStatus ? <DateField {...register("visaExpiryDate")} name="visaExpiryDate" label="Visa Expiry Date" required error={errors.visaExpiryDate?.message} /> : null}
          {isReturnTicket ? (
            <DateField {...register("expectedReturnDate")} name="expectedReturnDate" label="Expected Return Date" required error={errors.expectedReturnDate?.message} />
          ) : null}
        </div>
        <p className="text-xs text-ink-tertiary">Passenger names and details are edited in Applicants.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={methods.handleSubmit((values) => setPending(values))} isLoading={saving}>
            Save details
          </Button>
        </div>
      </div>
      {pending ? (
        <ConfirmActionDialog
          title="Save the lead details?"
          description="The changes and your reason are saved in the lead's audit log."
          confirmLabel="Save details"
          pending={saving}
          onConfirm={(reason) => void save(reason)}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </FormProvider>
  );
}
