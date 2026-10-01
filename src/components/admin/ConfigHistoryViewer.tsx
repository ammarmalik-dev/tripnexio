"use client";

import { useEffect, useState } from "react";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DateRangeFilter } from "@/components/crm/DateRangeFilter";
import { useDateRangeFilter } from "@/components/crm/useDateRangeFilter";
import { ListPagination } from "@/components/crm/ListPagination";
import { usePaginationState } from "@/components/crm/usePagination";
import { FilterSelect, ListStateView, type FetchState } from "./MonitoringControls";
import type { AuditFacets } from "./AuditLogViewer";
import { CONFIG_ENTITY_TYPES, formatDateTime } from "@/lib/admin/monitoring";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

type HistorySource = "AUDIT" | "PRICING_RULE_HISTORY" | "VENDOR_RATE_HISTORY";

interface ConfigHistoryRow {
  id: string;
  source: HistorySource;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  action: string;
  summary: string | null;
  userId: string | null;
  userName: string | null;
  timestamp: string;
}

interface ConfigHistoryResponse {
  items: ConfigHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}


const SOURCE_LABELS: Record<HistorySource, string> = {
  AUDIT: "Audit trail",
  PRICING_RULE_HISTORY: "Pricing history",
  VENDOR_RATE_HISTORY: "Vendor rate history",
};

/** "PricingRule" -> "Pricing Rule" for the entity-type dropdown. */
function humanize(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * P24 item 7 — Admin → Configuration History: every change to an
 * Admin-managed configuration entity, newest first (audit trail + pricing
 * rule history + vendor rate history, merged server-side).
 */
export function ConfigHistoryViewer() {
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear: clearDates } = useDateRangeFilter();
  const { page, pageSize, setPage, paginationHandlers } = usePaginationState();

  const [users, setUsers] = useState<AuditFacets["users"]>([]);
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<ConfigHistoryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const result = await getJson<AuditFacets>("/api/admin/audit-log/facets");
        if (!cancelled) setUsers(result.users);
      } catch {
        // User dropdown stays empty; history itself still loads.
      }
    }
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      setState("loading");
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (userId) params.set("userId", userId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      try {
        const result = await getJson<ConfigHistoryResponse>(`/api/admin/config-history?${params.toString()}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load configuration history. Please try again.");
        setState("error");
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [entityType, userId, dateFrom, dateTo, page, pageSize, refreshNonce]);

  function onFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  const hasFilters = Boolean(entityType || userId || dateFrom || dateTo);
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:grid-cols-2">
        <FilterSelect
          id="config-history-entity"
          label="Configuration entity"
          value={entityType}
          onChange={onFilter(setEntityType)}
          options={[...CONFIG_ENTITY_TYPES].sort().map((type) => ({ value: type, label: humanize(type) }))}
          allLabel="All configuration"
        />
        <FilterSelect
          id="config-history-user"
          label="Changed by"
          value={userId}
          onChange={onFilter(setUserId)}
          options={users.map((user) => ({ value: user.id, label: user.active ? user.name : `${user.name} (inactive)` }))}
          allLabel="Anyone"
        />
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-ink-tertiary">Date</span>
          <DateRangeFilter
            idPrefix="config-history"
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPreset={(days) => {
              applyPreset(days);
              setPage(1);
            }}
            onCustomFrom={(value) => {
              applyCustomFrom(value);
              setPage(1);
            }}
            onCustomTo={(value) => {
              applyCustomTo(value);
              setPage(1);
            }}
            onClear={() => {
              clearDates();
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setRefreshNonce((current) => current + 1)} disabled={state === "loading"}>
            <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEntityType("");
                setUserId("");
                clearDates();
                setPage(1);
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear all filters
            </Button>
          ) : null}
        </div>
      </div>

      <ListStateView
        state={state}
        isEmpty={items.length === 0}
        errorTitle="Couldn't load configuration history"
        errorMessage={errorMessage}
        emptyTitle="No configuration changes match these filters"
        emptyDescription="Changes made from any Admin configuration screen will appear here."
        onRetry={() => setRefreshNonce((current) => current + 1)}
      >
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th scope="col" className="px-4 py-3">Time</th>
                <th scope="col" className="px-4 py-3">Changed by</th>
                <th scope="col" className="px-4 py-3">Entity</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Change</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-hairline align-top last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-tertiary">{formatDateTime(row.timestamp)}</td>
                  <td className="px-4 py-3 text-ink-secondary">{row.userName ?? <span className="text-ink-tertiary">System</span>}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-primary">{humanize(row.entityType)}</div>
                    {row.entityLabel ? <div className="text-xs text-ink-secondary">{row.entityLabel}</div> : null}
                    <div className="break-all text-xs text-ink-tertiary">{row.entityId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-ink-primary/[0.06] px-2.5 py-1 text-xs font-medium text-ink-secondary">
                      {row.action}
                    </span>
                    <div className="mt-1 text-xs text-ink-tertiary">{SOURCE_LABELS[row.source]}</div>
                  </td>
                  <td className="max-w-[460px] break-words px-4 py-3 text-ink-secondary">{row.summary ?? <span className="text-ink-tertiary">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListStateView>

      {state === "success" && data ? (
        <ListPagination noun="change" page={data.page} pageSize={data.pageSize} total={data.total} itemCount={items.length} {...paginationHandlers} />
      ) : null}
    </div>
  );
}
