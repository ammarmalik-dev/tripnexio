"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { SENSITIVE_REASON_MAX_LENGTH, SENSITIVE_REASON_MIN_LENGTH } from "@/lib/validation/sensitive-action";
import { cn } from "@/lib/cn";

/**
 * Business Rules §14 "Sensitive Admin Actions" — required flow is
 * "Permission Check → Extra Confirmation → Execute → Audit Log". Permission
 * check and audit log happen server-side on every route this backs; this
 * component is the "Extra Confirmation" step, shared across every sensitive
 * action listed there (refund, vendor change, pricing change, delete, bulk
 * reassignment, document requirements, GST/tax config, workflow/status
 * config, financial adjustments) instead of a bespoke confirm step per
 * screen. The typed reason is what actually gets recorded in the audit note
 * server-side (`reason` in the request body, or `?reason=` for DELETE) —
 * this dialog only collects it.
 *
 * Two ways to use it:
 * - Imperatively via `useConfirmAction()` (preferred for new call sites):
 *   `const reason = await confirm({ title, description }); if (!reason) return;`
 * - Controlled, by rendering `<ConfirmActionDialog … />` conditionally with
 *   `pending`/`onConfirm`/`onCancel` (keeps the dialog open with a loading
 *   state while the request runs).
 */
export interface ConfirmActionDialogProps {
  title: string;
  /** What will happen if the action is confirmed — shown under the title. */
  description: ReactNode;
  confirmLabel?: string;
  /** Pre-fills the reason (e.g. from a reason the form already collected) — still editable, still required. */
  defaultReason?: string;
  /** Shows a spinner on Confirm and blocks Cancel/Escape while a request is in flight. */
  pending?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function ConfirmActionDialog({
  title,
  description,
  confirmLabel = "Confirm",
  defaultReason = "",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trapFocus = useFocusTrap(containerRef, true);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const reasonId = `${baseId}-reason`;
  const errorId = `${baseId}-error`;

  // Portal target only exists on the client; restore focus to whatever opened the dialog on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => {
      cancelAnimationFrame(frame);
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    if (mounted) textareaRef.current?.focus();
  }, [mounted]);

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed.length < SENSITIVE_REASON_MIN_LENGTH) {
      setError(`Enter a reason (at least ${SENSITIVE_REASON_MIN_LENGTH} characters) before confirming.`);
      textareaRef.current?.focus();
      return;
    }
    setError("");
    onConfirm(trimmed);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!pending) onCancel();
            return;
          }
          trapFocus(event);
        }}
        className="glass-overlay w-full max-w-md rounded-xl p-5"
      >
        <h2 id={titleId} className="text-sm font-semibold text-ink-heading">
          {title}
        </h2>
        <div id={descriptionId} className="mt-1.5 text-sm text-ink-secondary">
          {description}
        </div>
        <form
          className="mt-4"
          noValidate
          onSubmit={(event) => {
            // React events bubble through portals to the React parent — never let this submit reach a surrounding <form>.
            event.preventDefault();
            event.stopPropagation();
            handleConfirm();
          }}
        >
          <label htmlFor={reasonId} className="text-sm font-medium text-ink-heading">
            Reason
            <span className="ml-0.5 text-error" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            ref={textareaRef}
            id={reasonId}
            name="confirm-action-reason"
            rows={3}
            required
            maxLength={SENSITIVE_REASON_MAX_LENGTH}
            placeholder="Why is this action being taken? (recorded in the audit trail)"
            value={reason}
            disabled={pending}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setReason(event.target.value);
              if (error && event.target.value.trim().length >= SENSITIVE_REASON_MIN_LENGTH) setError("");
            }}
            className={cn(fieldControlClass, fieldBorderClass(!!error), "mt-1.5 h-auto py-2.5")}
          />
          {error ? (
            <p id={errorId} role="alert" className="mt-1 text-xs text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export interface ConfirmActionOptions {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  defaultReason?: string;
}

/**
 * Promise-based wrapper around ConfirmActionDialog so a call site only needs
 * two extra lines:
 *
 *   const { confirm, dialog } = useConfirmAction();
 *   …
 *   const reason = await confirm({ title: "Delete airport?", description: "…" });
 *   if (!reason) return; // cancelled
 *   await deleteJson(withReasonQuery(url, reason));
 *   …
 *   return <>{…}{dialog}</>;
 *
 * `confirm` resolves with the trimmed reason, or `null` when cancelled. The
 * dialog closes as soon as the reason is entered — the call site keeps its
 * own loading/toast handling for the request itself.
 */
export function useConfirmAction() {
  const [request, setRequest] = useState<(ConfirmActionOptions & { resolve: (reason: string | null) => void }) | null>(null);
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  // Resolve a still-open prompt as cancelled if the component unmounts.
  useEffect(() => {
    const latest = requestRef;
    return () => latest.current?.resolve(null);
  }, []);

  const confirm = useCallback(
    (options: ConfirmActionOptions) =>
      new Promise<string | null>((resolve) => {
        setRequest((previous) => {
          previous?.resolve(null);
          return { ...options, resolve };
        });
      }),
    []
  );

  const dialog = request ? (
    <ConfirmActionDialog
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel}
      defaultReason={request.defaultReason}
      onConfirm={(reason) => {
        request.resolve(reason);
        setRequest(null);
      }}
      onCancel={() => {
        request.resolve(null);
        setRequest(null);
      }}
    />
  ) : null;

  return { confirm, dialog };
}
