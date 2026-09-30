"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DateRangeFilter } from "@/components/crm/DateRangeFilter";
import { useDateRangeFilter } from "@/components/crm/useDateRangeFilter";
import { ListPagination } from "@/components/crm/ListPagination";
import { FilterSelect, FilterTextInput, ListStateView, SEARCH_DEBOUNCE_MS, type FetchState } from "./MonitoringControls";
import { entityHref, formatDateTime } from "@/lib/admin/monitoring";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface AuditRow {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  note: string | null;
  timestamp: string;
  user: { id: string; name: string } | null;
}

interface AuditLogResponse {
  items: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditFacets {
  entityTypes: string[];
  actions: string[];
  users: { id: string; name: string; active: boolean }[];
}

const PAGE_SIZE = 50;

/** P24 item 7 — Admin → Audit Log: every AuditTrail row, filterable by user, entity, action, and date. */
export function AuditLogViewer() {
  const [userId, setUserId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityIdInput, setEntityIdInput] = useState("");
  const [entityId, setEntityId] = useState("");
  const [action, setAction] = useState("");
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear: clearDates } = useDateRangeFilter();
  const [page, setPage] = useState(1);

  const [facets, setFacets] = useState<AuditFacets | null>(null);
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setEntityId(entityIdInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [entityIdInput]);

  useEffect(() => {
    let cancelled = false;
    async function loadFacets() {
      try {
        const result = await getJson<AuditFacets>("/api/admin/audit-log/facets");
        if (!cancelled) setFacets(result);
      } catch {
        // Dropdowns stay empty; the log itself still loads and entity id filtering still works.
      }
    }
    void loadFacets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadLog() {
      setState("loading");
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (entityType) params.set("entityType", entityType);
      if (entityId) params.set("entityId", entityId);
      if (action) params.set("action", action);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      try {
        const result = await getJson<AuditLogResponse>(`/api/admin/audit-log?${params.toString()}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the audit log. Please try again.");
        setState("error");
      }
    }
    void loadLog();
    return () => {
      cancelled = true;
    };
  }, [userId, entityType, entityId, action, dateFrom, dateTo, page, refreshNonce]);

  function onFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  const hasFilters = Boolean(userId || entityType || entityIdInput || action || dateFrom || dateTo);

  function clearAll() {
    setUserId("");
    setEntityType("");
    setEntityIdInput("");
    setEntityId("");
    setAction("");
    clearDates();
    setPage(1);
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          id="audit-user"
          label="User"
          value={userId}
          onChange={onFilter(setUserId)}
          options={[
            { value: "system", label: "System / automated (no user)" },
            ...(facets?.users ?? []).map((user) => ({ value: user.id, label: user.active ? user.name : `${user.name} (inactive)` })),
          ]}
          allLabel="All users"
        />
        <FilterSelect
          id="audit-entity-type"
          label="Entity type"
          value={entityType}
          onChange={onFilter(setEntityType)}
          options={(facets?.entityTypes ?? []).map((type) => ({ value: type, label: type }))}
          allLabel="All entity types"
        />
        <FilterTextInput id="audit-entity-id" label="Entity id" value={entityIdInput} onChange={setEntityIdInput} placeholder="Exact record id" />
        <FilterSelect
          id="audit-action"
          label="Action"
          value={action}
          onChange={onFilter(setAction)}
          options={(facets?.actions ?? []).map((value) => ({ value, label: value }))}
          allLabel="All actions"
        />
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <span className="text-xs font-medium text-ink-tertiary">Date</span>
          <DateRangeFilter
            idPrefix="audit"
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
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => setRefreshNonce((current) => current + 1)} disabled={state === "loading"}>
            <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-4 w-4" aria-hidden="true" />
              Clear all filters
            </Button>
          ) : null}
        </div>
      </div>

      <ListStateView
        state={state}
        isEmpty={items.length === 0}
        errorTitle="Couldn't load the audit log"
        errorMessage={errorMessage}
        emptyTitle="No audit entries match these filters"
        emptyDescription="Try widening the date range or clearing a filter."
        onRetry={() => setRefreshNonce((current) => current + 1)}
      >
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th scope="col" className="px-4 py-3">Time</th>
                <th scope="col" className="px-4 py-3">User</th>
                <th scope="col" className="px-4 py-3">Entity</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const href = entityHref(row.entityType, row.entityId);
                return (
                  <tr key={row.id} className="border-b border-hairline align-top last:border-b-0 hover:bg-ink-primary/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-tertiary">{formatDateTime(row.timestamp)}</td>
                    <td className="px-4 py-3 text-ink-secondary">{row.user?.name ?? <span className="text-ink-tertiary">System</span>}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">{row.entityType}</div>
                      {href ? (
                        <Link href={href} className="break-all text-xs text-ink-accent hover:underline">
                          {row.entityId}
                        </Link>
                      ) : (
                        <div className="break-all text-xs text-ink-tertiary">{row.entityId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex whitespace-nowrap rounded-full bg-ink-primary/[0.06] px-2.5 py-1 text-xs font-medium text-ink-secondary">
                        {row.action}
                      </span>
                    </td>
                    <td className="max-w-[420px] px-4 py-3 text-ink-secondary">{row.note ?? <span className="text-ink-tertiary">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ListStateView>

      {state === "success" && data ? (
        <ListPagination noun="record" page={data.page} pageSize={data.pageSize} total={data.total} itemCount={items.length} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
