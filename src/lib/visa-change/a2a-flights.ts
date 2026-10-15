import { z } from "zod";
import type { A2ABlock } from "./operational";

/**
 * Client testing 2026-10-09 (B32) — every Airport-to-Airport quote option
 * carries its own two flights: the exit flight (out of the UAE) and the
 * re-entry flight (back in, usually the same aircraft returning without the
 * passenger leaving the airport). Each leg needs its from/to airport,
 * departure date-time, airline and flight number; the option's vendor, cost
 * and selling price are the quotation's own. Pure module (no `db`) so the
 * CRM quote form can import it.
 */

const airportCode = (message: string) => z.string().trim().min(3, message).max(4, message);
const airlineCode = (message: string) => z.string().trim().min(1, message);
const flightNumber = z.string().trim().min(2, "Enter the flight number").max(12, "Keep this under 12 characters");
/** datetime-local wall-clock time at the departure airport, "YYYY-MM-DDTHH:MM" — kept as typed, never shifted to UTC. */
const localDateTime = (message: string) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, message);

export const a2aFlightsSchema = z
  .object({
    exitFromAirportCode: airportCode("Select the exit airport"),
    exitToAirportCode: airportCode("Select where the exit flight lands"),
    exitAirlineCode: airlineCode("Select the airline"),
    exitFlightNumber: flightNumber,
    exitDepartAt: localDateTime("Enter the departure date and time"),
    reentryFromAirportCode: airportCode("Select where the re-entry flight departs"),
    reentryToAirportCode: airportCode("Select the re-entry airport"),
    reentryAirlineCode: airlineCode("Select the airline"),
    reentryFlightNumber: flightNumber,
    reentryDepartAt: localDateTime("Enter the departure date and time"),
    /** Client doc 2026-10-15 (E3) — departure terminal of each flight (optional). */
    exitTerminal: z.string().trim().max(20, "Keep this under 20 characters").optional(),
    reentryTerminal: z.string().trim().max(20, "Keep this under 20 characters").optional(),
    /** Client doc 2026-10-15 (E3) — no longer asked (the T&C cover reporting); older options keep theirs. */
    reportingTime: z.string().trim().max(40, "Keep this under 40 characters").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.exitFromAirportCode.toUpperCase() === data.exitToAirportCode.toUpperCase()) {
      ctx.addIssue({ code: "custom", message: "Must be a different airport.", path: ["exitToAirportCode"] });
    }
    if (data.reentryFromAirportCode.toUpperCase() === data.reentryToAirportCode.toUpperCase()) {
      ctx.addIssue({ code: "custom", message: "Must be a different airport.", path: ["reentryToAirportCode"] });
    }
    if (data.reentryDepartAt.slice(0, 16) <= data.exitDepartAt.slice(0, 16)) {
      ctx.addIssue({ code: "custom", message: "Must be after the exit flight.", path: ["reentryDepartAt"] });
    }
  });

export type A2AFlightsInput = z.infer<typeof a2aFlightsSchema>;

export const EMPTY_A2A_FLIGHTS: A2AFlightsInput = {
  exitFromAirportCode: "",
  exitToAirportCode: "",
  exitAirlineCode: "",
  exitFlightNumber: "",
  exitDepartAt: "",
  reentryFromAirportCode: "",
  reentryToAirportCode: "",
  reentryAirlineCode: "",
  reentryFlightNumber: "",
  reentryDepartAt: "",
  exitTerminal: "",
  reentryTerminal: "",
};

/** A saved option's block back into form values (edit / revise). Older blocks without airport codes return null. */
export function a2aFlightsFromBlock(block: A2ABlock | null): A2AFlightsInput | null {
  if (!block || !block.exitAirportCode || !block.exitToAirportCode || !block.reentryFromAirportCode || !block.entryAirportCode) return null;
  return {
    exitFromAirportCode: block.exitAirportCode,
    exitToAirportCode: block.exitToAirportCode,
    exitAirlineCode: block.airlineCode,
    exitFlightNumber: block.flightNumber,
    exitDepartAt: `${block.flightDate}T${block.flightTime}`,
    reentryFromAirportCode: block.reentryFromAirportCode,
    reentryToAirportCode: block.entryAirportCode,
    reentryAirlineCode: block.returnAirlineCode ?? "",
    reentryFlightNumber: block.returnFlightNumber ?? "",
    reentryDepartAt: block.returnFlightDate && block.returnFlightTime ? `${block.returnFlightDate}T${block.returnFlightTime}` : "",
    exitTerminal: block.terminal ?? "",
    reentryTerminal: block.returnTerminal ?? "",
    reportingTime: block.reportingTime || undefined,
  };
}
