"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { useNationalities } from "@/lib/use-nationalities";
import { cn } from "@/lib/cn";

type Pax = "ADULT" | "CHILD";
const PAX: { value: Pax; label: string }[] = [
  { value: "ADULT", label: "Adult" },
  { value: "CHILD", label: "Child" },
];

export interface MatrixRule {
  id: string;
  serviceType: string;
  countryId: string | null;
  newVisaConfigId: string | null;
  nationalityId: string | null;
  nationality: string | null;
  paxType: string;
  processingType: string | null;
  sellingPrice: string;
  active: boolean;
  subServiceId: string | null;
  visaTypeId: string | null;
}

/** "" key = an existing price for every nationality (kept editable; new rows always name one — F11). */
const ALL = "";
const cellKey = (nationalityId: string, pax: Pax, processing: string) => `${nationalityId}|${pax}|${processing}`;

/**
 * Client doc 16 Nov (F9) — one form per New Visa product: pick the country and the visa product (e.g. 30 Days ·
 * Single Entry), then set every nationality × Adult / Child × Normal / Express selling price in one grid and save
 * them together (one reason, each price audited). An empty cell removes that price.
 */
export function NewVisaPriceMatrix({
  countries,
  products,
  processingTypes,
  rules,
  onSaved,
}: {
  countries: { id: string; name: string; active: boolean }[];
  products: { id: string; countryId: string; label: string }[];
  processingTypes: { code: string; label: string; active: boolean }[];
  rules: MatrixRule[];
  onSaved: () => void;
}) {
  const { options: nationalityOptions } = useNationalities();
  const { confirm, dialog } = useConfirmAction();
  const [countryId, setCountryId] = useState("");
  const [productId, setProductId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<string[]>([]);
  const [adding, setAdding] = useState("");
  const [saving, setSaving] = useState(false);
  const processing = processingTypes.filter((option) => option.active);
  const countryProducts = products.filter((product) => product.countryId === countryId);

  const productRules = useMemo(
    () =>
      rules.filter(
        (rule) =>
          rule.serviceType === "NEW_VISA" && rule.countryId === countryId && rule.newVisaConfigId === productId && rule.active && !rule.subServiceId && !rule.visaTypeId && (rule.paxType === "ADULT" || rule.paxType === "CHILD") && rule.processingType
      ),
    [rules, countryId, productId]
  );

  const load = (nextCountry: string, nextProduct: string) => {
    setCountryId(nextCountry);
    setProductId(nextProduct);
    const loaded: Record<string, string> = {};
    const loadedRows: string[] = [];
    for (const rule of rules) {
      if (rule.serviceType !== "NEW_VISA" || rule.countryId !== nextCountry || rule.newVisaConfigId !== nextProduct || !rule.active || rule.subServiceId || rule.visaTypeId || !rule.processingType) continue;
      if (rule.paxType !== "ADULT" && rule.paxType !== "CHILD") continue;
      const nat = rule.nationalityId ?? ALL;
      if (!loadedRows.includes(nat)) loadedRows.push(nat);
      loaded[cellKey(nat, rule.paxType, rule.processingType)] = String(Number(rule.sellingPrice));
    }
    setValues(loaded);
    setRows(loadedRows);
  };

  const nameOf = (id: string) => (id === ALL ? "All nationalities (existing price)" : nationalityOptions.find((option) => option.id === id)?.name ?? "Nationality");
  const addable = nationalityOptions.filter((option) => !rows.includes(option.id));

  const save = async () => {
    const cells = rows.flatMap((nat) =>
      PAX.flatMap((pax) =>
        processing.map((option) => {
          const raw = (values[cellKey(nat, pax.value, option.code)] ?? "").trim();
          return { nationalityId: nat === ALL ? null : nat, paxType: pax.value, processingType: option.code, sellingPrice: raw === "" ? null : Number(raw) };
        })
      )
    );
    if (cells.some((cell) => cell.sellingPrice !== null && (Number.isNaN(cell.sellingPrice) || cell.sellingPrice < 0))) {
      toast.error("Prices must be numbers of 0 or more.");
      return;
    }
    // A removed row's prices are disabled too.
    const removed = productRules
      .filter((rule) => !rows.includes(rule.nationalityId ?? ALL))
      .map((rule) => ({ nationalityId: rule.nationalityId, paxType: rule.paxType as Pax, processingType: rule.processingType as string, sellingPrice: null }));
    const all = [...cells, ...removed];
    if (all.length === 0) return;
    const reason = await confirm({
      title: "Save these New Visa prices?",
      description: "Each changed price is saved and audited. Existing bookings keep their booked price.",
      confirmLabel: "Save Prices",
    });
    if (!reason) return;
    setSaving(true);
    try {
      const result = await postJson<{ created: number; updated: number; disabled: number }>("/api/admin/pricing-rules/new-visa-matrix", {
        countryId,
        newVisaConfigId: productId,
        cells: all,
        reason,
      });
      toast.success(`Prices saved — ${result.created} added, ${result.updated} changed, ${result.disabled} removed.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the prices. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5" aria-labelledby="nv-matrix-title">
      <div>
        <h2 id="nv-matrix-title" className="text-sm font-semibold text-ink-heading">
          New Visa prices — one visa product
        </h2>
        <p className="text-xs text-ink-tertiary">
          Pick the country and visa product, add each nationality, then fill the selling price for every passenger type and processing type. Leave a
          cell empty for no price. The vendor cost comes from Vendor rates.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Country" htmlFor="nv-matrix-country">
          <select id="nv-matrix-country" value={countryId} onChange={(event) => load(event.target.value, "")} className={cn(fieldControlClass, fieldBorderClass(false))}>
            <option value="">Select a country</option>
            {countries
              .filter((country) => country.active || country.id === countryId)
              .map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
          </select>
        </FormField>
        <FormField label="Visa product" htmlFor="nv-matrix-product" hint={countryId && countryProducts.length === 0 ? "This country has no visa products yet (Admin → New Visa)." : undefined}>
          <select
            id="nv-matrix-product"
            value={productId}
            disabled={!countryId}
            onChange={(event) => load(countryId, event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false))}
          >
            <option value="">Select a visa product</option>
            {countryProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {countryId && productId ? (
        processing.length === 0 ? (
          <p className="text-sm text-ink-secondary">No New Visa processing types are active (Service Configuration → Processing options).</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-secondary">
                    <th className="py-2 pr-3 font-medium">Nationality</th>
                    {PAX.flatMap((pax) =>
                      processing.map((option) => (
                        <th key={`${pax.value}-${option.code}`} className="px-2 py-2 font-medium">
                          {pax.label} · {option.label} (₹)
                        </th>
                      ))
                    )}
                    <th className="sr-only">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={PAX.length * processing.length + 2} className="py-3 text-ink-tertiary">
                        Add a nationality to start.
                      </td>
                    </tr>
                  ) : (
                    rows.map((nat) => (
                      <tr key={nat || "all"} className="border-t border-hairline">
                        <td className="py-2 pr-3 font-medium text-ink-primary">{nameOf(nat)}</td>
                        {PAX.flatMap((pax) =>
                          processing.map((option) => {
                            const key = cellKey(nat, pax.value, option.code);
                            return (
                              <td key={key} className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  aria-label={`${nameOf(nat)} ${pax.label} ${option.label} price`}
                                  value={values[key] ?? ""}
                                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                                  className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-28")}
                                />
                              </td>
                            );
                          })
                        )}
                        <td className="py-2">
                          <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${nameOf(nat)}`} onClick={() => setRows((current) => current.filter((row) => row !== nat))}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-2">
                <FormField label="Add nationality" htmlFor="nv-matrix-add">
                  <select id="nv-matrix-add" value={adding} onChange={(event) => setAdding(event.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "min-w-[200px]")}>
                    <option value="">Select a nationality</option>
                    {addable.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <Button
                  type="button"
                  size="md"
                  variant="ghost"
                  disabled={!adding}
                  onClick={() => {
                    setRows((current) => [...current, adding]);
                    setAdding("");
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
              <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={rows.length === 0 && productRules.length === 0}>
                Save Prices
              </Button>
            </div>
          </>
        )
      ) : null}
      {dialog}
    </section>
  );
}
