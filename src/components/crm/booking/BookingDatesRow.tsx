import type { BookingDateItem } from "@/lib/crm/booking-dates";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function formatBookingDate(value: string): string {
  // A bare YYYY-MM-DD (as submitted on the intake forms) is a calendar date,
  // not an instant — format it in UTC so it never shifts a day.
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(DATE_ONLY.test(value) ? { timeZone: "UTC" } : {}),
  });
}

/** CRM.md §12 — each service's dates, each with its own explicit label (never a generic "Date"). */
export function BookingDatesRow({ items }: { items: BookingDateItem[] }) {
  if (items.length === 0) return null;
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium tracking-wide text-ink-tertiary uppercase">{item.label}</dt>
          <dd className="text-sm text-ink-primary">
            {item.value ? (
              item.kind === "date" ? formatBookingDate(item.value) : item.value
            ) : (
              <span className="text-ink-tertiary">Not recorded</span>
            )}
            {item.value && item.hint ? <span className="ml-1 text-xs text-ink-tertiary">({item.hint})</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
