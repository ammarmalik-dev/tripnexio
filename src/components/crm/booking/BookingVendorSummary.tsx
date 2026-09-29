export interface BookingVendorSummaryData {
  vendorId: string;
  vendorName: string | null;
  vendorCost: string;
  margin: string;
  sellingPrice: string;
  /** Vendor reference staff put on the quotation (Special Fare). */
  quotationVendorReference: string | null;
  /** Booking.pnrVendorReference — recorded after payment. */
  vendorReference: string | null;
  pnr: string | null;
}

function money(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Read-only, staff-internal summary of the selected quotation's vendor
 * commercials plus any vendor reference / PNR recorded on the booking.
 * Editing lives in the service-specific panels (e.g. ReturnTicketActionsPanel,
 * SpecialFareActionsPanel) — `compact` hides the reference/PNR rows where
 * such a panel already shows them editable, to avoid two copies side by side.
 */
export function BookingVendorSummary({ vendor, compact = false }: { vendor: BookingVendorSummaryData; compact?: boolean }) {
  const reference = vendor.vendorReference ?? vendor.quotationVendorReference;
  const rows: [string, string][] = [
    ["Vendor", vendor.vendorName ?? "Unknown vendor"],
    ["Selling Price", money(vendor.sellingPrice)],
    ["Vendor Cost (internal)", money(vendor.vendorCost)],
    ["Margin (internal)", money(vendor.margin)],
  ];
  if (!compact) {
    rows.push(["Vendor Reference (internal)", reference ?? "Not recorded"]);
    rows.push(["PNR / Reference", vendor.pnr ?? "Not recorded"]);
  }

  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-ink-tertiary">{label}</dt>
            <dd className="text-right font-medium text-ink-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-tertiary">Vendor cost and margin are internal — never shown to the customer.</p>
      {compact ? <p className="text-xs text-ink-tertiary">Vendor, cost, reference and PNR are edited in the Return Ticket panel.</p> : null}
    </div>
  );
}
