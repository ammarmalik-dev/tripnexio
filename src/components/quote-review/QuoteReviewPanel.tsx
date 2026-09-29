"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { toast } from "@/components/ui/Toaster";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { formatRupees } from "@/lib/return-ticket/use-return-ticket-destinations";
import { siteConfig } from "@/lib/site-config";
import { TermsCheckbox, type TermsView } from "@/components/terms/TermsAgreement";
import { formatDeadlineDay, type UrgentDeadline } from "@/lib/visa-extension/rules";

interface QuoteOption {
  id: string;
  isSelected: boolean;
  alternativeOfId: string | null;
  validityExpiresAt: string | null;
  sellingPrice: number;
  couponCode: string | null;
  couponDiscount: number | null;
  airline?: string | null;
  flightNumber?: string | null;
  route?: string | null;
  flightDateTime?: string | null;
  arrivalDateTime?: string | null;
  baggageAllowance?: string | null;
  fareType?: string | null;
  /** P13 — Visa Extension only. */
  breakdown?: { extensionFee: number; fine: number; otherCharges: number };
  /** P14 — Visa Change only: this option's Airport-to-Airport or Border Exit details. */
  operational?: { title: string; rows: { label: string; value: string }[] };
}

interface ExtensionView {
  durationDays: number;
  paymentDeadlineHours: number;
  urgentDeadline: UrgentDeadline | null;
}

interface ReviewView {
  serviceType: string;
  leadReference: string;
  leadStatus: string;
  quotations: QuoteOption[];
  bookingToken: string | null;
  terms: TermsView | null;
  extension: ExtensionView | null;
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-tertiary">{label}</span>
      <span className="font-medium text-ink-primary">{value}</span>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function QuoteCard({
  quote,
  extension,
  onApprove,
  approving,
  canApprove,
}: {
  quote: QuoteOption;
  extension: ExtensionView | null;
  onApprove: () => void;
  approving: boolean;
  canApprove: boolean;
}) {
  const payable = quote.sellingPrice - (quote.couponDiscount ?? 0);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      {quote.airline || quote.route ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink-heading">
            {quote.airline ?? "Option"}
            {quote.flightNumber ? ` ${quote.flightNumber}` : ""}
          </span>
          {quote.route ? <span className="text-sm text-ink-secondary">{quote.route}</span> : null}
          {quote.flightDateTime ? (
            <span className="text-xs text-ink-tertiary">
              Departs {formatDateTime(quote.flightDateTime)}
              {quote.arrivalDateTime ? ` · Arrives ${formatDateTime(quote.arrivalDateTime)}` : ""}
            </span>
          ) : null}
          {quote.baggageAllowance ? <span className="text-xs text-ink-tertiary">Baggage: {quote.baggageAllowance}</span> : null}
          {quote.fareType ? <span className="text-xs text-ink-tertiary">Fare: {quote.fareType}</span> : null}
        </div>
      ) : null}

      {quote.operational ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink-heading">{quote.operational.title}</span>
          {quote.operational.rows.map((row) => (
            <BreakdownRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      ) : null}

      {quote.breakdown && extension ? (
        <div className="flex flex-col gap-2">
          <BreakdownRow label="Extension duration" value={`${extension.durationDays} days`} />
          <BreakdownRow label="Extension fee" value={formatRupees(quote.breakdown.extensionFee)} />
          <BreakdownRow label="Fine" value={formatRupees(quote.breakdown.fine)} />
          <BreakdownRow label="Other charges" value={formatRupees(quote.breakdown.otherCharges)} />
        </div>
      ) : null}

      <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
        <span className="text-sm text-ink-tertiary">Total</span>
        <span className="text-lg font-semibold text-ink-heading">{formatRupees(payable)}</span>
      </div>
      {quote.couponDiscount ? (
        <p className="text-xs text-ink-tertiary">
          {formatRupees(quote.sellingPrice)} − {formatRupees(quote.couponDiscount)} coupon ({quote.couponCode})
        </p>
      ) : null}
      {quote.validityExpiresAt ? (
        <p className="text-xs text-ink-tertiary">Valid until {formatDateTime(quote.validityExpiresAt)}</p>
      ) : null}
      {extension ? (
        <div className="flex flex-col gap-1 text-xs text-ink-tertiary">
          <p>
            Payment deadline: pay within {extension.paymentDeadlineHours} hours — the payment link is valid for {extension.paymentDeadlineHours}{" "}
            hours after you approve.
          </p>
          <p>The new validity is counted from the original visa expiry date.</p>
        </div>
      ) : null}

      <Button type="button" onClick={onApprove} isLoading={approving} disabled={!canApprove} className="mt-1">
        Approve &amp; Continue to Payment
      </Button>
    </div>
  );
}

/** Guest customer page: review one or more staff-prepared quotes for a request and approve one to proceed to payment. */
export function QuoteReviewPanel({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [view, setView] = useState<ReviewView | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<ReviewView>(`/api/quote/${token}`);
        if (cancelled) return;
        setView(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this page. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, reloadNonce]);

  useEffect(() => {
    if (view?.bookingToken) router.push(`/pay/${view.bookingToken}`);
  }, [view?.bookingToken, router]);

  if (state === "loading" || (state === "success" && view?.bookingToken)) return <Skeleton className="h-96 w-full" />;
  if (state === "error" || !view) {
    return (
      <ErrorState
        title="We couldn't open this page"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const handleApprove = async (quotationId: string) => {
    setApprovingId(quotationId);
    try {
      const result = await postJson<{ payToken: string }>(`/api/quote/${token}/approve`, { quotationId, acceptTerms: termsAgreed });
      toast.success("Quote approved.");
      router.push(`/pay/${result.payToken}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't approve this quote. Please try again.");
      setApprovingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium tracking-wide text-ink-accent">Reference {view.leadReference}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-heading">Review your quote</h1>
      </div>

      {view.quotations.length === 0 ? (
        <EmptyState
          title="No quote yet"
          description="Our team is preparing your quote. We'll notify you by email/WhatsApp as soon as it's ready."
          action={<ButtonLink href={siteConfig.contact.whatsappHref}>WhatsApp Support</ButtonLink>}
        />
      ) : (
        <>
          {view.quotations.length > 1 ? (
            <p className="flex items-center gap-2 text-sm text-ink-secondary">
              <CheckCircle2 className="h-4 w-4 text-ink-accent" aria-hidden="true" />
              We&apos;ve prepared {view.quotations.length} options — choose the one that suits you.
            </p>
          ) : null}
          {view.extension?.urgentDeadline ? (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-warning">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-semibold">Urgent: your visa expires today.</p>
                <p>
                  Please complete payment by 6:00 PM on {formatDeadlineDay(view.extension.urgentDeadline.day)}. TripNexio is not responsible for fines
                  caused by a late payment.
                </p>
                {view.extension.urgentDeadline.nextDayHolidays.length > 0 ? (
                  <p className="font-semibold">
                    The next day is a public holiday (
                    {view.extension.urgentDeadline.nextDayHolidays.map((h) => `${h.country === "UAE" ? "UAE" : "India"}: ${h.name}`).join("; ")}), so
                    nothing can be processed then — this deadline cannot be extended.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <TermsCheckbox terms={view.terms} checked={termsAgreed} onChange={setTermsAgreed} id="quote-terms" />
          <div className="flex flex-col gap-4">
            {view.quotations.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                extension={view.extension}
                onApprove={() => void handleApprove(quote.id)}
                approving={approvingId === quote.id}
                canApprove={termsAgreed}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
