"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

export interface TermsView {
  title: string;
  body: string;
  version: number;
}

/**
 * The mandatory "I agree to the Terms & Conditions" step before payment
 * (P09). Shows the service's own Terms when Admin has published them, else
 * links to the general website Terms. The server records the acceptance
 * (version, time, IP) and refuses payment without it.
 */
export function TermsCheckbox({
  terms,
  checked,
  onChange,
  id,
}: {
  terms: TermsView | null;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      {terms ? (
        <div className="flex flex-col gap-2">
          <button type="button" className="w-fit text-sm font-medium text-ink-accent underline" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {open ? "Hide" : "Read"} {terms.title}
          </button>
          {open ? (
            <div className="max-h-64 overflow-auto whitespace-pre-line rounded-lg bg-surface-2 p-4 text-xs text-ink-secondary">{terms.body}</div>
          ) : null}
        </div>
      ) : null}
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-ink-secondary">
        <input id={id} type="checkbox" className="mt-0.5" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>
          I agree to the{" "}
          {terms ? (
            "Terms & Conditions above"
          ) : (
            <Link href="/legal/terms" target="_blank" className="text-ink-accent underline">
              Terms &amp; Conditions
            </Link>
          )}
          .
        </span>
      </label>
    </div>
  );
}

/** Pay page step: agree, then the payment option appears. */
export function TermsAgreement({ token, terms, onAccepted }: { token: string; terms: TermsView | null; onAccepted: () => void }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    setSaving(true);
    try {
      await postJson(`/api/pay/${token}/accept-terms`, { accepted: true });
      onAccepted();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save your agreement. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <TermsCheckbox terms={terms} checked={checked} onChange={setChecked} id="pay-terms" />
      <Button type="button" size="lg" onClick={() => void accept()} isLoading={saving} disabled={!checked}>
        Agree &amp; continue to payment
      </Button>
    </div>
  );
}
