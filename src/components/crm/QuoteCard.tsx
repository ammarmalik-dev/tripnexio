import { Button } from "@/components/ui/Button";
import { QuoteCountdown } from "./QuoteCountdown";

export interface QuoteCardData {
  id: string;
  airline: string | null;
  flightNumber: string | null;
  route: string | null;
  flightDateTime: string | null;
  arrivalDateTime: string | null;
  baggageAllowance: string | null;
  fareType: string | null;
  adultFare: string | null;
  childFare: string | null;
  infantFare: string | null;
  feeAmount: string | null;
  fineOrCharges: string | null;
  flightTicketPrice: string | null;
  vendorId: string;
  vendorCost: string;
  sellingPrice: string;
  margin: string;
  couponCode: string | null;
  couponDiscount: string | null;
  validityExpiresAt: string | null;
  isSelected: boolean;
  isExpired: boolean;
  alternativeOfId: string | null;
  createdAt: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function money(value: string | null): string | null {
  return value == null ? null : `₹${Number(value).toLocaleString("en-IN")}`;
}

export function QuoteCard({
  quotation,
  isFlightQuote,
  hasItinerary = false,
  vendorName,
  now,
  onSelect,
  selecting,
}: {
  quotation: QuoteCardData;
  isFlightQuote: boolean;
  /** Visa Change itinerary option: simple fee pricing plus flight details. */
  hasItinerary?: boolean;
  vendorName: string;
  now: number;
  onSelect: () => void;
  selecting: boolean;
}) {
  const liveExpired = quotation.isExpired || Boolean(quotation.validityExpiresAt && new Date(quotation.validityExpiresAt).getTime() <= now);
  const isAlternative = Boolean(quotation.alternativeOfId);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink-primary">
              {isFlightQuote || hasItinerary
                ? `${quotation.airline ?? (hasItinerary ? "Itinerary option" : "Quotation")}${quotation.flightNumber ? ` ${quotation.flightNumber}` : ""}`
                : "Quotation"}
            </span>
            {quotation.isSelected ? (
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Selected</span>
            ) : null}
            {liveExpired ? (
              <span className="rounded-full bg-error/10 px-2.5 py-0.5 text-xs font-medium text-error">Expired</span>
            ) : null}
            {isAlternative ? (
              <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">Alternative Route</span>
            ) : null}
          </div>
          {(isFlightQuote || hasItinerary) && quotation.route ? <span className="text-sm text-ink-secondary">{quotation.route}</span> : null}
        </div>
        {quotation.validityExpiresAt ? (
          <QuoteCountdown validityExpiresAt={quotation.validityExpiresAt} now={now} />
        ) : (
          <span className="text-xs text-ink-tertiary">No expiry set</span>
        )}
      </div>

      {isFlightQuote ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {quotation.flightDateTime ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Departure</dt>
              <dd className="font-medium text-ink-primary">{formatDateTime(quotation.flightDateTime)}</dd>
            </div>
          ) : null}
          {quotation.arrivalDateTime ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Arrival</dt>
              <dd className="font-medium text-ink-primary">{formatDateTime(quotation.arrivalDateTime)}</dd>
            </div>
          ) : null}
          {quotation.baggageAllowance ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Baggage</dt>
              <dd className="font-medium text-ink-primary">{quotation.baggageAllowance}</dd>
            </div>
          ) : null}
          {quotation.fareType ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Fare Type</dt>
              <dd className="font-medium text-ink-primary">{quotation.fareType}</dd>
            </div>
          ) : null}
          {money(quotation.adultFare) ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Adult Fare</dt>
              <dd className="font-medium text-ink-primary">{money(quotation.adultFare)}</dd>
            </div>
          ) : null}
          {money(quotation.childFare) ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Child Fare</dt>
              <dd className="font-medium text-ink-primary">{money(quotation.childFare)}</dd>
            </div>
          ) : null}
          {money(quotation.infantFare) ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Infant Fare</dt>
              <dd className="font-medium text-ink-primary">{money(quotation.infantFare)}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {!hasItinerary && quotation.airline ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Airline</dt>
              <dd className="font-medium text-ink-primary">{quotation.airline}</dd>
            </div>
          ) : null}
          {hasItinerary && quotation.flightDateTime ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Departure</dt>
              <dd className="font-medium text-ink-primary">{formatDateTime(quotation.flightDateTime)}</dd>
            </div>
          ) : null}
          {hasItinerary && quotation.arrivalDateTime ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Arrival</dt>
              <dd className="font-medium text-ink-primary">{formatDateTime(quotation.arrivalDateTime)}</dd>
            </div>
          ) : null}
          {hasItinerary && quotation.baggageAllowance ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Baggage</dt>
              <dd className="font-medium text-ink-primary">{quotation.baggageAllowance}</dd>
            </div>
          ) : null}
          {hasItinerary && money(quotation.flightTicketPrice) ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Flight Ticket</dt>
              <dd className="font-medium text-ink-primary">{money(quotation.flightTicketPrice)}</dd>
            </div>
          ) : null}
          {money(quotation.feeAmount) ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Fee</dt>
              <dd className="font-medium text-ink-primary">{money(quotation.feeAmount)}</dd>
            </div>
          ) : null}
          {money(quotation.fineOrCharges) ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Fine / Charges</dt>
              <dd className="font-medium text-ink-primary">{money(quotation.fineOrCharges)}</dd>
            </div>
          ) : null}
          {quotation.couponCode ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-tertiary">Coupon ({quotation.couponCode})</dt>
              <dd className="font-medium text-success">− {money(quotation.couponDiscount)}</dd>
            </div>
          ) : null}
        </dl>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink-heading">
            {isFlightQuote ? "Selling Price" : "Total"}: {money(quotation.sellingPrice)}
            {quotation.couponDiscount ? (
              <span className="ml-1.5 text-xs font-normal text-ink-tertiary">
                (payable {money(String(Number(quotation.sellingPrice) - Number(quotation.couponDiscount)))} after coupon)
              </span>
            ) : null}
          </span>
          <span className="text-xs text-ink-tertiary">
            Vendor: {vendorName} · <span title="Internal — never shown to the customer">Cost {money(quotation.vendorCost)} · Margin {money(quotation.margin)} (internal)</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/quotations/${quotation.id}/invoice`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border hover:bg-white/[0.03]"
          >
            Download Proforma
          </a>
          {quotation.isSelected ? null : (
            <Button type="button" size="sm" variant="ghost" onClick={onSelect} isLoading={selecting} disabled={liveExpired}>
              Select
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
