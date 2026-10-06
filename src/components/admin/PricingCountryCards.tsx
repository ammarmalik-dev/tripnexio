"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { FlagBadge } from "./FlagBadge";
import { SERVICE_TYPE_LABELS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { PaxType, ServiceType } from "../../generated/prisma/enums";

interface CountryRule {
  id: string;
  serviceType: ServiceType;
  subService: string | null;
  visaType: string | null;
  product: string | null;
  processingType: string | null;
  processingLabel: string | null;
  paxType: PaxType;
  nationality: string | null;
  sellingPrice: number;
  governmentFee: number;
  additionalCharges: number;
  vendorCost: number;
  validityFrom: string | null;
  validityUntil: string | null;
  active: boolean;
}

interface CountryGroup {
  country: { id: string; name: string; code: string; flagOverride: string | null; active: boolean } | null;
  rules: CountryRule[];
}

function money(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function ruleLabel(rule: CountryRule): string {
  return [rule.subService, rule.visaType, rule.product, rule.processingLabel, PAX_TYPE_LABELS[rule.paxType], rule.nationality ? `Nationality: ${rule.nationality}` : null]
    .filter(Boolean)
    .join(" · ");
}

interface EditValues {
  sellingPrice: string;
  governmentFee: string;
  additionalCharges: string;
  vendorCost: string;
  validityUntil: string;
  active: boolean;
}

function RuleEditor({ rule, onSaved, onCancel }: { rule: CountryRule; onSaved: (rule: CountryRule) => void; onCancel: () => void }) {
  const [values, setValues] = useState<EditValues>({
    sellingPrice: String(rule.sellingPrice),
    governmentFee: String(rule.governmentFee),
    additionalCharges: String(rule.additionalCharges),
    vendorCost: String(rule.vendorCost),
    validityUntil: rule.validityUntil ?? "",
    active: rule.active,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof EditValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const set = (key: keyof EditValues, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const nextErrors: Partial<Record<keyof EditValues, string>> = {};
    const numbers = {
      sellingPrice: Number(values.sellingPrice),
      governmentFee: Number(values.governmentFee || 0),
      additionalCharges: Number(values.additionalCharges || 0),
      vendorCost: Number(values.vendorCost || 0),
    };
    (Object.keys(numbers) as (keyof typeof numbers)[]).forEach((key) => {
      if (!Number.isFinite(numbers[key]) || numbers[key] < 0) nextErrors[key] = "Enter 0 or more.";
    });
    if (values.sellingPrice.trim() === "") nextErrors.sellingPrice = "Enter the price.";
    if (!nextErrors.governmentFee && numbers.governmentFee > numbers.sellingPrice) nextErrors.governmentFee = "Can't be more than the price.";
    if (values.validityUntil && rule.validityFrom && values.validityUntil < rule.validityFrom) nextErrors.validityUntil = "Must be on or after the start date.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const reason = await confirm({
      title: `Change this price to ${money(numbers.sellingPrice)}?`,
      description: "New quotations and checkouts use the new price. Existing bookings keep the price they were booked at.",
      confirmLabel: "Save Price",
    });
    if (!reason) return;
    setSaving(true);
    try {
      await patchJson(`/api/admin/pricing-rules/${rule.id}`, {
        ...numbers,
        validityUntil: values.validityUntil, // "" clears the end date (the route maps it to null)
        active: values.active,
        reason,
      });
      toast.success("Price saved.");
      onSaved({ ...rule, ...numbers, validityUntil: values.validityUntil || null, active: values.active });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the price. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const numberField = (key: "sellingPrice" | "governmentFee" | "additionalCharges" | "vendorCost", label: string, hint?: string) => (
    <label className="flex flex-col gap-1 text-xs text-ink-secondary">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
        aria-invalid={Boolean(errors[key])}
        className={cn(fieldControlClass, fieldBorderClass(Boolean(errors[key])), "h-9 text-sm")}
      />
      {errors[key] ? <span className="text-error">{errors[key]}</span> : hint ? <span className="text-ink-tertiary">{hint}</span> : null}
    </label>
  );

  return (
    <div className="mt-2 rounded-lg border border-accent/25 bg-surface-1 p-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {numberField("sellingPrice", "Price (per pax)")}
        {numberField("governmentFee", "Govt / airline fee", "Inside the price")}
        {numberField("additionalCharges", "Additional charges")}
        {numberField("vendorCost", "Vendor cost", "Internal only")}
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          <span className="font-medium">Valid until</span>
          <input
            type="date"
            value={values.validityUntil}
            min={rule.validityFrom ?? undefined}
            onChange={(event) => set("validityUntil", event.target.value)}
            aria-invalid={Boolean(errors.validityUntil)}
            className={cn(fieldControlClass, fieldBorderClass(Boolean(errors.validityUntil)), "h-9 text-sm")}
          />
          {errors.validityUntil ? <span className="text-error">{errors.validityUntil}</span> : <span className="text-ink-tertiary">Empty = no end date</span>}
        </label>
        <div className="flex flex-col gap-1 text-xs text-ink-secondary">
          <span className="font-medium">Active</span>
          <div className="flex h-9 items-center">
            <Switch checked={values.active} onChange={(checked) => set("active", checked)} label="Price active" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={() => void save()} isLoading={saving}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
      {dialog}
    </div>
  );
}

/**
 * Client corrections 2026-10-05 §31 — Pricing Dashboard, country-wise: one
 * compact card per country listing every configured price (service,
 * sub-service, processing type, Adult/Child/Infant), each opened for
 * Edit → Save with a required reason (audited + PricingRuleHistory, via the
 * existing PATCH route). Bookings keep their own booked price.
 */
export function PricingCountryCards() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [groups, setGroups] = useState<CountryGroup[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<{ countries: CountryGroup[]; truncated: boolean }>("/api/admin/pricing-dashboard/countries");
        if (cancelled) return;
        setGroups(result.countries);
        setTruncated(result.truncated);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) => (group.country?.name ?? "all countries").toLowerCase().includes(term));
  }, [groups, search]);

  const replaceRule = (updated: CountryRule) =>
    setGroups((current) => current.map((group) => ({ ...group, rules: group.rules.map((rule) => (rule.id === updated.id ? updated : rule)) })));

  if (state === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load country pricing"
        description="Please try again."
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }
  if (groups.length === 0) {
    return <EmptyState title="No prices configured yet" description="Add prices under Service Configuration → Pricing; they appear here by country." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <span className="sr-only">Find a country</span>
          <input
            type="search"
            placeholder="Find a country…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-64 text-sm")}
          />
        </label>
        <p className="text-xs text-ink-tertiary">
          {groups.length} countr{groups.length === 1 ? "y" : "ies"} · {groups.reduce((sum, group) => sum + group.rules.length, 0)} prices
        </p>
      </div>
      {truncated ? <p className="text-xs text-warning">Showing the first 2,000 prices. Use the table view filters for the rest.</p> : null}
      {visible.length === 0 ? <p className="text-sm text-ink-tertiary">No country matches “{search}”.</p> : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {visible.map((group) => {
          const services = [...new Set(group.rules.map((rule) => rule.serviceType))];
          const activeCount = group.rules.filter((rule) => rule.active).length;
          return (
            <section key={group.country?.id ?? "all"} className="glass-2 rounded-xl p-4">
              <header className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {group.country ? <FlagBadge code={group.country.code} flagOverride={group.country.flagOverride} /> : null}
                  <div>
                    <h2 className="text-sm font-semibold text-ink-heading">{group.country?.name ?? "All countries"}</h2>
                    <p className="text-xs text-ink-tertiary">
                      {group.rules.length} price{group.rules.length === 1 ? "" : "s"} · {activeCount} active
                      {group.country && !group.country.active ? " · country disabled" : ""}
                    </p>
                  </div>
                </div>
              </header>

              <div className="flex flex-col gap-3">
                {services.map((serviceType) => (
                  <div key={serviceType}>
                    <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-tertiary uppercase">{SERVICE_TYPE_LABELS[serviceType]}</p>
                    <ul className="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1">
                      {group.rules
                        .filter((rule) => rule.serviceType === serviceType)
                        .map((rule) => (
                          <li key={rule.id} className="px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className={cn("text-sm", rule.active ? "text-ink-primary" : "text-ink-tertiary line-through")}>{ruleLabel(rule) || "All passengers"}</p>
                                <p className="text-xs text-ink-tertiary">
                                  {rule.governmentFee > 0 ? `Govt/airline fee ${money(rule.governmentFee)} · ` : ""}
                                  {rule.additionalCharges > 0 ? `+ ${money(rule.additionalCharges)} charges · ` : ""}
                                  {rule.validityUntil ? `until ${new Date(`${rule.validityUntil}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : "no end date"}
                                  {!rule.active ? " · disabled" : ""}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-sm font-semibold text-ink-heading">{money(rule.sellingPrice)}</span>
                                {editingId !== rule.id ? (
                                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(rule.id)} aria-label={`Edit price: ${ruleLabel(rule)}`}>
                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                    Edit
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            {editingId === rule.id ? (
                              <RuleEditor
                                rule={rule}
                                onCancel={() => setEditingId(null)}
                                onSaved={(updated) => {
                                  replaceRule(updated);
                                  setEditingId(null);
                                }}
                              />
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
