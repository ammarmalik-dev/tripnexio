"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { BookingStatusBadge } from "@/components/crm/BookingStatusBadge";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType, BookingStatus } from "../../generated/prisma/enums";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

interface StaffOption {
  id: string;
  name: string;
  active: boolean;
}

interface OpenWorkItem {
  leadId: string;
  bookingId: string;
  bookingIdFormatted: string;
  leadReferenceId: string;
  serviceType: ServiceType;
  status: BookingStatus;
  paxCount: number;
  customerName: string;
}

type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Step 26 Unit 4 (audit §3.11/§4.7), the last of 4 units — ADMIN.md §13's
 * worked example, "Staff A → Open Bookings → Select All → Reassign →
 * Staff B," gated by leads.reassign (the same permission that already
 * governs single-lead reassignment — see PATCH /api/leads/[id]/assign,
 * which CRM.md §34/ADMIN.md §12 both lock as Admin-only).
 */
export function BulkReassignmentManager() {
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffLoadState, setStaffLoadState] = useState<LoadState>("loading");

  const [fromStaffId, setFromStaffId] = useState("");
  const [openWork, setOpenWork] = useState<OpenWorkItem[]>([]);
  const [workLoadState, setWorkLoadState] = useState<LoadState>("idle");
  const [workErrorMessage, setWorkErrorMessage] = useState("");

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [toStaffId, setToStaffId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const [search, setSearch] = useState("");

  const filteredWork = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return openWork;
    return openWork.filter(
      (item) =>
        item.bookingIdFormatted.toLowerCase().includes(needle) ||
        item.leadReferenceId.toLowerCase().includes(needle) ||
        item.customerName.toLowerCase().includes(needle) ||
        SERVICE_TYPE_LABELS[item.serviceType].toLowerCase().includes(needle)
    );
  }, [openWork, search]);
  // Selections are lead ids held here, independent of the visible page, so they persist across pages and searches.
  const { pageItems, paginationProps, resetPage } = useClientPagination(filteredWork);

  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      setStaffLoadState("loading");
      try {
        // Step 50 — includeInactive so an employee who has since been
        // deactivated can still be selected as the "From" (moving their
        // remaining open work off them is exactly why this screen exists).
        const staff = await getJson<StaffOption[]>("/api/staff?includeInactive=1");
        if (!cancelled) {
          setStaffOptions(staff);
          setStaffLoadState("success");
        }
      } catch {
        if (!cancelled) setStaffLoadState("error");
      }
    }
    void loadStaff();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadOpenWork() {
      if (!fromStaffId) {
        setOpenWork([]);
        setWorkLoadState("idle");
        return;
      }
      setWorkLoadState("loading");
      setSelectedLeadIds(new Set());
      try {
        const result = await getJson<{ staff: StaffOption; openWork: OpenWorkItem[] }>(
          `/api/admin/bulk-reassignment?staffId=${encodeURIComponent(fromStaffId)}`
        );
        if (cancelled) return;
        setOpenWork(result.openWork);
        setWorkLoadState("success");
      } catch (error) {
        if (cancelled) return;
        setWorkErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this staff member's open work.");
        setWorkLoadState("error");
      }
    }
    void loadOpenWork();
    return () => {
      cancelled = true;
    };
  }, [fromStaffId]);

  const toggleLead = (leadId: string) => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const pageLeadIds = [...new Set(pageItems.map((item) => item.leadId))];
  const filteredLeadIds = [...new Set(filteredWork.map((item) => item.leadId))];
  const totalLeadCount = new Set(openWork.map((item) => item.leadId)).size;
  const pageAllSelected = pageLeadIds.length > 0 && pageLeadIds.every((id) => selectedLeadIds.has(id));
  const filteredAllSelected = filteredLeadIds.length > 0 && filteredLeadIds.every((id) => selectedLeadIds.has(id));

  const togglePageSelection = () => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      for (const id of pageLeadIds) {
        if (pageAllSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedLeadIds((current) => new Set([...current, ...filteredLeadIds]));
  };

  const handleReassign = async () => {
    const toStaffName = staffOptions.find((option) => option.id === toStaffId)?.name ?? "the selected staff member";
    const reason = await confirm({
      title: `Reassign ${selectedLeadIds.size} lead${selectedLeadIds.size === 1 ? "" : "s"} to ${toStaffName}?`,
      description: "Every selected lead's open work moves to the new owner. The reason is recorded on each affected lead's audit trail.",
      confirmLabel: "Reassign",
    });
    if (!reason) return;
    setSubmitting(true);
    try {
      const result = await postJson<{ reassignedCount: number }>("/api/admin/bulk-reassignment", {
        fromStaffId,
        toStaffId,
        leadIds: Array.from(selectedLeadIds),
        reason,
      });
      toast.success(`Reassigned ${result.reassignedCount} lead${result.reassignedCount === 1 ? "" : "s"}.`);
      setOpenWork((current) => current.filter((item) => !selectedLeadIds.has(item.leadId)));
      setSelectedLeadIds(new Set());
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't reassign the selected work. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (staffLoadState === "loading") {
    return <Skeleton className="h-32 w-full" />;
  }

  if (staffLoadState === "error") {
    return <ErrorState title="Couldn't load staff" description="Please refresh and try again." />;
  }

  const selectedCount = selectedLeadIds.size;
  const canReassign = fromStaffId && toStaffId && toStaffId !== fromStaffId && selectedCount > 0 && !submitting;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-hairline bg-surface-1 p-5 sm:grid-cols-[1fr_auto_1fr]">
        <FormField label="From" htmlFor="bulk-from-staff">
          <select
            id="bulk-from-staff"
            value={fromStaffId}
            onChange={(event) => {
              setFromStaffId(event.target.value);
              setToStaffId("");
              setSearch("");
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false))}
          >
            <option value="">Select a staff member</option>
            {staffOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.active ? "" : " (Inactive)"}
              </option>
            ))}
          </select>
        </FormField>
        <div className="hidden items-center justify-center sm:flex">
          <ArrowRight className="h-5 w-5 text-ink-tertiary" aria-hidden="true" />
        </div>
        <FormField label="To" htmlFor="bulk-to-staff">
          <select
            id="bulk-to-staff"
            value={toStaffId}
            disabled={!fromStaffId}
            onChange={(event) => setToStaffId(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false))}
          >
            <option value="">Select a staff member</option>
            {staffOptions
              // Step 50 — the destination must be a real, active roster
              // member; only "From" is allowed to be an inactive employee.
              .filter((option) => option.id !== fromStaffId && option.active)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
          </select>
        </FormField>
      </div>

      {!fromStaffId ? null : workLoadState === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : workLoadState === "error" ? (
        <ErrorState title="Couldn't load open work" description={workErrorMessage} />
      ) : openWork.length === 0 ? (
        <EmptyState title="No open bookings" description="This staff member has no open, non-terminal bookings to reassign." />
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-ink-heading">Open Bookings ({openWork.length})</h2>
              <p className="text-xs text-ink-tertiary" aria-live="polite">
                <span className="font-medium text-ink-secondary">{selectedCount}</span> of {totalLeadCount} lead
                {totalLeadCount === 1 ? "" : "s"} selected
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={togglePageSelection} disabled={pageLeadIds.length === 0}>
                {pageAllSelected ? "Deselect this page" : `Select this page (${pageLeadIds.length})`}
              </Button>
              {!filteredAllSelected && filteredLeadIds.length > 0 ? (
                <Button type="button" size="sm" variant="ghost" onClick={selectAllFiltered}>
                  {search.trim() ? `Select all ${filteredLeadIds.length} matching` : `Select all ${filteredLeadIds.length}`}
                </Button>
              ) : null}
              {selectedCount > 0 ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedLeadIds(new Set())}>
                  Clear selection
                </Button>
              ) : null}
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
            <label htmlFor="bulk-work-search" className="sr-only">
              Search open bookings
            </label>
            <input
              id="bulk-work-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Search booking ID, reference, customer or service…"
              className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
            />
          </div>
          {filteredWork.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" aria-hidden="true" />}
              title="No matching bookings"
              description="Try a different booking ID, reference, customer or service. Existing selections are kept."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {pageItems.map((item) => (
                <label
                  key={item.bookingId}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-ink-primary/[0.02]",
                    selectedLeadIds.has(item.leadId) ? "border-accent/30 bg-accent/[0.04]" : "border-hairline"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.has(item.leadId)}
                      onChange={() => toggleLead(item.leadId)}
                      aria-label={`Select ${item.bookingIdFormatted} for ${item.customerName}`}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-ink-primary">
                        {item.bookingIdFormatted} <span className="text-ink-tertiary">({item.leadReferenceId})</span>
                      </span>
                      <span className="text-xs text-ink-tertiary">
                        {item.customerName} · {SERVICE_TYPE_LABELS[item.serviceType]} · {item.paxCount} PAX
                      </span>
                    </div>
                  </div>
                  <BookingStatusBadge status={item.status} />
                </label>
              ))}
            </div>
          )}
          <ListPagination noun="open booking" {...paginationProps} />

          <div className="mt-2 flex flex-col gap-3 border-t border-hairline pt-4">
            <p className="text-xs text-ink-tertiary">You&apos;ll be asked for a reason — it&apos;s recorded on every affected lead&apos;s audit trail.</p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => void handleReassign()} isLoading={submitting} disabled={!canReassign}>
                Reassign {selectedCount || ""} to {staffOptions.find((option) => option.id === toStaffId)?.name ?? "…"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}
