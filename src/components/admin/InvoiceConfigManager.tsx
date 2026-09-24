"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface ConfigData {
  id: string;
  companyGstNumber: string | null;
  companyLogoUrl: string | null;
  defaultSacCode: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankName: string | null;
  bankBranch: string | null;
  termsAndNotes: string;
  signatoryName: string | null;
  signatoryTitle: string | null;
  signatureImageUrl: string | null;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;

interface FormState {
  companyGstNumber: string;
  defaultSacCode: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  bankName: string;
  bankBranch: string;
  termsAndNotes: string;
  signatoryName: string;
  signatoryTitle: string;
}

function toFormState(c: ConfigData): FormState {
  return {
    companyGstNumber: c.companyGstNumber ?? "",
    defaultSacCode: c.defaultSacCode ?? "",
    bankAccountName: c.bankAccountName ?? "",
    bankAccountNumber: c.bankAccountNumber ?? "",
    bankIfscCode: c.bankIfscCode ?? "",
    bankName: c.bankName ?? "",
    bankBranch: c.bankBranch ?? "",
    termsAndNotes: c.termsAndNotes,
    signatoryName: c.signatoryName ?? "",
    signatoryTitle: c.signatoryTitle ?? "",
  };
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function ImageUploadRow({
  label,
  currentUrl,
  onUpload,
  onRemove,
  uploading,
}: {
  label: string;
  currentUrl: string | null;
  onUpload: (base64: string, mimeType: string) => void;
  onRemove: () => void;
  uploading: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Please upload a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too large (4MB max).");
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      onUpload(base64, file.type);
    } catch {
      setError("Couldn't read that file — please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-heading">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-only preview of an uploaded file, not a public page image
          <img src={currentUrl} alt={label} className="h-14 w-auto rounded border border-hairline bg-white object-contain p-1" />
        ) : (
          <span className="text-xs text-ink-tertiary">Not uploaded yet.</span>
        )}
        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-hairline px-3 text-xs font-medium text-ink-primary hover:border-glass-border">
          <input type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void handleChange(event)} disabled={uploading} />
          {currentUrl ? "Replace" : "Upload"}
        </label>
        {currentUrl ? (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove} disabled={uploading}>
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}

/**
 * Step 44 (Admin FINAL handover §13). One singleton config used by every
 * invoice PDF (both /api/payments/[id]/invoice and /api/quotations/[id]/invoice
 * — see src/lib/invoices/company-config.ts). Logo/signature upload each
 * PATCH immediately (not gated behind "Save Changes") since a file input
 * has no natural "unsaved" state to hold; every text field saves together.
 */
export function InvoiceConfigManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<ConfigData>("/api/admin/invoice-config");
        if (cancelled) return;
        setConfig(result);
        setForm(toFormState(result));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load invoice settings. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading" || !form) return <Skeleton className="h-96 w-full" />;
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load invoice settings"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }
  if (!config) return null;

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(config));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<ConfigData>("/api/admin/invoice-config", form);
      toast.success("Invoice settings updated.");
      setConfig(updated);
      setForm(toFormState(updated));
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (base64: string, mimeType: string) => {
    setUploadingLogo(true);
    try {
      const updated = await patchJson<ConfigData>("/api/admin/invoice-config", { logoImageBase64: base64, logoImageMimeType: mimeType });
      toast.success("Logo updated.");
      setConfig(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload the logo. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    setUploadingLogo(true);
    try {
      const updated = await patchJson<ConfigData>("/api/admin/invoice-config", { removeLogo: true });
      toast.success("Logo removed.");
      setConfig(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove the logo. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureUpload = async (base64: string, mimeType: string) => {
    setUploadingSignature(true);
    try {
      const updated = await patchJson<ConfigData>("/api/admin/invoice-config", { signatureImageBase64: base64, signatureImageMimeType: mimeType });
      toast.success("Signature updated.");
      setConfig(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload the signature. Please try again.");
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSignatureRemove = async () => {
    setUploadingSignature(true);
    try {
      const updated = await patchJson<ConfigData>("/api/admin/invoice-config", { removeSignature: true });
      toast.success("Signature removed.");
      setConfig(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove the signature. Please try again.");
    } finally {
      setUploadingSignature(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Company GST Number"
          name="companyGstNumber"
          placeholder="Not set"
          value={form.companyGstNumber}
          onChange={(event) => setForm({ ...form, companyGstNumber: event.target.value })}
          error={errors.companyGstNumber?.[0]}
          disabled={saving}
        />
        <TextField
          label="Default SAC Code"
          name="defaultSacCode"
          placeholder="e.g. 9985"
          hint="Services Accounting Code shown on every invoice line item."
          value={form.defaultSacCode}
          onChange={(event) => setForm({ ...form, defaultSacCode: event.target.value })}
          error={errors.defaultSacCode?.[0]}
          disabled={saving}
        />
      </div>

      <ImageUploadRow label="Company Logo" currentUrl={config.companyLogoUrl} onUpload={(b, m) => void handleLogoUpload(b, m)} onRemove={() => void handleLogoRemove()} uploading={uploadingLogo} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Bank Account Name"
          name="bankAccountName"
          value={form.bankAccountName}
          onChange={(event) => setForm({ ...form, bankAccountName: event.target.value })}
          error={errors.bankAccountName?.[0]}
          disabled={saving}
        />
        <TextField
          label="Bank Account Number"
          name="bankAccountNumber"
          value={form.bankAccountNumber}
          onChange={(event) => setForm({ ...form, bankAccountNumber: event.target.value })}
          error={errors.bankAccountNumber?.[0]}
          disabled={saving}
        />
        <TextField
          label="IFSC Code"
          name="bankIfscCode"
          value={form.bankIfscCode}
          onChange={(event) => setForm({ ...form, bankIfscCode: event.target.value })}
          error={errors.bankIfscCode?.[0]}
          disabled={saving}
        />
        <TextField
          label="Bank Name & Branch"
          name="bankName"
          value={form.bankName}
          onChange={(event) => setForm({ ...form, bankName: event.target.value })}
          error={errors.bankName?.[0]}
          disabled={saving}
        />
      </div>

      <Textarea
        label="Terms & Notes"
        name="termsAndNotes"
        hint="Printed near the bottom of every invoice."
        value={form.termsAndNotes}
        onChange={(event) => setForm({ ...form, termsAndNotes: event.target.value })}
        error={errors.termsAndNotes?.[0]}
        disabled={saving}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Signatory Name"
          name="signatoryName"
          value={form.signatoryName}
          onChange={(event) => setForm({ ...form, signatoryName: event.target.value })}
          error={errors.signatoryName?.[0]}
          disabled={saving}
        />
        <TextField
          label="Signatory Title"
          name="signatoryTitle"
          placeholder="e.g. Authorised Signatory"
          value={form.signatoryTitle}
          onChange={(event) => setForm({ ...form, signatoryTitle: event.target.value })}
          error={errors.signatoryTitle?.[0]}
          disabled={saving}
        />
      </div>

      <ImageUploadRow
        label="Signature Image"
        currentUrl={config.signatureImageUrl}
        onUpload={(b, m) => void handleSignatureUpload(b, m)}
        onRemove={() => void handleSignatureRemove()}
        uploading={uploadingSignature}
      />

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
