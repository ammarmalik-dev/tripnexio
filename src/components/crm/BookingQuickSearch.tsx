"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ApiError, getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface BookingHit {
  id: string;
  bookingId: string;
  customer: { name: string; mobile: string };
  internalStatus: string | null;
}

/**
 * Client doc 16 Nov (K4) — a small Booking Search icon on list screens: type a Booking ID (or the customer's name /
 * mobile), Enter opens an exact Booking ID match straight away, otherwise the first few matches are listed.
 * Uses the Bookings list API, so service scope and ownership apply as usual.
 */
export function BookingQuickSearch({ basePath = "/crm/bookings" }: { basePath?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BookingHit[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const search = async () => {
    const term = query.trim();
    if (term.length < 2) return;
    setState("loading");
    try {
      const result = await getJson<{ items: BookingHit[] }>(`/api/bookings?search=${encodeURIComponent(term)}&page=1&pageSize=5`);
      const exact = result.items.find((item) => item.bookingId.toLowerCase() === term.toLowerCase());
      if (exact) {
        setOpen(false);
        router.push(`${basePath}/${exact.id}`);
        return;
      }
      setHits(result.items);
      setState("idle");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Couldn't search bookings.");
      setState("error");
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Booking search"
        title="Booking search"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </Button>
      {open ? (
        <div id={panelId} role="dialog" aria-label="Booking search" className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-hairline bg-surface-1 p-3 shadow-lg">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Booking ID, name or mobile
            </label>
            <input
              id={`${panelId}-input`}
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Booking ID, name or mobile"
              className={cn(fieldControlClass, fieldBorderClass(false), "h-9 flex-1 text-sm")}
            />
            <Button type="submit" size="sm" isLoading={state === "loading"} disabled={query.trim().length < 2}>
              Go
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Close booking search">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
          {state === "error" ? <p className="mt-2 text-xs text-error">{message}</p> : null}
          {hits ? (
            hits.length === 0 ? (
              <p className="mt-2 text-xs text-ink-tertiary">No booking matches.</p>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-hairline">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <Link href={`${basePath}/${hit.id}`} onClick={() => setOpen(false)} className="flex flex-col rounded-md px-2 py-1.5 text-sm hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                      <span className="font-semibold text-ink-accent">{hit.bookingId}</span>
                      <span className="text-xs text-ink-tertiary">
                        {hit.customer.name} · {hit.customer.mobile}
                        {hit.internalStatus ? ` · ${hit.internalStatus}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
