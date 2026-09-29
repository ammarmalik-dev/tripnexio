import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

const price = (label: string) => z.number({ error: `Enter the ${label}` }).min(0, "Price can't be negative").max(1_000_000, "Price is too large");

/** P18 — OTB price per airline + destination country + passenger type. */
export const createOtbPriceSchema = z.object({
  airlineId: z.string().min(1, "Select an airline"),
  countryId: z.string().min(1, "Select a destination country"),
  paxType: z.enum(["ADULT", "CHILD", "INFANT"], { error: "Select a passenger type" }),
  normalPrice: price("normal price"),
  urgentPrice: price("urgent price").nullable().default(null),
  active: z.boolean().default(true),
});

/** Airline, country and passenger type are fixed once created — disable the row and add another to change them. */
export const updateOtbPriceSchema = partialUpdateSchema(createOtbPriceSchema.pick({ normalPrice: true, urgentPrice: true, active: true }));
