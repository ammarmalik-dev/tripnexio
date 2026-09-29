/** P15 — the staff Task opened when a customer asks for a new Special Fare quote after expiry. */
export const NEW_QUOTE_TASK_TITLE = "New quote requested by customer";

/**
 * "Jaipur - Jaipur International Airport (JAI)" (the AirportSearchField
 * value stored on the lead) -> "Jaipur". Anything else is returned trimmed.
 */
export function shortPlace(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const dash = text.indexOf(" - ");
  return dash > 0 ? text.slice(0, dash).trim() : text;
}

/** The customer's requested route from a Special Fare lead's details, e.g. "Jaipur → Dubai". */
export function requestedRouteFromDetails(details: unknown): string | null {
  const data = (details ?? {}) as Record<string, unknown>;
  const from = shortPlace(data.origin);
  const to = shortPlace(data.destination);
  return from && to ? `${from} → ${to}` : null;
}

/** Flight_Special_Fare.md §12 — the exact customer wording for an alternative-route option. */
export function alternativeRouteLabel(requestedRoute: string | null, alternativeRoute: string | null): string {
  const requested = requestedRoute ?? "requested";
  const alternative = alternativeRoute?.trim() || "a different route";
  return `The requested ${requested} route is not available. This is an alternative route from ${alternative}.`;
}
