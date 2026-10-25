"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ApiError, postJson } from "@/lib/api/client";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

interface CopyResult {
  sourceCountryName: string;
  sourceRuleCount: number;
  creates: { sourceRuleId: string; targetCountryName: string; summary: string }[];
  skipped: { sourceRuleId: string; targetCountryName: string; summary: string; reason: string }[];
  created: number;
}

/**
 * Admin handover §3/§4 bulk apply — "Copy to other countries…" for the rule
 * set shown (one service + one country, narrowed by any other filter).
 * Preview first (nothing written), then confirm with a reason. Rules a target
 * country already has are skipped and listed, never overwritten.
 */
export function PricingRuleCopyPanel({
  serviceType,
  sourceCountryId,
  sourceCountryName,
  ruleIds,
  countries,
  onCopied,
}: {
  serviceType: ServiceType;
  sourceCountryId: string;
  sourceCountryName: string;
  ruleIds: string[];
  countries: { id: string; name: string; active: boolean }[];
  onCopied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<CopyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const term = search.trim().toLowerCase();
  const options = countries.filter((country) => country.active && country.id !== sourceCountryId && (!term || country.name.toLowerCase().includes(term)));
  const requestBody = { serviceType, sourceCountryId, targetCountryIds: [...targets], ruleIds };

  const toggle = (id: string) => {
    setPreview(null);
    setTargets((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runPreview = async () => {
    setBusy(true);
    try {
      setPreview(await postJson<CopyResult>("/api/admin/pricing-rules/copy", { ...requestBody, dryRun: true }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't preview the copy.");
    } finally {
      setBusy(false);
    }
  };

  const runCopy = async () => {
    if (!preview || preview.creates.length === 0) return;
    const reason = await confirm({
      title: `Create ${preview.creates.length} pricing rule${preview.creates.length === 1 ? "" : "s"}?`,
      description: `${SERVICE_TYPE_LABELS[serviceType]} prices from ${sourceCountryName} are copied unchanged to ${targets.size} countr${targets.size === 1 ? "y" : "ies"}.${preview.skipped.length > 0 ? ` ${preview.skipped.length} are skipped (listed in the preview).` : ""}`,
      confirmLabel: "Copy prices",
    });
    if (!reason) return;
    setBusy(true);
    try {
      const result = await postJson<CopyResult>("/api/admin/pricing-rules/copy", { ...requestBody, reason });
      toast.success(`${result.created} pricing rule${result.created === 1 ? "" : "s"} created.`);
      setOpen(false);
      setTargets(new Set());
      setPreview(null);
      onCopied();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't copy the pricing rules.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Copy className="h-4 w-4" aria-hidden="true" /> Copy {ruleIds.length} rule{ruleIds.length === 1 ? "" : "s"} to other countries…
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div>
        <p className="text-sm font-semibold text-ink-heading">
          Copy {ruleIds.length} {SERVICE_TYPE_LABELS[serviceType]} rule{ruleIds.length === 1 ? "" : "s"} from {sourceCountryName} to…
        </p>
        <p className="text-xs text-ink-tertiary">
          Copies the rules shown with the same prices. A country that already has a rule for the same combination keeps its own; New Visa
          product prices go to the matching product of each country.
        </p>
      </div>
      <input
        type="search"
        aria-label="Search countries to copy to"
        placeholder="Search country"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-full sm:w-64")}
      />
      <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {options.map((country) => (
          <label key={country.id} className="flex items-center gap-2 text-sm text-ink-primary">
            <input type="checkbox" checked={targets.has(country.id)} onChange={() => toggle(country.id)} disabled={busy} />
            {country.name}
          </label>
        ))}
        {options.length === 0 ? <p className="text-sm text-ink-tertiary">No countries match.</p> : null}
      </div>

      {preview ? (
        <div className="flex flex-col gap-2 rounded-lg border border-hairline p-3 text-sm">
          <p className="font-medium text-ink-heading">
            {preview.creates.length} rule{preview.creates.length === 1 ? "" : "s"} will be created
            {preview.skipped.length > 0 ? `, ${preview.skipped.length} skipped` : ""}.
          </p>
          {preview.skipped.length > 0 ? (
            <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-xs text-ink-secondary">
              {preview.skipped.map((entry) => (
                <li key={`${entry.sourceRuleId}:${entry.targetCountryName}`}>
                  <span className="font-medium">{entry.targetCountryName}</span> — {entry.summary}: {entry.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setPreview(null);
          }}
          disabled={busy}
        >
          Cancel
        </Button>
        {preview ? (
          <Button type="button" size="sm" onClick={() => void runCopy()} isLoading={busy} disabled={preview.creates.length === 0}>
            Copy {preview.creates.length} rule{preview.creates.length === 1 ? "" : "s"}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void runPreview()} isLoading={busy} disabled={targets.size === 0}>
            Preview
          </Button>
        )}
      </div>
      {dialog}
    </div>
  );
}
