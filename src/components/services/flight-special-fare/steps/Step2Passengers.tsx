"use client";

import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { FlightSpecialFareRequestValues } from "@/lib/validation/flight-special-fare-schema";

const MIN_DOB = "1900-01-01";

/** Flight_Special_Fare.md §7 (client-side preview only — the real, trusted calculation runs server-side at submission). */
function previewPaxType(dob: string, travelDate: string): "Adult" | "Child" | "Infant" | null {
  if (!dob || !travelDate) return null;
  const dobDate = new Date(dob);
  const travel = new Date(travelDate);
  if (Number.isNaN(dobDate.getTime()) || Number.isNaN(travel.getTime())) return null;

  let age = travel.getFullYear() - dobDate.getFullYear();
  const monthDiff = travel.getMonth() - dobDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && travel.getDate() < dobDate.getDate())) age--;

  if (age < 2) return "Infant";
  if (age < 12) return "Child";
  return "Adult";
}

/** Local calendar-date YYYY-MM-DD — not `toISOString()`, which converts to
 * UTC and can shift the date by a day depending on the browser's timezone. */
function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Flight_Special_Fare.md §6/§7: passenger type (Adult 12+ / Child 2-11 /
 * Infant under 2) is computed from DOB on the travel date, not asked
 * directly. Shows a live preview badge so the customer sees how their fare
 * category will be determined — the actual value used for the lead is
 * always recomputed server-side, never trusted from this preview.
 */
export function Step2Passengers() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FlightSpecialFareRequestValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "passengers" });
  const travelDate = useWatch({ control, name: "travelDate" });
  const watchedPassengers = useWatch({ control, name: "passengers" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-heading">Passengers</h3>
        <Button type="button" size="sm" variant="ghost" onClick={() => append({ fullName: "", dob: "" })} disabled={fields.length >= 9}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Passenger
        </Button>
      </div>

      {typeof errors.passengers?.message === "string" ? (
        <p className="text-xs font-medium text-error">{errors.passengers.message}</p>
      ) : null}

      {fields.map((field, index) => {
        const badge = previewPaxType(watchedPassengers?.[index]?.dob ?? "", travelDate ?? "");
        return (
          <div key={field.id} className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">Passenger {index + 1}</p>
              <div className="flex items-center gap-2">
                {badge ? (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      badge === "Adult" && "bg-accent/10 text-ink-accent",
                      badge === "Child" && "bg-warning/10 text-warning",
                      badge === "Infant" && "bg-success/10 text-success"
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
                {fields.length > 1 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Full Name"
                required
                error={errors.passengers?.[index]?.fullName?.message}
                {...register(`passengers.${index}.fullName` as const)}
              />
              <DateField
                label="Date of Birth"
                required
                min={MIN_DOB}
                max={todayIso()}
                error={errors.passengers?.[index]?.dob?.message}
                {...register(`passengers.${index}.dob` as const)}
              />
            </div>
          </div>
        );
      })}

      <p className="text-xs text-ink-tertiary">
        Passenger type (Adult / Child / Infant) is calculated automatically from date of birth — fare varies by
        type.
      </p>
    </div>
  );
}
