"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { ApiError, patchJson } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * "Change service" on the lead header (client request 2026-10-03) — e.g. an
 * "Other" enquiry that turns out to be a New Visa request. Only offered
 * before any quotation/booking exists (the API enforces the same rule) and
 * needs a reason.
 */
export function LeadServiceTypeControl({
  leadId,
  serviceType,
  onChanged,
}: {
  leadId: string;
  serviceType: ServiceType;
  onChanged: (serviceType: ServiceType) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState<ServiceType | "">("");
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const options = SERVICE_TYPE_OPTIONS.filter((option) => option.value !== "OTHER" && option.value !== serviceType);

  const save = async () => {
    if (!next) return;
    const reason = await confirm({
      title: `Change this lead to ${SERVICE_TYPE_LABELS[next]}?`,
      description: `The lead moves from ${SERVICE_TYPE_LABELS[serviceType]} to ${SERVICE_TYPE_LABELS[next]} and starts at that service's first status. Its reference stays the same.`,
      confirmLabel: "Change service",
    });
    if (!reason) return;
    setSaving(true);
    try {
      await patchJson(`/api/leads/${leadId}/service-type`, { serviceType: next, reason });
      toast.success(`Lead changed to ${SERVICE_TYPE_LABELS[next]}.`);
      setEditing(false);
      setNext("");
      onChanged(next);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't change the service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-accent-on-light hover:underline"
        aria-label="Change the lead's service"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
        Change service
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dialog}
      <select
        aria-label="New service"
        value={next}
        onChange={(event) => setNext(event.target.value as ServiceType | "")}
        disabled={saving}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto py-1 text-xs")}
      >
        <option value="">Choose a service…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!next}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
        Cancel
      </Button>
    </div>
  );
}
