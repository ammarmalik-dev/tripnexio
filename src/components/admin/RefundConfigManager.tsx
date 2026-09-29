"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { ConfirmActionDialog } from "@/components/crm/ConfirmActionDialog";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { RefundCutoff, ServiceType } from "../../generated/prisma/enums";

interface RefundConfigRow {
  serviceType: ServiceType;
  fullRefundWindowHours: number | null;
  preValidationDeduction: number;
  postValidationDeduction: number;
  noRefundAfter: RefundCutoff;
}

interface FormState {
  fullRefundWindowHours: string;
  preValidationDeduction: string;
  postValidationDeduction: string;
  noRefundAfter: RefundCutoff;
}

const CUTOFF_OPTIONS: { value: RefundCutoff; label: string }[] = [
  { value: "NEVER", label: "No cutoff" },
  { value: "EXTERNAL_SUBMISSION", label: "After submission to embassy / airline / vendor" },
  { value: "PACKAGE_GENERATED", label: "After the service package is generated" },
];

type FetchState = "loading" | "success" | "error";

function toForm(row: RefundConfigRow): FormState {
  return {
    fullRefundWindowHours: row.fullRefundWindowHours === null ? "" : String(row.fullRefundWindowHours),
    preValidationDeduction: String(row.preValidationDeduction),
    postValidationDeduction: String(row.postValidationDeduction),
    noRefundAfter: row.noRefundAfter,
  };
}

function RefundConfigCard({ row, onSaved }: { row: RefundConfigRow; onSaved: (row: RefundConfigRow) => void }) {
  const [form, setForm] = useState<FormState>(toForm(row));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(row));

  const handleConfirm = async (reason: string) => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<RefundConfigRow>("/api/admin/refund-config", {
        serviceType: row.serviceType,
        fullRefundWindowHours: form.fullRefundWindowHours.trim() === "" ? null : Number(form.fullRefundWindowHours),
        preValidationDeduction: Number(form.preValidationDeduction),
        postValidationDeduction: Number(form.postValidationDeduction),
        noRefundAfter: form.noRefundAfter,
        reason,
      });
      toast.success(`Refund rule for ${SERVICE_TYPE_LABELS[row.serviceType]} updated.`);
      onSaved(updated);
      setConfirming(false);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the refund rule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectId = `refund-cutoff-${row.serviceType}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">{SERVICE_TYPE_LABELS[row.serviceType]}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Full-refund window (hours after payment)"
          name={`window-${row.serviceType}`}
          type="number"
          min={0}
          value={form.fullRefundWindowHours}
          onChange={(event) => setForm({ ...form, fullRefundWindowHours: event.target.value })}
          hint="Leave empty for no window. Inside it, only gateway charges are deducted."
          error={errors.fullRefundWindowHours?.[0]}
        />
        <FormField label="No refund after" htmlFor={selectId}>
          <select
            id={selectId}
            value={form.noRefundAfter}
            onChange={(event) => setForm({ ...form, noRefundAfter: event.target.value as RefundCutoff })}
            className={cn(fieldControlClass, fieldBorderClass(false))}
          >
            {CUTOFF_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <TextField
          label="Deduction before document validation (₹)"
          name={`pre-${row.serviceType}`}
          type="number"
          min={0}
          step="0.01"
          value={form.preValidationDeduction}
          onChange={(event) => setForm({ ...form, preValidationDeduction: event.target.value })}
          error={errors.preValidationDeduction?.[0]}
        />
        <TextField
          label="Deduction after document validation (₹)"
          name={`post-${row.serviceType}`}
          type="number"
          min={0}
          step="0.01"
          value={form.postValidationDeduction}
          onChange={(event) => setForm({ ...form, postValidationDeduction: event.target.value })}
          error={errors.postValidationDeduction?.[0]}
        />
      </div>
      <p className="text-xs text-ink-tertiary">Deductions are added on top of the gateway charge and any cancellation charge staff enter.</p>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setConfirming(true)} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
      {confirming ? (
        <ConfirmActionDialog
          title={`Change the ${SERVICE_TYPE_LABELS[row.serviceType]} refund rule?`}
          description="Refund rules decide how much customers get back. This change applies to every refund raised from now on and is recorded in the audit trail."
          confirmLabel="Confirm Change"
          pending={saving}
          onConfirm={(reason) => void handleConfirm(reason)}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}

/** P23 — optional `serviceType` (Service Configuration hub) shows only that service's rule. Absent = every service. */
export function RefundConfigManager({ serviceType }: { serviceType?: ServiceType } = {}) {
  const [state, setState] = useState<FetchState>("loading");
  const [rows, setRows] = useState<RefundConfigRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<RefundConfigRow[]>("/api/admin/refund-config");
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load refund rules. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load refund rules"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const visibleRows = serviceType ? rows.filter((row) => row.serviceType === serviceType) : rows;

  if (serviceType && visibleRows.length === 0) {
    return (
      <EmptyState
        title={`No refund rule for ${SERVICE_TYPE_LABELS[serviceType]}`}
        description="This service has no refund configuration row yet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {visibleRows.map((row) => (
        <RefundConfigCard
          key={row.serviceType}
          row={row}
          onSaved={(updated) => setRows((current) => current.map((entry) => (entry.serviceType === updated.serviceType ? updated : entry)))}
        />
      ))}
    </div>
  );
}
