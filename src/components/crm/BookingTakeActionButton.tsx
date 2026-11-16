"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toaster";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface AllowedStatus {
  id: string;
  name: string;
  customerLabel: string | null;
  notifies?: boolean;
  inputs?: string[];
}

interface StatusOptions {
  current: { name: string; isTerminal: boolean } | null;
  allowed: AllowedStatus[];
  panelOnly?: { id: string; name: string }[];
}

/** Statuses whose customer message needs a reason (same rule as the booking page's status card). */
const REASON_REQUIRED = /hold|reject|not accepted|not eligible|unable/i;

/**
 * Client doc 16 Nov (G2) — one "Take Action" button on the right of each booking row. It shows only the moves this
 * booking may make now (the server's own list: service, stage, hand-over, documents, refunds), never every status.
 * A move that needs a customer-safe reason / charges, or a step taken from the Operations panel (vendor, documents),
 * opens the booking instead. The server re-checks every move.
 */
export function BookingTakeActionButton({ bookingId, href, onChanged }: { bookingId: string; href: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<StatusOptions | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirming, setConfirming] = useState<AllowedStatus | null>(null);
  const [pending, setPending] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<StatusOptions>(`/api/bookings/${bookingId}/status`);
        if (cancelled) return;
        setOptions(result);
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = async (status: AllowedStatus) => {
    setPending(true);
    try {
      await patchJson(`/api/bookings/${bookingId}/status`, { serviceStatusId: status.id });
      toast.success(`Moved to ${status.name}.`);
      setOpen(false);
      setConfirming(null);
      setOptions(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't change the status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const needsDetails = (status: AllowedStatus) => (status.inputs ?? []).length > 0 && REASON_REQUIRED.test(status.name);

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((value) => !value);
          setConfirming(null);
        }}
      >
        Take Action
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      {open ? (
        <div id={menuId} role="menu" className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-hairline bg-surface-1 p-2 text-left shadow-lg">
          {loadError ? (
            <p className="px-2 py-1.5 text-xs text-error">Couldn&apos;t load the actions.</p>
          ) : !options ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex flex-col gap-1">
              {options.current ? <p className="px-2 pb-1 text-[11px] text-ink-tertiary">Now: {options.current.name}</p> : null}
              {confirming ? (
                <div className="flex flex-col gap-2 rounded-lg bg-accent/5 p-2">
                  <p className="text-xs text-ink-primary">
                    Move to <strong>{confirming.name}</strong>
                    {confirming.notifies ? " — the customer gets an email + WhatsApp." : " — internal, no message."}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>
                      Back
                    </Button>
                    <Button type="button" size="sm" onClick={() => void apply(confirming)} isLoading={pending}>
                      Confirm
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {options.allowed.length === 0 && (options.panelOnly ?? []).length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-ink-tertiary">
                      {options.current?.isTerminal ? "Final status — no further actions." : "Nothing to move by hand — the next step happens with its action (documents, payment, Operations panel)."}
                    </p>
                  ) : null}
                  {options.allowed.map((status) =>
                    needsDetails(status) ? (
                      <Link key={status.id} role="menuitem" href={`${href}#status`} className="rounded-lg px-2 py-1.5 text-sm text-ink-primary hover:bg-ink-primary/[0.04]">
                        {status.name} <span className="text-[11px] text-ink-tertiary">(add the reason on the booking)</span>
                      </Link>
                    ) : (
                      <button
                        key={status.id}
                        type="button"
                        role="menuitem"
                        onClick={() => setConfirming(status)}
                        className={cn("flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink-primary hover:bg-ink-primary/[0.04]")}
                      >
                        {status.name}
                        {status.notifies ? <Mail className="h-3.5 w-3.5 text-ink-tertiary" aria-label="Customer is notified" /> : null}
                      </button>
                    )
                  )}
                  {(options.panelOnly ?? []).map((step) => (
                    <Link key={step.id} role="menuitem" href={href} className="rounded-lg px-2 py-1.5 text-sm text-ink-primary hover:bg-ink-primary/[0.04]">
                      {step.name} <span className="text-[11px] text-ink-tertiary">(Operations panel)</span>
                    </Link>
                  ))}
                  <Link role="menuitem" href={href} className="mt-1 border-t border-hairline px-2 pt-2 text-xs font-medium text-ink-accent">
                    Open booking
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
