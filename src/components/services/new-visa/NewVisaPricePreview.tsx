"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { postJson } from "@/lib/api/client";

interface PreviewLine {
  fullName: string;
  paxType: "ADULT" | "CHILD" | "INFANT";
  price: number;
}

type Preview = { configured: false } | { configured: true; lines: PreviewLine[]; subtotal: number; gst: number; gatewayFee: number; total: number };

const PAX_LABELS: Record<PreviewLine["paxType"], string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };
const RUPEES = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

/**
 * P10 — the New Visa summary's price: one line per passenger (Adult / Child
 * / Infant by age on the travel date), GST and the payment fee, and the total
 * payable — from the server, with the same pricing the payment will use.
 */
export function NewVisaPricePreview({
  countryCode,
  newVisaConfigId,
  processingType,
  travelDate,
  travellers,
}: {
  countryCode: string;
  newVisaConfigId: string;
  processingType: "normal" | "urgent";
  travelDate: string;
  travellers: { fullName: string; dob: string }[];
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const travellersKey = JSON.stringify(travellers);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await postJson<Preview>("/api/new-visa-price/preview", {
          countryCode,
          newVisaConfigId: newVisaConfigId || null,
          processingType,
          travelDate,
          travellers: JSON.parse(travellersKey) as { fullName: string; dob: string }[],
        });
        if (!cancelled) setPreview(result);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [countryCode, newVisaConfigId, processingType, travelDate, travellersKey]);

  if (failed || (preview && !preview.configured)) {
    return (
      <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
        Our team will confirm the price for this selection after reviewing your request.
      </p>
    );
  }
  if (!preview) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 px-5 py-3">
      <p className="pb-2 text-xs font-medium uppercase tracking-wide text-ink-accent">Price</p>
      {preview.lines.map((line, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-1.5 text-sm">
          <span className="text-ink-secondary">
            {line.fullName || `Traveller ${index + 1}`} · {PAX_LABELS[line.paxType]}
          </span>
          <span className="font-medium text-ink-primary">{RUPEES.format(line.price)}</span>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-hairline py-1.5 text-sm">
        <span className="text-ink-tertiary">GST</span>
        <span className="text-ink-primary">{RUPEES.format(preview.gst)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
        <span className="text-ink-tertiary">Payment gateway fee</span>
        <span className="text-ink-primary">{RUPEES.format(preview.gatewayFee)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-hairline py-2">
        <span className="text-sm font-semibold text-ink-heading">Total payable</span>
        <span className="text-base font-semibold text-ink-heading">{RUPEES.format(preview.total)}</span>
      </div>
    </div>
  );
}
