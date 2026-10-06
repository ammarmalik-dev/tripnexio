"use client";

import { CalendarCheck } from "lucide-react";
import { addWorkingDays, type WorkingCalendar } from "@/lib/calendar/working-calendar";

/**
 * Client corrections 2026-10-05 — the Expected Approval Date for the chosen
 * processing type, as a light calendar tile: Admin-configured processing
 * working days (Admin → Service Configuration → Timelines) counted on the
 * Admin working calendar (weekends + holidays skipped). Nothing is shown
 * when Admin hasn't set the processing time — a date is never guessed.
 */
export function ExpectedApprovalDate({ label, workingDays, calendar }: { label: string; workingDays: number | null | undefined; calendar: WorkingCalendar }) {
  if (workingDays == null) return null;
  const iso = addWorkingDays(new Date(), workingDays, calendar);
  const date = new Date(`${iso}T00:00:00Z`);
  const fmt = (options: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-IN", { ...options, timeZone: "UTC" });

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-ink-accent/20 bg-[linear-gradient(135deg,rgb(62_111_219/0.08),rgb(255_255_255/0.6))] p-4">
      <div className="flex w-16 shrink-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 text-center shadow-sm" aria-hidden="true">
        <span className="bg-[image:var(--gradient-accent)] py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">{fmt({ month: "short" })}</span>
        <span className="py-1 text-2xl leading-none font-bold text-ink-heading">{fmt({ day: "numeric" })}</span>
        <span className="pb-1 text-[10px] text-ink-tertiary uppercase">{fmt({ weekday: "short" })}</span>
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-accent uppercase">
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Expected approval date · {label}
        </p>
        <p className="text-lg font-semibold text-ink-heading">{fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <p className="text-xs text-ink-tertiary">
          About {workingDays} working day{workingDays === 1 ? "" : "s"} from today, excluding weekends and holidays. The final timeline depends on the authority.
        </p>
      </div>
    </div>
  );
}
