/**
 * Client doc 16 Nov (G1) — statuses are managed per Service × Country. A status with no countries applies to
 * every country of its service; one with countries applies only to records (leads / bookings) of those countries.
 */
export function statusAppliesToCountry(status: { countryIds: string[] }, countryId: string | null | undefined): boolean {
  if (status.countryIds.length === 0) return true;
  return !!countryId && status.countryIds.includes(countryId);
}

/** One line per status for the workflow view: the status, then the statuses it may move to (both filtered to the country). */
export interface WorkflowStep {
  id: string;
  name: string;
  customerLabel: string | null;
  isTerminal: boolean;
  next: string[];
}

export function buildWorkflow(
  statuses: { id: string; name: string; customerLabel: string | null; isTerminal: boolean; active: boolean; countryIds: string[]; displayOrder: number; transitions: { toStatusId: string }[] }[],
  countryId: string | null
): WorkflowStep[] {
  const shown = statuses
    .filter((status) => status.active && (countryId === null || statusAppliesToCountry(status, countryId)))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const byId = new Map(shown.map((status) => [status.id, status]));
  return shown.map((status) => ({
    id: status.id,
    name: status.name,
    customerLabel: status.customerLabel,
    isTerminal: status.isTerminal,
    next: status.transitions
      .map((transition) => byId.get(transition.toStatusId))
      .filter((to): to is NonNullable<typeof to> => !!to)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((to) => to.name),
  }));
}
