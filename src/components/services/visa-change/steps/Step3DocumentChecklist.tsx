"use client";

import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FileText, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { PassportUploadField } from "@/components/forms/PassportUploadField";
import type { VisaChangeRequestValues } from "@/lib/validation/visa-change-schema";

interface DocumentRequirementItem {
  id: string;
  documentName: string;
  required: boolean;
}

/**
 * Visa_Change.md §11: the Admin-configured document checklist for the
 * nationality (no final pricing here). Per the client's updated Visa Change
 * handover, each applicant's passport copy is now uploaded HERE, before the
 * Lead is created (this supersedes §20's upload-after-payment for the
 * passport copy); any other documents on the checklist are still requested by
 * staff after review.
 */
export function Step3DocumentChecklist() {
  const {
    getValues,
    control,
    formState: { errors },
  } = useFormContext<VisaChangeRequestValues>();
  const nationality = getValues("nationality");
  const additionalPassengers = useWatch({ control, name: "additionalPassengers" }) ?? [];
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

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink-heading">Upload passport copies</p>
        <PassportUploadField
          base64FieldName="passportImageBase64"
          mimeFieldName="passportImageMimeType"
          label={`Passport copy — ${getValues("fullName") || "You"}`}
          description="Upload a clear photo of the passport main page."
          required
          error={errors.passportImageBase64?.message}
        />
        {additionalPassengers.map((passenger, index) => (
          <PassportUploadField
            key={index}
            base64FieldName={`additionalPassengers.${index}.passportImageBase64`}
            mimeFieldName={`additionalPassengers.${index}.passportImageMimeType`}
            label={`Passport copy — ${passenger.fullName || `Passenger ${index + 2}`}`}
            description="Upload a clear photo of this passenger's passport main page."
            required
            error={errors.additionalPassengers?.[index]?.passportImageBase64?.message}
          />
        ))}
      </div>
      <p className="text-xs text-ink-tertiary">
        Our team validates each applicant&apos;s details and passport copy before sending your quotation. Any other
        documents on the checklist are requested after review — existing valid documents on file can be reused.
      </p>
    </div>
  );
}
