"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { buildQuoteFormSchema, type QuoteFormValues } from "@/lib/validation/quotation-schema";
import { FLIGHT_QUOTE_MAX_VALIDITY_MINUTES } from "@/lib/quotations/pricing";
import { cn } from "@/lib/cn";

interface VendorOption {
  id: string;
  name: string;
}

interface AlternativeOption {
  id: string;
  label: string;
}

interface QuoteBuilderFormProps {
  isFlightQuote: boolean;
  /** Visa Change: this quote is one itinerary option (flight details + ticket price on top of the visa fee). */
  hasItinerary?: boolean;
  vendors: VendorOption[];
  alternativeOptions: AlternativeOption[];
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function maxValidityLocalIso(): string {
  const max = new Date(Date.now() + FLIGHT_QUOTE_MAX_VALIDITY_MINUTES * 60 * 1000);
  max.setSeconds(0, 0);
  return new Date(max.getTime() - max.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function QuoteBuilderForm({
  isFlightQuote,
  hasItinerary = false,
  vendors,
  alternativeOptions,
  onSubmit,
  onCancel,
  submitting,
}: QuoteBuilderFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(buildQuoteFormSchema(isFlightQuote)),
  });

  const numberField = (name: "vendorCost" | "adultFare" | "childFare" | "infantFare" | "sellingPrice" | "feeAmount" | "fineOrCharges" | "flightTicketPrice") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) });

  const optionalField = (name: "airline" | "flightNumber" | "route" | "baggageAllowance" | "fareType" | "couponCode") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : value) });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-4"
    >
      <FormField label="Vendor" htmlFor="vendorId" error={errors.vendorId?.message} required>
        <select
          id="vendorId"
          defaultValue=""
          className={cn(fieldControlClass, fieldBorderClass(!!errors.vendorId))}
          {...register("vendorId")}
        >
          <option value="" disabled>
            {vendors.length === 0 ? "No active vendors for this service" : "Select a vendor"}
          </option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </FormField>

      {isFlightQuote ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Airline" {...optionalField("airline")} error={errors.airline?.message} />
            <TextField label="Flight Number" {...optionalField("flightNumber")} error={errors.flightNumber?.message} />
          </div>
          <TextField label="Route" placeholder="e.g. BOM → DXB" {...optionalField("route")} error={errors.route?.message} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Departure"
              type="datetime-local"
              {...register("flightDateTime")}
              error={errors.flightDateTime?.message}
            />
            <TextField
              label="Arrival"
              type="datetime-local"
              {...register("arrivalDateTime")}
              error={errors.arrivalDateTime?.message}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Baggage Allowance"
              placeholder="e.g. 30kg checked"
              {...optionalField("baggageAllowance")}
              error={errors.baggageAllowance?.message}
            />
            <TextField label="Fare Type" placeholder="e.g. Special Fare" {...optionalField("fareType")} error={errors.fareType?.message} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField label="Adult Fare (₹)" type="number" step="0.01" {...numberField("adultFare")} error={errors.adultFare?.message} />
            <TextField label="Child Fare (₹)" type="number" step="0.01" {...numberField("childFare")} error={errors.childFare?.message} />
            <TextField
              label="Infant Fare (₹)"
              type="number"
              step="0.01"
              {...numberField("infantFare")}
              error={errors.infantFare?.message}
            />
          </div>

          {alternativeOptions.length > 0 ? (
            <FormField
              label="Alternative Route"
              htmlFor="alternativeOfId"
              hint="Only set this when offering a different route/option instead of what the customer originally requested."
            >
              <select
                id="alternativeOfId"
                defaultValue=""
                className={cn(fieldControlClass, fieldBorderClass(false))}
                {...register("alternativeOfId", { setValueAs: (value: string) => (value === "" ? undefined : value) })}
              >
                <option value="">No — this is the requested route</option>
                {alternativeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    Alternative to: {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Fee (₹)"
            type="number"
            step="0.01"
            required
            {...numberField("feeAmount")}
            error={errors.feeAmount?.message}
          />
          <TextField
            label="Fine / Charges (₹)"
            type="number"
            step="0.01"
            hint="Optional — added on top of the fee."
            {...numberField("fineOrCharges")}
            error={errors.fineOrCharges?.message}
          />
          {hasItinerary ? (
            <TextField
              label="Flight Ticket (₹)"
              type="number"
              step="0.01"
              hint="Optional — this itinerary's flight-ticket price, added to the total."
              {...numberField("flightTicketPrice")}
              error={errors.flightTicketPrice?.message}
            />
          ) : null}
          <TextField
            label="Coupon Code"
            hint="Optional — validated on save (active, within date range, under usage limit)."
            {...optionalField("couponCode")}
            error={errors.couponCode?.message}
          />
        </div>
      )}

      {hasItinerary ? (
        <fieldset className="flex flex-col gap-4 rounded-lg border border-dashed border-hairline p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-accent">
            Itinerary (optional)
          </legend>
          <p className="text-xs text-ink-tertiary">
            Add one quote per itinerary option (e.g. morning / afternoon / evening flight) so the customer can pick
            the timing that suits them.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Airline" {...optionalField("airline")} error={errors.airline?.message} />
            <TextField label="Flight Number" {...optionalField("flightNumber")} error={errors.flightNumber?.message} />
          </div>
          <TextField label="Route" placeholder="e.g. DXB → MCT" {...optionalField("route")} error={errors.route?.message} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Departure" type="datetime-local" {...register("flightDateTime")} error={errors.flightDateTime?.message} />
            <TextField label="Arrival" type="datetime-local" {...register("arrivalDateTime")} error={errors.arrivalDateTime?.message} />
          </div>
          <TextField
            label="Baggage Allowance"
            placeholder="e.g. 30kg checked"
            {...optionalField("baggageAllowance")}
            error={errors.baggageAllowance?.message}
          />
        </fieldset>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Vendor Cost (₹)"
          type="number"
          step="0.01"
          required
          hint="Internal — never shown to the customer."
          {...numberField("vendorCost")}
          error={errors.vendorCost?.message}
        />
        {isFlightQuote ? (
          <TextField
            label="Selling Price (₹)"
            type="number"
            step="0.01"
            required
            {...numberField("sellingPrice")}
            error={errors.sellingPrice?.message}
          />
        ) : null}
      </div>

      <TextField
        label="Validity Expires At"
        type="datetime-local"
        max={isFlightQuote ? maxValidityLocalIso() : undefined}
        hint={isFlightQuote ? `Optional — up to ${FLIGHT_QUOTE_MAX_VALIDITY_MINUTES} minutes from now.` : "Optional."}
        {...register("validityExpiresAt")}
        error={errors.validityExpiresAt?.message}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={submitting}>
          Save Quote
        </Button>
      </div>
    </form>
  );
}
