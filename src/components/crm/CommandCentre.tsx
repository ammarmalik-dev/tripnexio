"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Clock, Ticket, HelpCircle, RotateCcw, ListTodo, Link2 } from "lucide-react";
import { DateField } from "@/components/forms/DateField";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ActionQueueItem, OperationsOverview, SalesOverview } from "@/lib/crm/dashboard";
import type { LucideIcon } from "lucide-react";

interface DashboardResponse {
  period: { startDate: string; endDate: string };
  sales: SalesOverview;
  operations: OperationsOverview;
  actionQueue: { expiringSoon: ActionQueueItem[]; needsAttention: ActionQueueItem[] };
}

type FetchState = "loading" | "success" | "error";

const MIN_FILTER_DATE = "2020-01-01";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: isoDate(start), end: isoDate(end) };
}

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

/** Formats a value that's a plain number, or "—" for the KPIs that aren't buildable yet (see src/lib/crm/dashboard.ts). */
function statValue(value: number | null): string {
  return value === null ? "—" : String(value);
}

interface KpiCardProps {
  label: string;
  value: number | null;
  comingSoonHint?: string;
  /**
   * Step 53 — "every KPI card must be clickable, opening the relevant
   * screen pre-filtered." Omitted only for a metric that genuinely has no
   * single matching filtered list (a cross-model sum like Staff Action
   * Required) or isn't buildable at all (Delayed) — see each card's own
   * `notClickableHint` below for which and why.
   */
  href?: string;
  notClickableHint?: string;
}

function KpiCard({ label, value, comingSoonHint, href, notClickableHint }: KpiCardProps) {
  const comingSoon = value === null;
  const clickable = !comingSoon && !!href;

  const content = (
    <>
      <p className="text-xs font-medium text-ink-tertiary">{label}</p>
      <p className={cn("text-2xl font-semibold tracking-tight", comingSoon ? "text-ink-tertiary" : "text-ink-heading")}>
        {statValue(value)}
      </p>
      {comingSoon ? <p className="text-[11px] text-ink-tertiary">Coming soon</p> : null}
    </>
  );

  const className = cn(
    "flex flex-col gap-1 rounded-xl border px-4 py-3.5 transition-colors duration-150",
    comingSoon ? "border-dashed border-hairline bg-surface-2" : "border-hairline bg-surface-1",
    clickable && "cursor-pointer hover:border-glass-border hover:bg-white/[0.03]"
  );

  if (clickable) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className} title={comingSoon ? comingSoonHint : notClickableHint}>
      {content}
    </div>
  );
}

function ActionQueueRow({ item }: { item: ActionQueueItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-ink-primary/[0.03]"
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-ink-primary">{item.label}</span>
        <span className="truncate text-xs text-ink-tertiary">{item.detail}</span>
      </div>
      <span className="shrink-0 text-xs text-ink-tertiary">
        {new Date(item.occurredAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
    </Link>
  );
}

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Step 57 (Internal Dashboard Merged / ADMIN_CRM_CONSOLIDATION_AUDIT.md,
 * Tier 3 — "Coupons, FAQs, Refunds, Tasks, Payment Link Generation already
 * exist as separate screens, the ask is mainly to surface them as
 * dashboard shortcuts") — plain navigational links, not KPI cards, so kept
 * visually distinct from KpiCard below (no value/number, no period-scoping).
 * Coupons/FAQs are Admin-only screens (`masters.manage`) — shown only when
 * the signed-in staff member can actually open them, same gating
 * `CrmSidebar`'s own Admin Panel link already uses, so this never offers a
 * shortcut that 403s.
 */
function QuickActionsBar({ canManageMasters }: { canManageMasters: boolean }) {
  const actions: QuickAction[] = [
    ...(canManageMasters ? [{ label: "Coupons", href: "/admin/coupons", icon: Ticket }] : []),
    ...(canManageMasters ? [{ label: "FAQs", href: "/admin/faqs", icon: HelpCircle }] : []),
    { label: "Refunds", href: "/crm/refunds", icon: RotateCcw },
    { label: "Tasks", href: "/crm/tasks", icon: ListTodo },
    { label: "Payment Link", href: "/crm/payments/link", icon: Link2 },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1 px-4 py-2 text-sm font-medium text-ink-primary transition-colors duration-150 hover:border-glass-border hover:bg-white/[0.03]"
        >
          <action.icon className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
          {action.label}
        </Link>
      ))}
    </div>
  );
}

interface CommandCentreProps {
  staffName: string;
  canManageMasters: boolean;
}

/**
 * CRM.md §4 — the CRM landing page. Header ("Welcome back" + date), Quick
 * Actions, a period filter (URL-persisted so it survives opening/closing
 * records per §4's own requirement), Sales Overview, Operations Overview,
 * and the "Most Action Required" priority queue. Read-only/reporting only
 * beyond the Quick Actions links — no mutation actions here.
 */
export function CommandCentre({ staffName, canManageMasters }: CommandCentreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaults = useMemo(() => defaultRange(), []);
  const startDate = searchParams.get("start") ?? defaults.start;
  const endDate = searchParams.get("end") ?? defaults.end;

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [state, setState] = useState<FetchState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const params = new URLSearchParams({ startDate, endDate });
        const result = await getJson<DashboardResponse>(`/api/crm/dashboard?${params.toString()}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the dashboard. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  function updateRange(nextStart: string, nextEnd: string) {
    const params = new URLSearchParams(searchParams);
    params.set("start", nextStart);
    params.set("end", nextEnd);
    router.replace(`/crm?${params.toString()}`);
  }

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    updateRange(isoDate(start), isoDate(end));
  }

  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Step 53 — Sales Overview cards are period-scoped by createdAt, so
  // their link must carry the same dateFrom/dateTo the KPI itself was
  // computed over (using this component's own `data.period`, the actual
  // range the API resolved, not the raw URL params) for the linked list's
  // count to genuinely match the card's number.
  function leadsHref(extra: Record<string, string>): string {
    const params = new URLSearchParams({ ...extra, dateFrom: data!.period.startDate, dateTo: data!.period.endDate });
    return `/crm/leads?${params.toString()}`;
  }
  function quotationsHref(extra: Record<string, string>): string {
    const params = new URLSearchParams({ ...extra, dateFrom: data!.period.startDate, dateTo: data!.period.endDate });
    return `/crm/quotations?${params.toString()}`;
  }
  function paymentsHref(extra: Record<string, string>): string {
    const params = new URLSearchParams({ ...extra, dateFrom: data!.period.startDate, dateTo: data!.period.endDate });
    return `/crm/payments?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-heading">Welcome back, {staffName}</h1>
          <p className="text-sm text-ink-tertiary">{todayLabel}</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <DateField
            name="startDate"
            label="From"
            min={MIN_FILTER_DATE}
            max={endDate}
            value={startDate}
            onChange={(e) => updateRange(e.target.value, endDate)}
          />
          <DateField
            name="endDate"
            label="To"
            min={startDate}
            max={isoDate(new Date())}
            value={endDate}
            onChange={(e) => updateRange(startDate, e.target.value)}
          />
          <div className="flex gap-2">
            {PRESETS.map((preset) => (
              <Button key={preset.label} type="button" variant="ghost" size="sm" onClick={() => applyPreset(preset.days)}>
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <QuickActionsBar canManageMasters={canManageMasters} />

      {state === "loading" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : state === "error" ? (
        <ErrorState description={errorMessage} />
      ) : data ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink-heading">Sales Overview</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              <KpiCard label="New Leads" value={data.sales.newLeads} href={leadsHref({ status: "NEW" })} />
              <KpiCard label="Hot Leads" value={data.sales.hotLeads} href={leadsHref({ temperature: "HOT" })} />
              <KpiCard label="Warm Leads" value={data.sales.warmLeads} href={leadsHref({ temperature: "WARM" })} />
              <KpiCard label="Cold Leads" value={data.sales.coldLeads} href={leadsHref({ temperature: "COLD" })} />
              <KpiCard label="Qualified Leads" value={data.sales.qualifiedLeads} href={leadsHref({ status: "QUALIFIED" })} />
              <KpiCard label="Quotations" value={data.sales.quotationsCreated} href={quotationsHref({})} />
              <KpiCard label="Accepted Quotations" value={data.sales.acceptedQuotations} href={quotationsHref({ status: "SELECTED" })} />
              <KpiCard
                label="Conversion"
                value={data.sales.conversionRate}
                href={leadsHref({ status: "CONVERTED" })}
                notClickableHint="Opens the Converted leads that make up the numerator — the percentage itself isn't a list."
              />
              <KpiCard label="Payment Pending" value={data.sales.paymentPending} href={paymentsHref({ status: "PENDING" })} />
              <KpiCard label="Payment Received" value={data.sales.paymentReceived} href={paymentsHref({ status: "SUCCESS" })} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink-heading">Operations Overview</h2>
            <p className="text-xs text-ink-tertiary">Current live state — not affected by the period filter above.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              <KpiCard label="Active Bookings" value={data.operations.activeBookings} href="/crm/bookings?status=PENDING,CONFIRMED,PROCESSING" />
              <KpiCard label="Documents Pending" value={data.operations.documentsPending} href="/crm/documents?status=REQUIRED,MISSING" />
              <KpiCard label="Customer Action Required" value={data.operations.customerActionRequired} href="/crm/documents?status=MISSING" />
              <KpiCard
                label="Staff Action Required"
                value={data.operations.staffActionRequired}
                notClickableHint="Documents awaiting validation + new bookings awaiting processing — see Documents/Bookings separately, no single list shows this combined count."
              />
              <KpiCard label="External Processing" value={data.operations.externalProcessing} href="/crm/bookings?status=PROCESSING" />
              <KpiCard label="Delayed" value={data.operations.delayed} comingSoonHint="Requires Delay Analysis — not built yet" />
              <KpiCard label="Refunds Raised" value={data.operations.refundsRaised} href="/crm/refunds?status=PENDING" />
              <KpiCard label="Completed" value={data.operations.completed} href="/crm/bookings?status=COMPLETED" />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink-heading">Most Action Required</h2>

            {data.actionQueue.expiringSoon.length === 0 && data.actionQueue.needsAttention.length === 0 ? (
              <EmptyState title="Nothing needs attention right now" description="New action items will show up here as they come in." />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-hairline bg-surface-1">
                  <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
                    <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
                    <p className="text-sm font-semibold text-ink-heading">Expiring Soon</p>
                  </div>
                  {data.actionQueue.expiringSoon.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-ink-tertiary">Nothing expiring soon.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-hairline px-1 py-1">
                      {data.actionQueue.expiringSoon.map((item, i) => (
                        <ActionQueueRow key={`${item.type}-${i}`} item={item} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-hairline bg-surface-1">
                  <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-error" aria-hidden="true" />
                    <p className="text-sm font-semibold text-ink-heading">Needs Attention</p>
                  </div>
                  {data.actionQueue.needsAttention.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-ink-tertiary">Nothing in the backlog.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-hairline px-1 py-1">
                      {data.actionQueue.needsAttention.map((item, i) => (
                        <ActionQueueRow key={`${item.type}-${i}`} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
