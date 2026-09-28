/** Per-IP budget for each public lead-intake route (keyed by ip + route): 10 submissions per hour. */
export const LEAD_INTAKE_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };
