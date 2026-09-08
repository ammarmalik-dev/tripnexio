"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { FileText, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { VisaChangeRequestValues } from "@/lib/validation/visa-change-schema";

interface DocumentRequirementItem {
  id: string;
  documentName: string;
  required: boolean;
}

/**
 * Visa_Change.md §11: "After nationality is available, show the applicable
 * Admin-configured document checklist. Do NOT show final pricing at this
 * stage." Informational only — actual upload happens after payment (§20),
 * so this step never blocks continuing.
 */
export function Step3DocumentChecklist() {
  const { getValues } = useFormContext<VisaChangeRequestValues>();
  const nationality = getValues("nationality");
  const [items, setItems] = useState<DocumentRequirementItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/document-requirements?nationality=${encodeURIComponent(nationality)}&serviceType=VISA_CHANGE`
        );
        if (!res.ok) {
          if (!cancelled) setItems([]);
          return;
        }
        const json = (await res.json()) as { data: DocumentRequirementItem[] };
        if (!cancelled) setItems(json.data);
      } catch {
        if (!cancelled) setItems([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [nationality]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-heading">Documents you&apos;ll likely need</p>
          <p className="text-xs text-ink-tertiary">Based on nationality: {nationality || "—"}</p>
        </div>
      </div>

      {items === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
          Our team will confirm the exact document checklist for your nationality once we review your request.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span className="text-ink-primary">{item.documentName}</span>
              {!item.required ? <span className="text-xs text-ink-tertiary">(optional)</span> : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ink-tertiary">
        You don&apos;t need to upload anything yet — you&apos;ll be asked for these after your Visa Change package is
        confirmed and paid for. Existing valid documents on file can be reused.
      </p>
    </div>
  );
}
