"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

interface VendorService {
  id: string;
  service: ServiceType;
}

interface VendorData {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  pocName: string | null;
  processingDetails: string | null;
  availability: string | null;
  gstNumber: string | null;
  paymentDetails: string | null;
  active: boolean;
  services: VendorService[];
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  name: string;
  services: ServiceType[];
  mobile: string;
  email: string;
  pocName: string;
  processingDetails: string;
  availability: string;
  gstNumber: string;
  paymentDetails: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  services: [],
  mobile: "",
  email: "",
  pocName: "",
  processingDetails: "",
  availability: "",
  gstNumber: "",
  paymentDetails: "",
};

function toFormState(vendor: VendorData): FormState {
  return {
    name: vendor.name,
    services: vendor.services.map((entry) => entry.service),
    mobile: vendor.mobile ?? "",
    email: vendor.email ?? "",
    pocName: vendor.pocName ?? "",
    processingDetails: vendor.processingDetails ?? "",
    availability: vendor.availability ?? "",
    gstNumber: vendor.gstNumber ?? "",
    paymentDetails: vendor.paymentDetails ?? "",
  };
}

function ServiceChecklist({
  selected,
  onToggle,
  disabled,
  error,
}: {
  selected: ServiceType[];
  onToggle: (service: ServiceType) => void;
  disabled: boolean;
  error?: string;
}) {
  const selectedSet = new Set(selected);
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink-primary">
        Service Coverage <span className="text-error">*</span>
      </span>
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-hairline p-3 sm:grid-cols-2">
        {SERVICE_TYPE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selectedSet.has(option.value)}
              disabled={disabled}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
      <p className="mt-1 text-xs text-ink-tertiary">One vendor can support multiple services — no need to create it again per service.</p>
    </div>
  );
}

function VendorFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
}) {
  const toggleService = (service: ServiceType) => {
    const next = form.services.includes(service) ? form.services.filter((entry) => entry !== service) : [...form.services, service];
    onChange({ ...form, services: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Vendor Name"
          name="name"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          error={errors.name?.[0]}
          disabled={disabled}
        />
        <TextField
          label="POC Name"
          name="pocName"
          value={form.pocName}
          onChange={(event) => onChange({ ...form, pocName: event.target.value })}
          error={errors.pocName?.[0]}
          disabled={disabled}
          hint="Point of contact at the vendor"
        />
        <TextField
          label="Mobile"
          name="mobile"
          value={form.mobile}
          onChange={(event) => onChange({ ...form, mobile: event.target.value })}
          error={errors.mobile?.[0]}
          disabled={disabled}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
          error={errors.email?.[0]}
          disabled={disabled}
        />
        <TextField
          label="GST Number"
          name="gstNumber"
          value={form.gstNumber}
          onChange={(event) => onChange({ ...form, gstNumber: event.target.value })}
          error={errors.gstNumber?.[0]}
          disabled={disabled}
          hint="Optional — where applicable"
        />
        <TextField
          label="Availability"
          name="availability"
          value={form.availability}
          onChange={(event) => onChange({ ...form, availability: event.target.value })}
          error={errors.availability?.[0]}
          disabled={disabled}
          hint="e.g. Mon–Sat, 9am–8pm IST"
        />
      </div>
      <ServiceChecklist selected={form.services} onToggle={toggleService} disabled={disabled} error={errors.services?.[0]} />
      <Textarea
        label="Processing Details"
        name="processingDetails"
        value={form.processingDetails}
        onChange={(event) => onChange({ ...form, processingDetails: event.target.value })}
        error={errors.processingDetails?.[0]}
        disabled={disabled}
        rows={3}
        hint="How this vendor typically processes requests, turnaround notes, etc."
      />
      <Textarea
        label="Account / Payment Details"
        name="paymentDetails"
        value={form.paymentDetails}
        onChange={(event) => onChange({ ...form, paymentDetails: event.target.value })}
        error={errors.paymentDetails?.[0]}
        disabled={disabled}
        rows={3}
        hint="Bank/account details for settling this vendor — internal only"
      />
    </div>
  );
}

function buildPayload(form: FormState) {
  return {
    name: form.name.trim(),
    services: form.services,
    mobile: form.mobile.trim() || undefined,
    email: form.email.trim() || undefined,
    pocName: form.pocName.trim() || undefined,
    processingDetails: form.processingDetails.trim() || undefined,
    availability: form.availability.trim() || undefined,
    gstNumber: form.gstNumber.trim() || undefined,
    paymentDetails: form.paymentDetails.trim() || undefined,
  };
}

function VendorCard({ vendor, onSaved }: { vendor: VendorData; onSaved: (vendor: VendorData) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(vendor));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(vendor));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<VendorData>(`/api/admin/vendors/${vendor.id}`, buildPayload(form));
      toast.success(`Vendor "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this vendor. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<VendorData>(`/api/admin/vendors/${vendor.id}`, { active: !vendor.active });
      toast.success(updated.active ? `${updated.name} enabled.` : `${updated.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this vendor. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", vendor.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
        >
          {vendor.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {vendor.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <VendorFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewVendorForm({ onCreated }: { onCreated: (vendor: VendorData) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<VendorData>("/api/admin/vendors", buildPayload(form));
      toast.success(`Vendor "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this vendor. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.name.trim() && form.services.length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Vendor</h2>
      <VendorFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Vendor
        </Button>
      </div>
    </div>
  );
}

export function VendorsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<VendorData[]>("/api/admin/vendors");
        if (cancelled) return;
        setVendors(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load vendors. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load vendors"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {vendors.length === 0 ? (
        <EmptyState title="No vendors yet" description="Add the first one using the form below." />
      ) : (
        vendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            onSaved={(updated) => setVendors((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewVendorForm onCreated={(created) => setVendors((current) => [...current, created])} />
    </div>
  );
}
