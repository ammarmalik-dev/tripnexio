"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { PaymentLinkAction } from "./PaymentLinkAction";
import type { BookingStatus } from "../../generated/prisma/enums";

interface BookingLookupResult {
  id: string;
  bookingId: string;
  status: BookingStatus;
  serviceTypeLabel: string;
  leadReferenceId: string;
  customer: { name: string; mobile: string; email: string | null };
}

/**
 * Step 57 (Internal Dashboard Merged / audit Tier 3) — "genuinely easy to
 * reach" payment-link generation for offline/manual customer handling:
 * search a booking by id or lead reference (same lookup Step 52's Extra
 * Payment screen already uses), then act on it directly, instead of
 * needing to already be on that booking's own detail page.
 */
export function PaymentLinkLookupForm() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingLookupResult | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setBooking(null);
    try {
      const result = await getJson<BookingLookupResult>(`/api/bookings/lookup?query=${encodeURIComponent(query.trim())}`);
      setBooking(result);
    } catch (error) {
      setSearchError(error instanceof ApiError ? error.message : "Couldn't find that booking. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Find a Booking</h2>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSearch();
            }}
            placeholder="Booking ID (e.g. TNX-OT-058517) or Lead reference (e.g. OTB-058517)"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>
        <Button type="button" onClick={() => void handleSearch()} isLoading={searching}>
          Search
        </Button>
      </div>

      {searchError ? <p className="text-sm text-error">{searchError}</p> : null}

      {booking ? (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <Link href={`/crm/bookings/${booking.id}`} className="font-medium text-ink-accent hover:underline">
                {booking.bookingId}
              </Link>
              <span className="text-ink-tertiary"> · {booking.leadReferenceId} · {booking.serviceTypeLabel}</span>
            </div>
            <span className="text-ink-tertiary">
              {booking.customer.name} · {booking.customer.mobile}
            </span>
          </div>
          <PaymentLinkAction bookingId={booking.id} />
        </div>
      ) : null}
    </div>
  );
}
