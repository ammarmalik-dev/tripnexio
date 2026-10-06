"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ListPagination } from "@/components/crm/ListPagination";
import { usePaginationState } from "@/components/crm/usePagination";
import { EnquiryCategoryBadge, EnquiryStatusBadge } from "./EnquiryBadges";
import { ENQUIRY_CATEGORIES, ENQUIRY_CATEGORY_LABELS, ENQUIRY_STATUS_LABELS } from "@/lib/enquiries/labels";
import { ApiError, getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { EnquiryCategory, EnquiryStatus } from "../../../generated/prisma/enums";

interface EnquiryListItem {
  id: string;
  reference: string;
  category: EnquiryCategory;
  status: EnquiryStatus;
  fullName: string;
  mobile: string;
  email: string;
  subject: string;
  createdAt: string;
  escalatedAt: string | null;
  assignedStaff: { id: string; name: string } | null;
}

interface EnquiryListResponse {
  items: EnquiryListItem[];
  total: number;
  counts: { openEnquiries: number; openComplaints: number };
}

type View = "enquiries" | "complaints";
type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** CRM → Enquiries: Contact-form messages, with a separate Complaints (escalation) tab. */
/** `basePath` "/admin/enquiries" when listed in Admin, so an enquiry opens inside Admin. */
export function EnquiriesTable({ basePath = "/crm/enquiries" }: { basePath?: string } = {}) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>(() => (searchParams.get("view") === "complaints" ? "complaints" : "enquiries"));
  const [status, setStatus] = useState<string>("open");
  const [category, setCategory] = useState<EnquiryCategory | "">("");
  // Client corrections 2026-10-05: no page search box (one global 360 search); a ?search= link still pre-filters.
  const search = searchParams.get("search") ?? "";
  const { page, pageSize, resetPage, paginationHandlers } = usePaginationState();
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<EnquiryListResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);


  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const params = new URLSearchParams({ view, page: String(page), pageSize: String(pageSize) });
        if (status) params.set("status", status);
        if (category && view === "enquiries") params.set("category", category);
        if (search) params.set("search", search);
        const result = await getJson<EnquiryListResponse>(`/api/enquiries?${params.toString()}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load enquiries. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [view, status, category, search, page, pageSize, reloadNonce]);

  const tabs: { key: View; label: string; count: number | undefined; icon: typeof Inbox }[] = [
    { key: "enquiries", label: "Enquiries", count: data?.counts.openEnquiries, icon: Inbox },
    { key: "complaints", label: "Complaints", count: data?.counts.openComplaints, icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Enquiry type" className="flex gap-1 rounded-xl border border-hairline bg-surface-1 p-1 sm:w-fit">
        {tabs.map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => {
              setView(key);
              setCategory("");
              resetPage();
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
              view === key ? "bg-accent/10 text-accent-on-light" : "text-ink-secondary hover:bg-ink-primary/[0.03]"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {count ? (
              <span className={cn("rounded-full px-2 py-0.5 text-xs", key === "complaints" ? "bg-error/10 text-error" : "bg-accent/10 text-accent-on-light")}>
                {count} open
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
        {view === "enquiries" ? (
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as EnquiryCategory | "");
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-44")}
          >
            <option value="">All categories</option>
            {ENQUIRY_CATEGORIES.filter((value) => value !== "COMPLAINT").map((value) => (
              <option key={value} value={value}>
                {ENQUIRY_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        ) : null}
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetPage();
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-44")}
        >
          <option value="open">Open (New + In Progress)</option>
          <option value="">All statuses</option>
          {(Object.keys(ENQUIRY_STATUS_LABELS) as EnquiryStatus[]).map((value) => (
            <option key={value} value={value}>
              {ENQUIRY_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {state === "loading" && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load enquiries"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          title={view === "complaints" ? "No complaints here" : "No enquiries here"}
          description={search || category || status ? "Try different filters, or clear them." : "Messages from the Contact page will appear here."}
        />
      ) : data ? (
        <>
          <div className={cn("overflow-x-auto rounded-xl border border-hairline bg-surface-1", state === "loading" && "opacity-60")}>
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Received</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`${basePath}/${item.id}`} className="text-accent-on-light hover:underline">
                        {item.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">{item.fullName}</div>
                      <div className="text-xs text-ink-tertiary">{item.mobile}</div>
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-ink-secondary" title={item.subject}>
                      {item.subject}
                    </td>
                    <td className="px-4 py-3">
                      <EnquiryCategoryBadge category={item.category} />
                    </td>
                    <td className="px-4 py-3">
                      <EnquiryStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{item.assignedStaff?.name ?? <span className="text-ink-tertiary">Unassigned</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-tertiary">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination noun={view === "complaints" ? "complaint" : "message"} page={page} pageSize={pageSize} total={data.total} itemCount={data.items.length} disabled={state === "loading"} {...paginationHandlers} />
        </>
      ) : null}
    </div>
  );
}
