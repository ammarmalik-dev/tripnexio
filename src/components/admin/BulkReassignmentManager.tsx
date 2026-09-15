"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType, BookingStatus } from "../../generated/prisma/enums";

interface StaffOption {
  id: string;
  name: string;
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
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      setStaffLoadState("loading");
      try {
        const staff = await getJson<StaffOption[]>("/api/staff");
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

  const allSelected = openWork.length > 0 && selectedLeadIds.size === new Set(openWork.map((item) => item.leadId)).size;
  const toggleSelectAll = () => {
    setSelectedLeadIds(allSelected ? new Set() : new Set(openWork.map((item) => item.leadId)));
  };

  const handleReassign = async () => {
    setReasonError("");
    if (!reason.trim()) {
      setReasonError("A reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await postJson<{ reassignedCount: number }>("/api/admin/bulk-reassignment", {
        fromStaffId,
        toStaffId,
        leadIds: Array.from(selectedLeadIds),
        reason: reason.trim(),
      });
      toast.success(`Reassigned ${result.reassignedCount} lead${result.reassignedCount === 1 ? "" : "s"}.`);
      setOpenWork((current) => current.filter((item) => !selectedLeadIds.has(item.leadId)));
      setSelectedLeadIds(new Set());
      setReason("");
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
            }}
            className={cn(fieldControlClass, fieldBorderClass(false))}
          >
            <option value="">Select a staff member</option>
            {staffOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
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
              .filter((option) => option.id !== fromStaffId)
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
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-heading">
              Open Bookings ({openWork.length}) — {selectedCount} selected
            </h2>
            <Button type="button" size="sm" variant="ghost" onClick={toggleSelectAll}>
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {openWork.map((item) => (
              <label
                key={item.bookingId}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2.5 text-sm hover:bg-ink-primary/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.has(item.leadId)}
                    onChange={() => toggleLead(item.leadId)}
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
                <span className="rounded-full bg-ink-primary/[0.06] px-2 py-0.5 text-xs text-ink-tertiary">{item.status}</span>
              </label>
            ))}
          </div>

          <div className="mt-2 flex flex-col gap-3 border-t border-hairline pt-4">
            <Textarea
              name="bulk-reassign-reason"
              label="Reason"
              hint="Required — recorded on every affected lead's audit trail."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={reasonError}
              rows={2}
            />
            <div className="flex justify-end">
              <Button type="button" onClick={() => void handleReassign()} isLoading={submitting} disabled={!canReassign}>
                Reassign {selectedCount || ""} to {staffOptions.find((option) => option.id === toStaffId)?.name ?? "…"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
