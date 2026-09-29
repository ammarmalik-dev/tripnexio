"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useDestinationCountryOptions } from "@/lib/use-destination-countries";
import { useVisaTypes } from "@/lib/use-visa-types";
import { useNewVisaProducts } from "@/lib/new-visa/use-new-visa-products";
import { NewVisaPricePreview } from "../NewVisaPricePreview";
import { getJson } from "@/lib/api/client";
import { GUARDIAN_RELATIONSHIP_LABELS, type NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

type ProtectionPlanCountryConfig =
  | { enabled: false }
  | { enabled: true; price: number; termsText: string; eligibilityConditions: string[] };

/**
 * P12 — per-traveller Protection Plan opt-in, shown only when Admin enabled
 * the plan for this destination. The full terms are shown and accepting them
 * is mandatory for any opt-in (re-checked server-side); each chosen
 * traveller's price is added to the payable total as a separate
 * "Protection Plan" line on the payment and invoice.
 */
function ProtectionPlanOptIn({ countryCode, travellerNames }: { countryCode: string; travellerNames: string[] }) {
  const { watch, setValue } = useFormContext<NewVisaRequestValues>();
  const [config, setConfig] = useState<ProtectionPlanCountryConfig | null>(null);
  const chosen = watch("protectionPlanTravellers");
  const termsAccepted = watch("protectionPlanTermsAccepted");

  useEffect(() => {
    if (!countryCode) return;
    let cancelled = false;
    getJson<ProtectionPlanCountryConfig>(`/api/protection-plan-config?country=${encodeURIComponent(countryCode)}`)
      .then((result) => {
        if (cancelled) return;
        setConfig(result);
        // Never carry a choice over to a destination where the plan isn't offered.
        if (!result.enabled) {
          setValue("protectionPlanTravellers", []);
          setValue("protectionPlanTermsAccepted", false);
        }
      })
      .catch(() => {
        // Non-critical — Protection Plan is optional; the rest of the request still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, setValue]);

  if (!config || !config.enabled) return null;

  const toggle = (index: number, checked: boolean) => {
    const next = checked ? [...new Set([...chosen, index])].sort((a, b) => a - b) : chosen.filter((value) => value !== index);
    setValue("protectionPlanTravellers", next);
    if (next.length === 0) setValue("protectionPlanTermsAccepted", false);
  };
  const planTotal = chosen.length * config.price;

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-heading">Protection Plan (optional)</h3>
        <span className="text-sm font-medium text-ink-accent">₹{config.price.toLocaleString("en-IN")} per traveller</span>
      </div>
      {config.eligibilityConditions.length > 0 ? (
        <>
          <p className="mb-2 text-xs text-ink-tertiary">Subject to eligibility review. Conditions include:</p>
          <ul className="mb-3 list-inside list-disc text-xs text-ink-tertiary">
            {config.eligibilityConditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </>
      ) : null}
      <fieldset className="mb-3 flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-ink-secondary">Add Protection Plan for:</legend>
        {travellerNames.map((name, index) => (
          <label key={index} className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={chosen.includes(index)} onChange={(event) => toggle(index, event.target.checked)} />
            {name || `Traveller ${index + 1}`}
          </label>
        ))}
      </fieldset>
      {chosen.length > 0 ? (
        <>
          <h4 className="mb-1 text-xs font-semibold text-ink-heading">Protection Plan terms</h4>
          <div className="mb-2 max-h-56 overflow-y-auto whitespace-pre-line rounded-md bg-surface-2 p-3 text-xs text-ink-tertiary" tabIndex={0}>
            {config.termsText}
          </div>
          <label className="flex items-start gap-2 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setValue("protectionPlanTermsAccepted", event.target.checked)}
              className="mt-0.5"
            />
            I have read and accept the Protection Plan terms above.
          </label>
          {!termsAccepted ? <p className="mt-1 text-xs text-error">Accepting the terms is required to add Protection Plan.</p> : null}
          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-sm">
            <span className="text-ink-tertiary">
              Protection Plan ({chosen.length} × ₹{config.price.toLocaleString("en-IN")})
            </span>
            <span className="font-medium text-ink-primary">₹{planTotal.toLocaleString("en-IN")}</span>
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">Added to your payable total as a separate line.</p>
        </>
      ) : null}
    </div>
  );
}

const processingTypeLabel: Record<NewVisaRequestValues["processingType"], string> = {
  normal: "Normal",
  urgent: "Express",
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
  const { options: visaTypes } = useVisaTypes(values.destinationCountry);
  const visaTypeLabel = visaTypes.find((visaType) => visaType.id === values.visaType)?.name ?? "";
  const { products } = useNewVisaProducts();
  const productLabel = products.find((product) => product.id === values.newVisaConfigId)?.label ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Destination Country" value={destinationLabel} />
        {values.newVisaConfigId ? <SummaryRow label="Visa Option" value={productLabel} /> : null}
        {values.visaType ? <SummaryRow label="Visa Type" value={visaTypeLabel} /> : null}
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
      <NewVisaPricePreview
        countryCode={values.destinationCountry}
        newVisaConfigId={values.newVisaConfigId}
        processingType={values.processingType}
        travelDate={values.travelDate}
        travellers={[{ fullName: values.fullName, dob: values.dob }, ...values.additionalTravellers.map((t) => ({ fullName: t.fullName, dob: t.dob }))]}
      />
      <ProtectionPlanOptIn
        countryCode={values.destinationCountry}
        travellerNames={[values.fullName, ...values.additionalTravellers.map((t) => t.fullName)]}
      />
    </div>
  );
}
