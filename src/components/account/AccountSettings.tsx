"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { toast } from "@/components/ui/Toaster";
import { ApiError, postJson } from "@/lib/api/client";

type Field = "email" | "mobile";

/**
 * Client doc 2026-10-15 (J7) — change the email or mobile on the account (confirmed by a 6-digit code
 * emailed to the customer) and delete the account. The API does every check; this only collects input.
 */
export function ContactChangeForm({ field, current }: { field: Field; current: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = field === "email" ? "email" : "mobile number";

  const reset = () => {
    setOpen(false);
    setValue("");
    setCode("");
    setSentTo(null);
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!sentTo) {
        const result = await postJson<{ maskedEmail: string }>("/api/account/contact", { field, value: value.trim() });
        setSentTo(result.maskedEmail);
        toast.success(`Code sent to ${result.maskedEmail}.`);
      } else {
        await postJson("/api/account/contact", { field, value: value.trim(), code: code.trim() });
        toast.success(`Your ${label} has been updated.`);
        reset();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-ink-accent hover:underline">
        Change {label}
      </button>
    );
  }

  return (
    <div className="mt-2 flex w-full flex-col gap-3 rounded-lg border border-hairline bg-surface-2 p-4">
      <TextField
        label={`New ${label}`}
        name={`new-${field}`}
        type={field === "email" ? "email" : "tel"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={busy || !!sentTo}
        hint={current ? `Current: ${current}` : undefined}
      />
      {sentTo ? (
        <TextField
          label="6-digit code"
          name={`code-${field}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={busy}
          hint={`We emailed it to ${sentTo}. It expires in 10 minutes.`}
        />
      ) : (
        <p className="text-xs text-ink-tertiary">
          {field === "email" ? "We'll email a code to the new address to confirm it's yours." : "We'll email a code to your current email to confirm it's you."}
        </p>
      )}
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void submit()} isLoading={busy} disabled={sentTo ? !/^\d{6}$/.test(code.trim()) : value.trim().length < 5}>
          {sentTo ? "Confirm change" : "Send code"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function DeleteAccountForm() {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "confirm" | "code">("idle");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ maskedEmail: string }>("/api/account/delete", {});
      setSentTo(result.maskedEmail);
      setStage("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/account/delete", { code: code.trim() });
      toast.success("Your account has been deleted.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        Deleting your account removes your login and signs you out everywhere. Your booking, payment and invoice records are kept as the law requires, and
        uploaded documents are deleted after the retention period. You can sign up again any time.
      </p>
      {stage === "idle" ? (
        <Button type="button" size="sm" variant="ghost" className="self-start text-error" onClick={() => setStage("confirm")}>
          Delete my account
        </Button>
      ) : null}
      {stage === "confirm" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="bg-error" onClick={() => void sendCode()} isLoading={busy}>
            Yes, email me a code
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setStage("idle")} disabled={busy}>
            Cancel
          </Button>
        </div>
      ) : null}
      {stage === "code" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-error/30 bg-error/5 p-4">
          <TextField
            label="6-digit code"
            name="delete-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={busy}
            hint={`We emailed it to ${sentTo ?? "your email"}.`}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="bg-error" onClick={() => void confirmDelete()} isLoading={busy} disabled={!/^\d{6}$/.test(code.trim())}>
              Delete account permanently
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setStage("idle")} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
