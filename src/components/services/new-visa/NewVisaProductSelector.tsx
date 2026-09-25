"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { SelectField } from "@/components/forms/SelectField";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

interface CountryConfig {
  countryCode: string;
  countryName: string;
  visaCategory: string;
  duration: string;
  entryType: string;
  processingType: string;
}

type ProcessingType = "normal" | "urgent";
const MAX_TRAVELLERS = 9;
const PRICE_DEBOUNCE_MS = 250;

const RUPEE_FORMATTER = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function Counter({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (next: number) => void; min?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 px-3 py-2">
      <span className="text-sm font-medium text-ink-primary">{label}</span>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-ink-secondary transition-colors duration-150 hover:bg-ink-primary/[0.05] disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="w-5 text-center text-sm font-semibold text-ink-heading" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(MAX_TRAVELLERS, value + 1))}
          disabled={value >= MAX_TRAVELLERS}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-ink-secondary transition-colors duration-150 hover:bg-ink-primary/[0.05] disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * New Visa landing page's interactive product-selection card — the
 * client's own locked "UAE Visa Options" section (Sep 2026 content doc).
 * Stay Duration/Entry Type are informational display text (from the
 * Admin-managed `NewVisaCountryConfig`, per its own doc comment — not a
 * separate pricing dimension); Processing Time (Normal/Express) and
 * traveller counts are what actually drive the live price, via the exact
 * same `computeNewVisaPrice()` the real request flow uses (through
 * `GET /api/new-visa-price`) — never a hardcoded number. "Apply Now"
 * hands the chosen country/processing-type/traveller-count to the real
 * multi-step request flow as pre-filled defaults via query params.
 *
 * Only active, Admin-configured countries are ever shown (client's own
 * locked rule) — an empty/failed fetch silently hides the whole section
 * rather than showing a broken card, same precedent as
 * `useDestinationCountryOptions`.
 */
export function NewVisaProductSelector() {
  const [countries, setCountries] = useState<CountryConfig[] | null>(null);
  const [countryCode, setCountryCode] = useState("");
  const [processingType, setProcessingType] = useState<ProcessingType>("normal");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [price, setPrice] = useState<{ loading: boolean; configured: boolean; total: number | null }>({
    loading: false,
    configured: false,
    total: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/new-visa-countries");
        if (!res.ok) return;
        const json = (await res.json()) as { data: CountryConfig[] };
        if (cancelled) return;
        setCountries(json.data);
        if (json.data.length > 0) setCountryCode(json.data[0].countryCode);
      } catch {
        if (!cancelled) setCountries([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!countryCode) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setPrice((current) => ({ ...current, loading: true }));
      try {
        const params = new URLSearchParams({
          countryCode,
          processingType,
          adults: String(adults),
          children: String(children),
        });
        const res = await fetch(`/api/new-visa-price?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data: { configured: boolean; total?: number } };
        if (cancelled) return;
        setPrice({ loading: false, configured: json.data.configured, total: json.data.total ?? null });
      } catch {
        if (!cancelled) setPrice({ loading: false, configured: false, total: null });
      }
    }, PRICE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [countryCode, processingType, adults, children]);

  const selectedConfig = useMemo(() => countries?.find((c) => c.countryCode === countryCode) ?? null, [countries, countryCode]);

  if (countries === null) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (countries.length === 0 || !selectedConfig) {
    return null;
  }

  const applyHref = `/services/new-visa/request?country=${encodeURIComponent(countryCode)}&processingType=${processingType}&travelers=${adults + children}`;

  return (
    <GlassCard tier={2} className="flex flex-col gap-6 p-6 sm:p-8">
      {countries.length > 1 ? (
        <SelectField
          label="Destination"
          name="productSelectorCountry"
          options={countries.map((c) => ({ value: c.countryCode, label: c.countryName }))}
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
        />
      ) : (
        <p className="text-sm font-semibold text-ink-heading">{selectedConfig.countryName}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Counter label="Adults" value={adults} onChange={setAdults} min={1} />
        <Counter label="Children" value={children} onChange={setChildren} min={0} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-heading">Processing Time</span>
        <div className="flex gap-2">
          {(["normal", "urgent"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setProcessingType(type)}
              className={cn(
                "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors duration-150",
                processingType === type ? "border-accent bg-accent/10 text-accent-on-light" : "border-hairline text-ink-secondary hover:border-glass-border-strong"
              )}
            >
              {type === "normal" ? "Normal" : "Express"}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-t border-hairline pt-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-tertiary">Stay Duration</dt>
          <dd className="text-sm font-medium text-ink-primary">{selectedConfig.duration}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Visa Validity</dt>
          <dd className="text-sm font-medium text-ink-primary">As per issued visa</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Entry Type</dt>
          <dd className="text-sm font-medium text-ink-primary">{selectedConfig.entryType}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Processing Time</dt>
          <dd className="text-sm font-medium text-ink-primary">{processingType === "normal" ? "Normal" : "Express"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-5">
        <div>
          <p className="text-xs text-ink-tertiary">Price</p>
          {price.loading ? (
            <p className="text-2xl font-semibold text-ink-tertiary">…</p>
          ) : price.configured && price.total !== null ? (
            <p className="text-2xl font-semibold text-ink-heading">{RUPEE_FORMATTER.format(price.total)}</p>
          ) : (
            <p className="text-sm text-ink-tertiary">Contact us for pricing on this selection.</p>
          )}
        </div>
        <Link
          href={applyHref}
          className="inline-flex items-center justify-center rounded-full bg-[image:var(--gradient-accent)] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgb(62_111_219/0.3)] transition-transform duration-150 hover:-translate-y-0.5"
        >
          Apply Now →
        </Link>
      </div>
    </GlassCard>
  );
}
