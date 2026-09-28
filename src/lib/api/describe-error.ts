/**
 * Safe-to-log summary of a caught error for public routes: the error class
 * and code only. Whole error objects (Prisma errors in particular) can carry
 * query arguments and submitted values, i.e. customer PII.
 */
export function describeError(error: unknown): { name: string; code?: string } {
  if (typeof error !== "object" || error === null) return { name: typeof error };
  const name = (error as { name?: unknown }).name;
  const code = (error as { code?: unknown }).code;
  return { name: typeof name === "string" ? name : "Error", ...(typeof code === "string" ? { code } : {}) };
}
