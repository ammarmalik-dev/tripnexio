"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { toast } from "@/components/ui/Toaster";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { formatRupees } from "@/lib/return-ticket/use-return-ticket-destinations";
import { siteConfig } from "@/lib/site-config";

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
}

interface ReviewView {
  serviceType: string;
  leadReference: string;
  leadStatus: string;
  quotations: QuoteOption[];
  bookingToken: string | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function QuoteCard({
  quote,
  onApprove,
  approving,
}: {
  quote: QuoteOption;
  onApprove: () => void;
  approving: boolean;
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

      <Button type="button" onClick={onApprove} isLoading={approving} className="mt-1">
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
      const result = await postJson<{ payToken: string }>(`/api/quote/${token}/approve`, { quotationId });
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
          <div className="flex flex-col gap-4">
            {view.quotations.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} onApprove={() => void handleApprove(quote.id)} approving={approvingId === quote.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
