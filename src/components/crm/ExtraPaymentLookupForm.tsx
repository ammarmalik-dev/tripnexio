"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "../../generated/prisma/enums";

interface BookingLookupResult {
  id: string;
  bookingId: string;
  status: BookingStatus;
  serviceTypeLabel: string;
  leadReferenceId: string;
  customer: { name: string; mobile: string; email: string | null };
}

const INELIGIBLE_STATUSES: BookingStatus[] = ["PENDING", "CANCELLED", "REFUNDED"];

/**
 * Step 52 (Internal Dashboard Merged §9) — "staff search by Booking ID or
 * Lead reference, the system auto-fetches customer/booking details, and
 * staff create an additional payment." The search-first creation flow the
 * client described; the filterable report of what's already been
 * collected lives separately in `ExtraPaymentsTable.tsx`.
 */
export function ExtraPaymentLookupForm({ onCreated }: { onCreated: () => void }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingLookupResult | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const handleCreate = async () => {
    if (!booking) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!description.trim()) {
      toast.error("Enter a reason for this extra payment.");
      return;
    }
    setSubmitting(true);
    try {
      await postJson(`/api/bookings/${booking.id}/extra-payments`, { amount: parsedAmount, description: description.trim() });
      toast.success("Extra payment link created.");
      setBooking(null);
      setQuery("");
      setAmount("");
      setDescription("");
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create the extra payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const ineligible = booking ? INELIGIBLE_STATUSES.includes(booking.status) : false;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Extra Payment</h2>
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

          {ineligible ? (
            <p className="text-sm text-error">
              An extra payment can&apos;t be raised against a {booking.status.toLowerCase()} booking.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
                <input
                  type="number"
                  min={1}
                  placeholder="Amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={cn(fieldControlClass, fieldBorderClass(false))}
                />
                <input
                  type="text"
                  placeholder="Reason (e.g. Additional baggage fee)"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={cn(fieldControlClass, fieldBorderClass(false))}
                />
              </div>
              <Button type="button" onClick={() => void handleCreate()} isLoading={submitting}>
                Create Extra Payment
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
