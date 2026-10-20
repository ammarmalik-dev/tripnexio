"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { deleteJson, patchJson, ApiError } from "@/lib/api/client";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { useHasPermission } from "@/components/crm/StaffPermissions";
import { toast } from "@/components/ui/Toaster";

interface CustomerBasics {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
  hasAccount: boolean;
  accountDeleted: boolean;
}

/**
 * Client doc 2026-10-20 (L4) — staff edit a customer's name, email and mobile from Customer 360, and a
 * manager / Admin can delete the customer's account. Both ask for a reason and are audited server-side.
 */
export function CustomerAccountControls({ customer, onChanged }: { customer: CustomerBasics; onChanged: () => void }) {
  const canEdit = useHasPermission("leads.edit");
  const canDelete = useHasPermission("leads.reassign");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: customer.name, email: customer.email ?? "", mobile: customer.mobile });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const save = async () => {
    const reason = await confirm({ title: "Save the customer's details?", description: "The change is recorded in the audit log.", confirmLabel: "Save" });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      await patchJson(`/api/customers/${customer.id}`, { ...form, reason });
      toast.success("Customer details saved.");
      setEditing(false);
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the customer.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const reason = await confirm({
      title: `Delete ${customer.name}'s account?`,
      description: "The login is removed and every session ends. Bookings, payments and invoices are kept as the law requires.",
      confirmLabel: "Delete account",
    });
    if (!reason) return;
    try {
      await deleteJson(withReasonQuery(`/api/customers/${customer.id}`, reason));
      toast.success("Account deleted.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete the account.");
    }
  };

  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && !editing ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit details
          </Button>
        ) : null}
        {canDelete && customer.hasAccount && !customer.accountDeleted ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} className="text-error">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete account
          </Button>
        ) : null}
        {customer.accountDeleted ? <span className="rounded-full bg-error/10 px-2.5 py-1 text-xs font-medium text-error">Account deleted</span> : null}
      </div>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField label="Name" name="customer-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name?.[0]} disabled={saving} />
          <TextField label="Email" name="customer-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email?.[0]} disabled={saving} />
          <TextField label="Mobile" name="customer-mobile" type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} error={errors.mobile?.[0]} disabled={saving} />
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} isLoading={saving}>
              Save
            </Button>
          </div>
        </div>
      ) : null}
      {dialog}
    </div>
  );
}
