"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface SearchResultItem {
  type: "lead" | "booking";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const RESULT_TYPE_LABELS: Record<SearchResultItem["type"], string> = {
  lead: "Lead",
  booking: "Booking",
};

/**
 * Step 24 (audit §4.6) — ADMIN.md §9's global search, in the CRM/Admin
 * topbar (shared by both — see CrmTopbar.tsx). Debounced the same 300ms as
 * LeadsTable's own search field for a consistent feel across the app.
 */
export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (query.length < 2) {
        setResults([]);
        setErrorMessage("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage("");
      try {
        const result = await getJson<{ query: string; results: SearchResultItem[] }>(
          `/api/search?q=${encodeURIComponent(query)}`
        );
        if (cancelled) return;
        setResults(result.results);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Search failed. Please try again.");
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResultItem) => {
    setOpen(false);
    setInput("");
    setQuery("");
    router.push(result.href);
  };

  const showDropdown = open && query.length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search lead reference, booking ID, customer name or mobile…"
          className="h-9 w-full rounded-md border border-hairline bg-surface-2 pr-3 pl-9 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-ink-accent focus:outline-none"
          aria-label="Global search"
        />
        {loading ? <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-ink-tertiary" aria-hidden="true" /> : null}
      </div>

      {showDropdown ? (
        <div className="absolute top-full left-0 z-20 mt-1.5 max-h-96 w-full overflow-y-auto rounded-lg border border-hairline bg-surface-1 py-1.5 shadow-lg">
          {errorMessage ? (
            <p className="px-3 py-2 text-sm text-error">{errorMessage}</p>
          ) : results.length === 0 ? (
            !loading ? <p className="px-3 py-2 text-sm text-ink-tertiary">No matches for &ldquo;{query}&rdquo;.</p> : null
          ) : (
            results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                onClick={() => handleSelect(result)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-ink-primary/[0.04]"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                      result.type === "lead" ? "bg-ink-accent/10 text-ink-accent" : "bg-success/10 text-success"
                    )}
                  >
                    {RESULT_TYPE_LABELS[result.type]}
                  </span>
                  <span className="text-sm font-medium text-ink-primary">{result.title}</span>
                </span>
                <span className="text-xs text-ink-tertiary">{result.subtitle}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
