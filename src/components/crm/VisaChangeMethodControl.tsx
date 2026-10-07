"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { patchJson, ApiError } from "@/lib/api/client";

const LABELS = { AIRPORT_TO_AIRPORT: "Airport-to-Airport", BORDER_EXIT: "Border Exit" } as const;
type Method = keyof typeof LABELS;

/**
 * Client corrections 2026-10-05 §8 — staff switch a Visa Change lead between
 * Airport-to-Airport and Border Exit (reason required, audited; open
 * quotation options for the old method are expired). Hidden once a booking
 * exists.
 */
export function VisaChangeMethodControl({ leadId, method, onChanged }: { leadId: string; method: Method | null; onChanged: () => void }) {
  const [pending, setPending] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const target: Method = method === "AIRPORT_TO_AIRPORT" ? "BORDER_EXIT" : "AIRPORT_TO_AIRPORT";

  const switchMethod = async () => {
    const reason = await confirm({
      title: `Switch this lead to ${LABELS[target]}?`,
      description: `The ${method ? LABELS[method] : "current"} details stay on record, and any open quotation options are expired — fill the ${LABELS[target]} details and quote again.`,
      confirmLabel: `Switch to ${LABELS[target]}`,
    });
    if (!reason) return;
    setPending(true);
    try {
      await patchJson(`/api/leads/${leadId}/visa-change-method`, { changeType: target, reason });
      toast.success(`Switched to ${LABELS[target]}.`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't switch the method. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3">
      <p className="text-sm text-ink-secondary">
        Visa Change method: <span className="font-semibold text-ink-heading">{method ? LABELS[method] : "Not set"}</span>
      </p>
      <Button type="button" size="sm" variant="ghost" onClick={() => void switchMethod()} isLoading={pending}>
        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
        Switch to {LABELS[target]}
      </Button>
      {dialog}
    </div>
  );
}
