"use client";

import { useFormContext } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import type { FlightSpecialFareRequestValues } from "@/lib/validation/flight-special-fare-schema";

/** Local calendar-date YYYY-MM-DD — not `toISOString()`, which converts to
 * UTC and can shift the date by a day depending on the browser's timezone. */
function toLocalIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIso() {
  return toLocalIso(new Date());
}
function maxTravelIso() {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  return toLocalIso(d);
}

/** Flight_Special_Fare.md §3: Departure, Destination, Travel Date, Passengers. §3: max 45-day travel window. */
export function Step1TripDetails() {
  const {
    register,
    formState: { errors },
  } = useFormContext<FlightSpecialFareRequestValues>();

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <TextField label="Full Name" required error={errors.fullName?.message} {...register("fullName")} />
      <TextField
        label="Mobile Number"
        type="tel"
        required
        placeholder="+91 98765 43210"
        error={errors.mobile?.message}
        {...register("mobile")}
      />
      <TextField
        label="Email"
        type="email"
        required
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <div className="hidden sm:block" aria-hidden="true" />
      <TextField label="Departure City / Airport" required error={errors.origin?.message} {...register("origin")} />
      <TextField label="Arrival City / Airport" required error={errors.destination?.message} {...register("destination")} />
      <DateField
        label="Travel Date"
        required
        max={maxTravelIso()}
        hint="Requests are accepted up to 45 days ahead."
        error={errors.travelDate?.message}
        {...register("travelDate")}
      />
      <DateField
        label="Return Date (optional)"
        min={todayIso()}
        error={errors.returnDate?.message}
        {...register("returnDate")}
      />
    </div>
  );
}
