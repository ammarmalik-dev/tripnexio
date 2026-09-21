"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { SAMPLE_VISA_TYPE_OPTIONS } from "@/lib/sample-data";
import { useDestinationCountryOptions } from "@/lib/use-destination-countries";
import { getJson } from "@/lib/api/client";
import { GUARDIAN_RELATIONSHIP_LABELS, type NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

interface ProtectionPlanPublicConfig {
  defaultPrice: string;
  termsText: string;
  eligibilityConditions: string[];
}

/**
 * New_Visa.md §8 (Step 20, audit §7.1) — this is the customer flow's ONLY
 * touchpoint with Protection Plan: expressing interest + acknowledging the
 * terms at intake time, carried into Lead.details for staff to see. The
 * actual chargeable purchase only happens later once a real Booking (and
 * therefore a real per-passenger record) exists — see
 * src/app/api/leads/new-visa/route.ts's own comment.
 */
function ProtectionPlanOptIn() {
  const { watch, setValue } = useFormContext<NewVisaRequestValues>();
  const [config, setConfig] = useState<ProtectionPlanPublicConfig | null>(null);
  const interested = watch("protectionPlanInterested");
  const termsAccepted = watch("protectionPlanTermsAccepted");

  useEffect(() => {
    let cancelled = false;
    getJson<ProtectionPlanPublicConfig>("/api/protection-plan-config")
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        // Non-critical — Protection Plan is optional; the rest of the request still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) return null;

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-heading">Protection Plan (optional)</h3>
        <span className="text-sm font-medium text-ink-accent">₹{config.defaultPrice} / eligible passenger</span>
      </div>
      <p className="mb-2 text-xs text-ink-tertiary">Subject to eligibility review. Conditions include:</p>
      <ul className="mb-3 list-inside list-disc text-xs text-ink-tertiary">
        {config.eligibilityConditions.map((condition) => (
          <li key={condition}>{condition}</li>
        ))}
      </ul>
      <label className="mb-2 flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={interested}
          onChange={(event) => {
            setValue("protectionPlanInterested", event.target.checked);
            if (!event.target.checked) setValue("protectionPlanTermsAccepted", false);
          }}
        />
        I&apos;m interested in Protection Plan
      </label>
      {interested ? (
        <>
          <p className="mb-2 max-h-24 overflow-y-auto rounded-md bg-surface-2 p-2 text-xs text-ink-tertiary">{config.termsText}</p>
          <label className="flex items-start gap-2 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setValue("protectionPlanTermsAccepted", event.target.checked)}
              className="mt-0.5"
            />
            I have read and accept the Protection Plan terms above.
          </label>
        </>
      ) : null}
    </div>
  );
}

const processingTypeLabel: Record<NewVisaRequestValues["processingType"], string> = {
  normal: "Normal",
  urgent: "Urgent",
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="text-sm text-ink-tertiary">{label}</span>
      <span className="text-sm font-medium text-ink-primary">{value}</span>
    </div>
  );
}

export function Step3Summary() {
  const { getValues } = useFormContext<NewVisaRequestValues>();
  const values = getValues();
  const destinationCountryOptions = useDestinationCountryOptions();
  const destinationLabel =
    destinationCountryOptions.find((option) => option.value === values.destinationCountry)?.label ??
    values.destinationCountry;
  const visaTypeLabel =
    SAMPLE_VISA_TYPE_OPTIONS.find((option) => option.value === values.visaType)?.label ?? values.visaType;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Destination Country" value={destinationLabel} />
        <SummaryRow label="Visa Type" value={visaTypeLabel} />
        <SummaryRow label="Number of Travelers" value={String(1 + values.additionalTravellers.length)} />
        <SummaryRow
          label="Travel Date"
          value={
            values.travelDate
              ? new Date(values.travelDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : ""
          }
        />
        <SummaryRow label="Processing Type" value={processingTypeLabel[values.processingType]} />
      </div>
      {[
        { name: values.fullName, ...values },
        ...values.additionalTravellers,
      ].map((traveller, index) => (
        <div key={index} className="rounded-xl border border-hairline bg-surface-1 px-5">
          <p className="pt-3 text-xs font-medium uppercase tracking-wide text-ink-accent">
            Traveller {index + 1} — {index === 0 ? values.fullName : (traveller as { fullName: string }).fullName}
          </p>
          <SummaryRow label="Passport Number" value={traveller.passportNumber} />
          <SummaryRow label="Date of Birth" value={traveller.dob ? new Date(traveller.dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : ""} />
          <SummaryRow label="Occupation" value={traveller.occupation} />
          {traveller.guardianFullName ? (
            <SummaryRow label="Guardian" value={`${traveller.guardianFullName} (${traveller.guardianRelationship ? GUARDIAN_RELATIONSHIP_LABELS[traveller.guardianRelationship] : ""})`} />
          ) : null}
          <SummaryRow label="Passport Copy" value={traveller.passportImageBase64 ? "Uploaded" : "Missing"} />
        </div>
      ))}
      <ProtectionPlanOptIn />
    </div>
  );
}
