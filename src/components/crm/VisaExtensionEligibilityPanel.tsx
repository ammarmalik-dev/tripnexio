"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { DateField } from "@/components/forms/DateField";
import { Button } from "@/components/ui/Button";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { formatDeadlineDay, type PassengerExtensionCheck, type UrgentDeadline, type VisaExtensionEligibilityOutcome as EligibilityOutcome } from "@/lib/visa-extension/rules";
import { TextField } from "@/components/forms/TextField";

const OUTCOME_COPY: Record<EligibilityOutcome, { label: string; description: string; tone: string; icon: typeof CheckCircle2 }> = {
  ELIGIBLE: {
    label: "Eligible for 30-day Extension",
    description: "Not yet expired, or expired less than 30 days ago — may proceed to quotation.",
    tone: "bg-success/10 text-success border-success/30",
    icon: CheckCircle2,
  },
  URGENT_TODAY: {
    label: "Urgent — visa expires today",
    description:
      "Mark this case urgent. Payment must be completed by 6:00 PM on the same working day. TripNexio is not responsible for fines from late payment.",
    tone: "bg-warning/10 text-warning border-warning/30",
    icon: AlertTriangle,
  },
  NOT_ELIGIBLE: {
    label: "Not eligible for 30-day Extension",
    description:
      "Expired 30 days or more — not eligible for the 30-day Extension, even if the customer is willing to pay any applicable overstay fine.",
    tone: "bg-error/10 text-error border-error/30",
    icon: XCircle,
  },
};

interface VisaExtensionEligibilityPanelProps {
  leadId: string;
  verifiedExpiryDate?: string;
  eligibilityOutcome?: EligibilityOutcome;
  /** P13 — URGENT_TODAY only: the 6:00 PM working-day deadline and any next-day UAE/India holiday. */
  urgentDeadline?: UrgentDeadline | null;
  /** Client doc 16 Nov (E2) — the lead's passengers, each verified on its own. */
  passengers?: { id: string; fullName: string; passportNumber: string | null }[];
  passengerChecks?: Record<string, PassengerExtensionCheck>;
  onVerified: (result: VerifyResult) => void;
}

type VerifyResult = {
  verifiedExpiryDate: string | null;
  outcome: EligibilityOutcome;
  urgentDeadline: UrgentDeadline | null;
  passengerChecks?: Record<string, PassengerExtensionCheck>;
};

const CHECK_LABEL: Record<EligibilityOutcome, string> = { ELIGIBLE: "Eligible", URGENT_TODAY: "Eligible — urgent (expires today)", NOT_ELIGIBLE: "Not eligible" };

/** E2 / E7 — one passenger: documents validated first (server-checked), then the correct expiry or "Not accepted". */
function PassengerCheckRow({
  leadId,
  passenger,
  check,
  onVerified,
}: {
  leadId: string;
  passenger: { id: string; fullName: string; passportNumber: string | null };
  check?: PassengerExtensionCheck;
  onVerified: (result: VerifyResult) => void;
}) {
  const [date, setDate] = useState(check?.verifiedExpiryDate ?? "");
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const result = await patchJson<VerifyResult>(`/api/leads/${leadId}/visa-extension-verify`, { passengerId: passenger.id, ...body });
      toast.success(`${passenger.fullName} saved.`);
      setRejecting(false);
      setReason("");
      onVerified(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-primary">
          {passenger.fullName}
          {passenger.passportNumber ? <span className="ml-2 text-xs text-ink-tertiary">Passport {passenger.passportNumber}</span> : null}
        </p>
        {check ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              check.outcome === "NOT_ELIGIBLE" ? "bg-error/10 text-error" : check.outcome === "URGENT_TODAY" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
            )}
          >
            {CHECK_LABEL[check.outcome]}
            {check.verifiedExpiryDate ? ` · expiry ${check.verifiedExpiryDate}` : ""}
            {check.reason ? ` · ${check.reason}` : ""}
          </span>
        ) : (
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-secondary">Not verified</span>
        )}
      </div>
      {rejecting ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-[320px]">
            <TextField label="Why isn't this extension accepted?" name={`reason-${passenger.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button type="button" size="sm" onClick={() => void save({ notAccepted: true, reason: reason.trim() })} isLoading={saving} disabled={reason.trim().length < 3}>
            Mark Not Accepted
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-[200px]">
            <DateField label="Verified Expiry Date" name={`expiry-${passenger.id}`} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button type="button" size="sm" onClick={() => void save({ verifiedExpiryDate: date })} isLoading={saving} disabled={!date}>
            Save &amp; Check
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(true)} disabled={saving}>
            Not accepted…
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * Visa_Extension.md §8/§9: staff manually verifies the actual visa expiry
 * date before eligibility/quotation can proceed — the customer never
 * enters or sees an unverified expiry (§5/§10). This is the only place the
 * ≥30-day-expired and same-day-6PM rules are enforced, matching where the
 * spec says they actually apply.
 */
export function VisaExtensionEligibilityPanel({
  leadId,
  verifiedExpiryDate,
  eligibilityOutcome,
  urgentDeadline,
  passengers = [],
  passengerChecks = {},
  onVerified,
}: VisaExtensionEligibilityPanelProps) {
  const [date, setDate] = useState(verifiedExpiryDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleVerify = async () => {
    if (!date) return;
    setSaving(true);
    setError(undefined);
    try {
      const result = await patchJson<VerifyResult>(
        `/api/leads/${leadId}/visa-extension-verify`,
        { verifiedExpiryDate: date }
      );
      toast.success("Verified expiry saved.");
      onVerified(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the verified expiry. Please try again.");
      toast.error(err instanceof ApiError ? err.message : "Couldn't save the verified expiry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const outcomeCopy = eligibilityOutcome ? OUTCOME_COPY[eligibilityOutcome] : null;
  const OutcomeIcon = outcomeCopy?.icon;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink-heading">Staff Visa Verification</h2>
      <p className="mb-4 text-xs text-ink-tertiary">
        Enter the actual visa expiry date after checking the customer&apos;s real visa record. The customer never
        sees this until you&apos;ve verified it.
      </p>

      {passengers.length > 0 ? (
        <>
          <p className="mb-3 text-xs text-ink-tertiary">
            Each passenger is verified on their own: validate (or reject) their visa / passport copies first, then enter the correct expiry. A
            passenger marked Not accepted is left out of the quotation.
          </p>
          <ul className="flex flex-col gap-2">
            {passengers.map((passenger) => (
              <PassengerCheckRow key={passenger.id} leadId={leadId} passenger={passenger} check={passengerChecks[passenger.id]} onVerified={onVerified} />
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-[220px]">
            <DateField label="Verified Expiry Date" name="verifiedExpiryDate" value={date} onChange={(e) => setDate(e.target.value)} error={error} />
          </div>
          <Button type="button" size="sm" onClick={() => void handleVerify()} isLoading={saving} disabled={!date}>
            Save &amp; Check Eligibility
          </Button>
        </div>
      )}

      {outcomeCopy && OutcomeIcon ? (
        <div className={cn("mt-4 flex items-start gap-3 rounded-lg border p-3", outcomeCopy.tone)}>
          <OutcomeIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">{outcomeCopy.label}</p>
            <p className="text-xs opacity-90">{outcomeCopy.description}</p>
            {eligibilityOutcome === "URGENT_TODAY" && urgentDeadline ? (
              <p className="text-xs font-semibold">Payment deadline: 6:00 PM, {formatDeadlineDay(urgentDeadline.day)}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {eligibilityOutcome === "URGENT_TODAY" && urgentDeadline && urgentDeadline.nextDayHolidays.length > 0 ? (
        <div role="alert" className="mt-3 flex items-start gap-3 rounded-lg border border-error/30 bg-error/10 p-3 text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-xs">
            <span className="font-semibold">Extra urgent:</span> the next day is a holiday (
            {urgentDeadline.nextDayHolidays.map((h) => `${h.country === "UAE" ? "UAE" : "India"} — ${h.name}`).join("; ")}). Nothing can be processed
            then — the payment must be completed before today&apos;s 6:00 PM deadline.
          </p>
        </div>
      ) : null}
    </section>
  );
}
