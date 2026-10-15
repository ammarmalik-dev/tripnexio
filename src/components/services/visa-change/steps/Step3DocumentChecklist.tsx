"use client";

import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FileText, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { PassportUploadField } from "@/components/forms/PassportUploadField";
import type { VisaChangeRequestValues } from "@/lib/validation/visa-change-schema";
import { useNationalities } from "@/lib/use-nationalities";

interface DocumentRequirementItem {
  id: string;
  documentName: string;
  required: boolean;
}

/**
 * Visa_Change.md §11: the Admin-configured document checklist (no final
 * pricing here). Client doc 2026-10-15 (E2) — one checklist per passenger,
 * from that passenger's own nationality (passengers may hold different
 * passports). Each applicant's current visa copy is uploaded here; any other
 * documents on the checklist are requested by staff after review.
 */
export function Step3DocumentChecklist() {
  const {
    getValues,
    control,
    formState: { errors },
  } = useFormContext<VisaChangeRequestValues>();
  const { options: nationalities } = useNationalities();
  const additionalPassengers = useWatch({ control, name: "additionalPassengers" }) ?? [];
  const travellers = [
    { fullName: getValues("fullName") || "You", nationalityId: getValues("nationalityId") },
    ...additionalPassengers.map((passenger, index) => ({ fullName: passenger.fullName || `Passenger ${index + 2}`, nationalityId: passenger.nationalityId })),
  ];
  const nationalityIds = [...new Set(travellers.map((traveller) => traveller.nationalityId).filter(Boolean))];
  const nationalityKey = nationalityIds.join(",");
  const [itemsByNationality, setItemsByNationality] = useState<Record<string, DocumentRequirementItem[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ids = nationalityKey ? nationalityKey.split(",") : [];
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/document-requirements?nationalityId=${encodeURIComponent(id)}&serviceType=VISA_CHANGE`);
            if (!res.ok) return [id, []] as const;
            const json = (await res.json()) as { data: DocumentRequirementItem[] };
            return [id, json.data] as const;
          } catch {
            return [id, []] as const;
          }
        })
      );
      if (!cancelled) setItemsByNationality(Object.fromEntries(entries));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [nationalityKey]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-heading">Documents you&apos;ll likely need</p>
          <p className="text-xs text-ink-tertiary">For each passenger, based on their own nationality.</p>
        </div>
      </div>

      {itemsByNationality === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        travellers.map((traveller, index) => {
          const items = itemsByNationality[traveller.nationalityId] ?? [];
          const nationality = nationalities.find((option) => option.id === traveller.nationalityId)?.name ?? "—";
          return (
            <div key={index} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-ink-primary">
                {traveller.fullName} <span className="text-xs font-normal text-ink-tertiary">· {nationality}</span>
              </p>
              {items.length === 0 ? (
                <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
                  Our team will confirm the exact document checklist for this nationality once we review your request.
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
            </div>
          );
        })
      )}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink-heading">Upload the current visa copy</p>
        <p className="text-xs text-ink-tertiary">Passport pages and photo are uploaded after payment.</p>
        <PassportUploadField
          base64FieldName="visaImageBase64"
          mimeFieldName="visaImageMimeType"
          label={`Visa copy — ${getValues("fullName") || "You"}`}
          description="Upload a clear photo of the current visa page."
          required
          error={errors.visaImageBase64?.message}
        />
        {additionalPassengers.map((passenger, index) => (
          <div key={index} className="flex flex-col gap-3">
            <PassportUploadField
              base64FieldName={`additionalPassengers.${index}.visaImageBase64`}
              mimeFieldName={`additionalPassengers.${index}.visaImageMimeType`}
              label={`Visa copy — ${passenger.fullName || `Passenger ${index + 2}`}`}
              description="Upload a clear photo of this passenger's current visa page."
              required
              error={errors.additionalPassengers?.[index]?.visaImageBase64?.message}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-tertiary">
        Our team validates each applicant&apos;s details and passport copy before sending your quotation. Any other
        documents on the checklist are requested after review — existing valid documents on file can be reused.
      </p>
    </div>
  );
}
