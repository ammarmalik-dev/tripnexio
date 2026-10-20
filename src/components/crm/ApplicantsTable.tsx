"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { ApplicantRow } from "@/lib/new-visa/applicants";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { patchJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const PAX_LABELS: Record<string, string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };
const RELATIONSHIP_LABELS: Record<string, string> = { FATHER: "Father", MOTHER: "Mother" };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

type PassengerDraft = { fullName: string; paxType: "ADULT" | "CHILD" | "INFANT"; dob: string; passportNumber: string };
const EMPTY_DRAFT: PassengerDraft = { fullName: "", paxType: "ADULT", dob: "", passportNumber: "" };

/** Client doc 2026-10-20 (A4) — add a missing traveller or correct one (name, type, DOB, passport). */
function PassengerEditor({
  leadId,
  passengerId,
  initial,
  onDone,
  onCancel,
}: {
  leadId: string;
  passengerId: string | null;
  initial: PassengerDraft;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const key = passengerId ?? "new";
  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (passengerId) await patchJson(`/api/passengers/${passengerId}`, draft);
      else await postJson(`/api/leads/${leadId}/passengers`, draft);
      toast.success(passengerId ? "Passenger updated." : "Passenger added.");
      onDone();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors ?? {});
      toast.error(error instanceof ApiError ? error.message : "Could not save the passenger.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <TextField label="Full name" name={`pax-name-${key}`} value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} error={errors.fullName?.[0]} />
        <FormField label="Type" htmlFor={`pax-type-${key}`} error={errors.paxType?.[0]}>
          <select
            id={`pax-type-${key}`}
            value={draft.paxType}
            onChange={(e) => setDraft({ ...draft, paxType: e.target.value as PassengerDraft["paxType"] })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.paxType))}
          >
            <option value="ADULT">Adult</option>
            <option value="CHILD">Child</option>
            <option value="INFANT">Infant</option>
          </select>
        </FormField>
        <TextField label="Date of birth" type="date" name={`pax-dob-${key}`} value={draft.dob} onChange={(e) => setDraft({ ...draft, dob: e.target.value })} error={errors.dob?.[0]} />
        <TextField label="Passport number" name={`pax-passport-${key}`} value={draft.passportNumber} onChange={(e) => setDraft({ ...draft, passportNumber: e.target.value })} error={errors.passportNumber?.[0]} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={draft.fullName.trim().length < 2}>
          {passengerId ? "Save passenger" : "Add passenger"}
        </Button>
      </div>
    </div>
  );
}

/**
 * P11 — every applicant on a request: passport, DOB, occupation, passenger type and (for a minor) the guardian.
 * With `editable`, staff can add a missing passenger or correct one (client doc 2026-10-20, A4).
 */
export function ApplicantsTable({ applicants, editable }: { applicants: ApplicantRow[]; editable?: { leadId: string; onChanged: () => void } }) {
  // A large group request can list many applicants; the pager only appears past one default page.
  const { pageItems, paginationProps } = useClientPagination(applicants);
  const [editing, setEditing] = useState<string | null>(null);
  const hasGuardian = applicants.some((a) => a.guardianName);
  const editingRow = editing && editing !== "new" ? applicants.find((a) => a.passengerId === editing) : null;
  const editor =
    editable && editing ? (
      <PassengerEditor
        leadId={editable.leadId}
        passengerId={editing === "new" ? null : editing}
        initial={
          editingRow
            ? { fullName: editingRow.fullName, paxType: (editingRow.paxType ?? "ADULT") as PassengerDraft["paxType"], dob: editingRow.dob?.slice(0, 10) ?? "", passportNumber: editingRow.passportNumber ?? "" }
            : EMPTY_DRAFT
        }
        onCancel={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          editable.onChanged();
        }}
      />
    ) : null;
  const addButton = editable ? (
    <div className="flex justify-end">
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing("new")} disabled={editing !== null}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add passenger
      </Button>
    </div>
  ) : null;
  if (applicants.length === 0)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-tertiary">No applicants recorded.</p>
        {addButton}
        {editor}
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {addButton}
      {editor}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-ink-tertiary">
          <tr className="border-b border-hairline">
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="py-2 pr-3 font-medium">Passport</th>
            <th className="py-2 pr-3 font-medium">DOB</th>
            <th className="py-2 pr-3 font-medium">Type</th>
            <th className="py-2 pr-3 font-medium">Occupation</th>
            {hasGuardian ? <th className="py-2 pr-3 font-medium">Guardian</th> : null}
            {editable ? <th className="py-2 pr-3 font-medium sr-only">Edit</th> : null}
          </tr>
        </thead>
        <tbody>
          {pageItems.map((applicant, index) => (
            <tr key={applicant.passengerId ?? `row-${index}-${applicant.fullName}`} className="border-b border-hairline last:border-b-0 align-top hover:bg-ink-primary/[0.02]">
              <td className="py-2 pr-3 font-medium text-ink-primary">{applicant.fullName || "—"}</td>
              <td className="py-2 pr-3 text-ink-secondary">
                {applicant.passportNumber ?? "—"}
                {applicant.passportExpiry ? <span className="block text-xs text-ink-tertiary">expires {formatDate(applicant.passportExpiry)}</span> : null}
              </td>
              <td className="py-2 pr-3 text-ink-secondary">{formatDate(applicant.dob)}</td>
              <td className="py-2 pr-3 text-ink-secondary">{applicant.paxType ? PAX_LABELS[applicant.paxType] : "—"}</td>
              <td className="py-2 pr-3 text-ink-secondary">{applicant.occupation ?? "—"}</td>
              {hasGuardian ? (
                <td className="py-2 pr-3 text-ink-secondary">
                  {applicant.guardianName ? (
                    <>
                      {applicant.guardianName}
                      <span className="block text-xs text-ink-tertiary">
                        {applicant.guardianPassport ?? "—"}
                        {applicant.guardianRelationship ? ` · ${RELATIONSHIP_LABELS[applicant.guardianRelationship] ?? applicant.guardianRelationship}` : ""}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
              {editable ? (
                <td className="py-2 pr-3 text-right">
                  {applicant.passengerId ? (
                    <button
                      type="button"
                      onClick={() => setEditing(applicant.passengerId)}
                      disabled={editing !== null}
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink-accent hover:underline disabled:opacity-50"
                      aria-label={`Edit ${applicant.fullName}`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {applicants.length > DEFAULT_PAGE_SIZE ? <ListPagination noun="applicant" {...paginationProps} /> : null}
    </div>
  );
}
