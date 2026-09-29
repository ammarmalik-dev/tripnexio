"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { SelectField } from "@/components/forms/SelectField";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useProcessingTypes } from "@/lib/processing-types/use-processing-types";
import { defaultProcessingTypes, type ProcessingTypeView } from "@/lib/processing-types/defaults";

/** One New Visa product (P10): a country + stay duration + entry type, with its from-price. */
interface Product {
  id: string;
  countryCode: string;
  countryName: string;
  stayDays: number | null;
  entryKind: "SINGLE" | "MULTIPLE" | null;
  duration: string;
  entryType: string;
  fromPrice: number | null;
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
 * New Visa landing page's product-selection card (UAE Visa Page Content
 * FINAL §4). P10 — the customer picks a country, then Stay Duration (30 /
 * 60 days) and Entry Type (Single / Multiple) from the Admin-configured
 * products, each option showing its "from" price; Processing Time and
 * traveller counts then drive the live price through the same
 * `computeNewVisaPrice()` the real request uses (`GET /api/new-visa-price`).
 * "Apply Now" hands the chosen product and options to the request form.
 * Only active, Admin-configured products are shown; an empty/failed fetch
 * hides the section rather than showing a broken card.
 */
export function NewVisaProductSelector() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [countryCode, setCountryCode] = useState("");
  const [productId, setProductId] = useState("");
  const [pickedProcessingType, setProcessingType] = useState<ProcessingType>("normal");
  // P23 — options/labels from the Admin Processing Types master; a disabled
  // code isn't offered. The fallback pair shows only while the master loads.
  const { state: processingState, options: processingMaster } = useProcessingTypes("NEW_VISA");
  const processingOptions = (processingState === "loading" ? defaultProcessingTypes("NEW_VISA") : processingMaster).filter(
    (option): option is ProcessingTypeView & { code: ProcessingType } => option.code === "normal" || option.code === "urgent"
  );
  const processingType: ProcessingType = processingOptions.some((option) => option.code === pickedProcessingType)
    ? pickedProcessingType
    : (processingOptions[0]?.code ?? pickedProcessingType);
  const processingLabel = processingOptions.find((option) => option.code === processingType)?.label ?? processingType;
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  // Infants are priced separately at checkout (age on the travel date), so
  // the preview counts them too — otherwise it undercuts the charged total.
  const [infants, setInfants] = useState(0);
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
        const json = (await res.json()) as { data: Product[] };
        if (cancelled) return;
        setProducts(json.data);
        if (json.data.length > 0) {
          setCountryCode(json.data[0].countryCode);
          setProductId(json.data[0].id);
        }
      } catch {
        if (!cancelled) setProducts([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const countryProducts = useMemo(() => (products ?? []).filter((p) => p.countryCode === countryCode), [products, countryCode]);
  const selected = countryProducts.find((p) => p.id === productId) ?? countryProducts[0] ?? null;
  const selectedId = selected?.id ?? "";
  const countries = useMemo(() => {
    const seen = new Map<string, string>();
    for (const product of products ?? []) if (!seen.has(product.countryCode)) seen.set(product.countryCode, product.countryName);
    return [...seen.entries()].map(([code, name]) => ({ code, name }));
  }, [products]);
  const stayOptions = [...new Set(countryProducts.map((p) => p.duration))];
  const entryOptions = countryProducts.filter((p) => selected && p.duration === selected.duration);

  const pickStay = (duration: string) => {
    const match =
      countryProducts.find((p) => p.duration === duration && p.entryType === selected?.entryType) ?? countryProducts.find((p) => p.duration === duration);
    if (match) setProductId(match.id);
  };

  useEffect(() => {
    if (!countryCode || !selectedId) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setPrice((current) => ({ ...current, loading: true }));
      try {
        const params = new URLSearchParams({
          countryCode,
          configId: selectedId,
          processingType,
          adults: String(adults),
          children: String(children),
          infants: String(infants),
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
  }, [countryCode, selectedId, processingType, adults, children, infants]);

  if (products === null) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (products.length === 0 || !selected) {
    return null;
  }

  const applyHref = `/services/new-visa/request?country=${encodeURIComponent(countryCode)}&config=${encodeURIComponent(selected.id)}&processingType=${processingType}&travelers=${adults + children + infants}`;
  const optionClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors duration-150",
      active ? "border-accent bg-accent/10 text-accent-on-light" : "border-hairline text-ink-secondary hover:border-glass-border-strong"
    );
  const fromLabel = (value: number | null | undefined) => (value ? `from ${RUPEE_FORMATTER.format(value)}` : "");

  return (
    <GlassCard tier={2} className="flex flex-col gap-6 p-6 sm:p-8">
      {countries.length > 1 ? (
        <SelectField
          label="Destination"
          name="productSelectorCountry"
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
          value={countryCode}
          onChange={(event) => {
            setCountryCode(event.target.value);
            const first = products.find((p) => p.countryCode === event.target.value);
            if (first) setProductId(first.id);
          }}
        />
      ) : (
        <p className="text-sm font-semibold text-ink-heading">{selected.countryName}</p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-heading">Stay Duration</span>
        <div className="flex gap-2">
          {stayOptions.map((duration) => {
            const prices = countryProducts.filter((p) => p.duration === duration && p.fromPrice).map((p) => p.fromPrice as number);
            return (
              <button
                key={duration}
                type="button"
                onClick={() => pickStay(duration)}
                className={optionClass(selected.duration === duration)}
                aria-pressed={selected.duration === duration}
              >
                {duration}
                <span className="text-xs font-normal text-ink-tertiary">{prices.length > 0 ? fromLabel(Math.min(...prices)) : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-heading">Entry Type</span>
        <div className="flex gap-2">
          {entryOptions.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setProductId(product.id)}
              className={optionClass(selected.id === product.id)}
              aria-pressed={selected.id === product.id}
            >
              {product.entryType}
              <span className="text-xs font-normal text-ink-tertiary">{fromLabel(product.fromPrice)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Counter label="Adults" value={adults} onChange={setAdults} min={1} />
        <Counter label="Children" value={children} onChange={setChildren} min={0} />
        <Counter label="Infants (under 2)" value={infants} onChange={setInfants} min={0} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-heading">Processing Time</span>
        <div className="flex gap-2">
          {processingOptions.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => setProcessingType(option.code)}
              className={optionClass(processingType === option.code)}
              aria-pressed={processingType === option.code}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-t border-hairline pt-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-tertiary">Stay Duration</dt>
          <dd className="text-sm font-medium text-ink-primary">{selected.duration}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Visa Validity</dt>
          <dd className="text-sm font-medium text-ink-primary">As per issued visa</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Entry Type</dt>
          <dd className="text-sm font-medium text-ink-primary">{selected.entryType}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Processing Time</dt>
          <dd className="text-sm font-medium text-ink-primary">{processingLabel}</dd>
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
