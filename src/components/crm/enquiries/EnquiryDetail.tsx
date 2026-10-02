"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRightCircle, Mail, MessageSquarePlus, Phone, User } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/forms/Textarea";
import { fieldBorderClass, fieldControlClass, FormField } from "@/components/forms/FormField";
import { EnquiryCategoryBadge, EnquiryStatusBadge } from "./EnquiryBadges";
import { ApiError, getJson, patchJson, postJson } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { ENQUIRY_CATEGORIES, ENQUIRY_CATEGORY_LABELS, ENQUIRY_MANUAL_STATUSES, ENQUIRY_STATUS_LABELS } from "@/lib/enquiries/labels";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import type { EnquiryCategory, EnquiryStatus, ServiceType } from "../../../generated/prisma/enums";

interface TimelineEntry {
  id: string;
  action: string;
  note: string | null;
  timestamp: string;
  byUser: { name: string } | null;
}

interface EnquiryData {
  id: string;
  reference: string;
  category: EnquiryCategory;
  status: EnquiryStatus;
  fullName: string;
  mobile: string;
  email: string;
  bookingReference: string | null;
  subject: string;
  message: string;
  escalatedAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  assignedStaff: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  convertedLead: { id: string; referenceId: string; serviceType: ServiceType } | null;
  timeline: TimelineEntry[];
}

interface StaffOption {
  id: string;
  name: string;
}

type FetchState = "loading" | "success" | "error";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Received",
  UPDATE: "Updated",
  ESCALATE: "Escalated",
  NOTE: "Note",
  CONVERT: "Converted to lead",
  EMAIL_SENT: "Email sent",
  EMAIL_SKIPPED: "Email skipped",
  EMAIL_FAILED: "Email failed",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const LEAD_SERVICE_OPTIONS = SERVICE_TYPE_OPTIONS.filter((option) => option.value !== "OTHER");

export function EnquiryDetail({ enquiryId, canEdit }: { enquiryId: string; canEdit: boolean }) {
  const [state, setState] = useState<FetchState>("loading");
  const [enquiry, setEnquiry] = useState<EnquiryData | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [convertService, setConvertService] = useState<ServiceType | "">("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<EnquiryData>(`/api/enquiries/${enquiryId}`);
        if (cancelled) return;
        setEnquiry(result);
        setResolution(result.resolutionNote ?? "");
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the enquiry. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [enquiryId, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      try {
        const result = await getJson<StaffOption[]>("/api/staff");
        if (!cancelled) setStaff(result);
      } catch {
        // The assignee picker just stays empty.
      }
    }
    if (canEdit) void loadStaff();
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  if (state === "loading" && !enquiry) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state === "error" || !enquiry) {
    return (
      <ErrorState
        title="Couldn't load the enquiry"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const isComplaint = enquiry.category === "COMPLAINT";
  const converted = enquiry.status === "CONVERTED";
  const editable = canEdit && !converted;
  const reload = () => setReloadNonce((current) => current + 1);

  const update = async (changes: Record<string, unknown>, successMessage: string) => {
    setSaving(true);
    try {
      await patchJson(`/api/enquiries/${enquiry.id}`, changes);
      toast.success(successMessage);
      reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (note.trim().length < 2) return;
    setSaving(true);
    try {
      await postJson(`/api/enquiries/${enquiry.id}/notes`, { note: note.trim() });
      setNote("");
      toast.success("Note added.");
      reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't add the note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const convert = async () => {
    if (!convertService) {
      toast.error("Choose the service for the lead first.");
      return;
    }
    setSaving(true);
    try {
      const result = await postJson<{ leadId: string; referenceId: string }>(`/api/enquiries/${enquiry.id}/convert`, { serviceType: convertService });
      toast.success(`Lead ${result.referenceId} created.`);
      reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't convert. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href={isComplaint ? "/crm/enquiries?view=complaints" : "/crm/enquiries"} className="inline-flex w-fit items-center gap-1 text-sm text-ink-tertiary hover:text-ink-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {isComplaint ? "All complaints" : "All enquiries"}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-ink-heading">{enquiry.reference}</h1>
          <EnquiryCategoryBadge category={enquiry.category} />
          <EnquiryStatusBadge status={enquiry.status} />
        </div>
        <p className="text-sm text-ink-tertiary">Received {formatDateTime(enquiry.createdAt)} via the Contact form</p>
      </div>

      {isComplaint ? (
        <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error/[0.06] p-4 text-sm text-ink-secondary" role="note">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
          <p>
            <span className="font-semibold text-ink-heading">Escalated complaint.</span> Managers were notified
            {enquiry.escalatedAt ? ` on ${formatDateTime(enquiry.escalatedAt)}` : ""}. Complaints stay here and are not converted to leads. Add a resolution
            note before resolving or closing it.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="text-base font-semibold text-ink-heading">{enquiry.subject}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{enquiry.message}</p>
            {enquiry.bookingReference ? (
              <p className="text-xs text-ink-tertiary">
                Booking reference given: <span className="font-medium text-ink-primary">{enquiry.bookingReference}</span>
              </p>
            ) : null}
          </section>

          {converted && enquiry.convertedLead ? (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/[0.06] p-4 text-sm">
              <p className="text-ink-secondary">
                Converted to {SERVICE_TYPE_LABELS[enquiry.convertedLead.serviceType]} lead{" "}
                <span className="font-semibold text-ink-heading">{enquiry.convertedLead.referenceId}</span>.
              </p>
              <Link href={`/crm/leads/${enquiry.convertedLead.id}`} className="inline-flex items-center gap-1 font-medium text-accent-on-light hover:underline">
                Open lead
                <ArrowRightCircle className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          ) : null}

          {editable && !isComplaint ? (
            <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
              <div>
                <h2 className="text-sm font-semibold text-ink-heading">Convert to Lead</h2>
                <p className="text-xs text-ink-tertiary">
                  For a genuine business enquiry. Creates a lead with this customer&apos;s details, the usual reference and &ldquo;request received&rdquo;
                  message, and links it here.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label="Service for the lead"
                  value={convertService}
                  onChange={(event) => setConvertService(event.target.value as ServiceType | "")}
                  disabled={saving}
                  className={cn(fieldControlClass, fieldBorderClass(false), "sm:max-w-xs")}
                >
                  <option value="">Choose a service…</option>
                  {LEAD_SERVICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" onClick={() => void convert()} isLoading={saving} disabled={!convertService} className="h-11">
                  <ArrowRightCircle className="h-4 w-4" aria-hidden="true" />
                  Convert to Lead
                </Button>
              </div>
            </section>
          ) : null}

          {canEdit ? (
            <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
              <h2 className="text-sm font-semibold text-ink-heading">Add an internal note</h2>
              <Textarea label="Note" name="enquiryNote" rows={3} value={note} onChange={(event) => setNote(event.target.value)} hint="Visible to staff only." disabled={saving} />
              <div>
                <Button type="button" size="sm" variant="ghost" onClick={() => void addNote()} disabled={saving || note.trim().length < 2}>
                  <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                  Add note
                </Button>
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink-heading">Activity</h2>
            {enquiry.timeline.length === 0 ? (
              <p className="text-sm text-ink-tertiary">No activity yet.</p>
            ) : (
              <ol className="flex flex-col gap-3 border-l border-hairline pl-4">
                {[...enquiry.timeline].reverse().map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface-base bg-accent" aria-hidden="true" />
                    <p className="text-xs text-ink-tertiary">
                      {formatDateTime(entry.timestamp)} · {ACTION_LABELS[entry.action] ?? entry.action}
                      {entry.byUser ? ` · ${entry.byUser.name}` : ""}
                    </p>
                    {entry.note ? <p className="text-sm text-ink-secondary">{entry.note}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5 text-sm">
            <h2 className="text-sm font-semibold text-ink-heading">Contact</h2>
            <p className="flex items-center gap-2 text-ink-primary">
              <User className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
              {enquiry.fullName}
            </p>
            <a href={`tel:${enquiry.mobile.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 text-ink-secondary hover:text-ink-primary">
              <Phone className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
              {enquiry.mobile}
            </a>
            <a href={`mailto:${enquiry.email}`} className="flex items-center gap-2 break-all text-ink-secondary hover:text-ink-primary">
              <Mail className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
              {enquiry.email}
            </a>
            {enquiry.customer ? (
              <Link href={`/crm/customers/${enquiry.customer.id}`} className="text-xs font-medium text-accent-on-light hover:underline">
                Existing customer — open Customer 360
              </Link>
            ) : (
              <p className="text-xs text-ink-tertiary">Not an existing customer yet.</p>
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="text-sm font-semibold text-ink-heading">Handling</h2>
            <FormField label="Category" htmlFor="enquiryCategory" hint={editable && !isComplaint ? "Choosing Complaint escalates it to managers." : undefined}>
              <select
                id="enquiryCategory"
                value={enquiry.category}
                disabled={!editable || saving}
                onChange={(event) => {
                  const next = event.target.value as EnquiryCategory;
                  void update({ category: next }, next === "COMPLAINT" ? "Marked as a complaint and escalated." : "Category updated.");
                }}
                className={cn(fieldControlClass, fieldBorderClass(false))}
              >
                {ENQUIRY_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {ENQUIRY_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Assigned to" htmlFor="enquiryAssignee">
              <select
                id="enquiryAssignee"
                value={enquiry.assignedStaff?.id ?? ""}
                disabled={!editable || saving}
                onChange={(event) => void update({ assignedStaffId: event.target.value || null }, event.target.value ? "Assigned." : "Unassigned.")}
                className={cn(fieldControlClass, fieldBorderClass(false))}
              >
                <option value="">Unassigned</option>
                {enquiry.assignedStaff && !staff.some((member) => member.id === enquiry.assignedStaff?.id) ? (
                  <option value={enquiry.assignedStaff.id}>{enquiry.assignedStaff.name}</option>
                ) : null}
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" htmlFor="enquiryStatus">
              <select
                id="enquiryStatus"
                value={enquiry.status}
                disabled={!editable || saving}
                onChange={(event) =>
                  void update(
                    { status: event.target.value, ...(resolution.trim() !== (enquiry.resolutionNote ?? "") ? { resolutionNote: resolution } : {}) },
                    "Status updated."
                  )
                }
                className={cn(fieldControlClass, fieldBorderClass(false))}
              >
                {converted ? <option value="CONVERTED">{ENQUIRY_STATUS_LABELS.CONVERTED}</option> : null}
                {ENQUIRY_MANUAL_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {ENQUIRY_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </FormField>
            <Textarea
              label={isComplaint ? "Resolution note (required to resolve)" : "Resolution note"}
              name="resolutionNote"
              rows={3}
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              disabled={!editable || saving}
            />
            {editable ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void update({ resolutionNote: resolution }, "Resolution note saved.")}
                disabled={saving || resolution.trim() === (enquiry.resolutionNote ?? "")}
              >
                Save note
              </Button>
            ) : null}
            {enquiry.resolvedAt ? <p className="text-xs text-ink-tertiary">Closed {formatDateTime(enquiry.resolvedAt)}</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
