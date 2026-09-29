"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { ServiceType } from "../../generated/prisma/enums";

export interface LinkedBookingView {
  id: string;
  bookingId: string;
  serviceType: ServiceType;
  statusName: string | null;
}

/**
 * P17 — CRM.md §15: the OTB <-> Return Verified Ticket pair. Shows the
 * linked booking (open it from here) or lets staff link the customer's
 * matching booking by its ID; linking writes an entry on both timelines.
 */
export function LinkedBookingPanel({
  bookingId,
  serviceType,
  linked,
  onChanged,
}: {
  bookingId: string;
  serviceType: ServiceType;
  linked: LinkedBookingView | null;
  onChanged: () => void;
}) {
  const [otherId, setOtherId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const partnerLabel = serviceType === "OTB" ? "Return Verified Ticket" : "OTB";

  const link = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await postJson(`/api/bookings/${bookingId}/return-ticket-action`, { action: "LINK_BOOKING", otherBookingId: otherId });
      toast.success("Bookings linked.");
      setOtherId("");
      onChanged();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't link the bookings.";
      setError(err instanceof ApiError ? (err.fieldErrors?.otherBookingId?.[0] ?? message) : message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Linked {partnerLabel} booking</h2>
      {linked ? (
        <p className="text-sm text-ink-secondary">
          <Link href={`/crm/bookings/${linked.id}`} className="font-medium text-ink-accent hover:underline">
            {linked.bookingId}
          </Link>{" "}
          · {SERVICE_TYPE_LABELS[linked.serviceType]} · {linked.statusName ?? "no status yet"}
          {serviceType === "RETURN_TICKET" && linked.serviceType === "OTB" ? (
            <span className="block text-xs text-ink-tertiary">The reservation can be issued only after this OTB is approved.</span>
          ) : null}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <TextField
              label={`${partnerLabel} booking ID`}
              name={`link-${bookingId}`}
              placeholder="TNX-..."
              value={otherId}
              onChange={(event) => setOtherId(event.target.value)}
              error={error}
              disabled={saving}
            />
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => void link()} isLoading={saving} disabled={otherId.trim().length < 3}>
            Link
          </Button>
        </div>
      )}
    </section>
  );
}
