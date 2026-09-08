import type { ApiErrorBody, ApiSuccessBody } from "./respond";

export class ApiError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.fieldErrors = fieldErrors;
  }
}

/**
 * A distinct outcome from ApiError: the request succeeded (2xx, valid
 * data) but the *business* answer is "we can't proceed" rather than a
 * technical failure — e.g. Visa Extension's eligibility gate (no matching
 * TripNexio-issued visa found). A service's `onSubmit` wrapper throws this
 * instead of returning a reference id; MultiStepRequestFlow renders it as
 * an info panel (RequestInfoPanel) with an optional redirect CTA, not the
 * generic error state.
 */
export class RequestIneligibleOutcome extends Error {
  description: string;
  cta?: { label: string; href: string };

  constructor(message: string, description: string, cta?: { label: string; href: string }) {
    super(message);
    this.name = "RequestIneligibleOutcome";
    this.description = description;
    this.cta = cta;
  }
}

async function unwrapResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    throw new ApiError(
      errorBody?.error?.message ?? "Something went wrong. Please try again.",
      errorBody?.error?.fieldErrors
    );
  }

  return (payload as ApiSuccessBody<T>).data;
}

/** Shared client-side fetch helper — every service's lead-intake call goes through this for a consistent error shape. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrapResponse<T>(response);
}

/** Shared client-side GET helper — same consistent error shape as postJson. */
export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return unwrapResponse<T>(response);
}

/** Shared client-side PATCH helper — for the partial-update routes (status/assign/select) that only accept PATCH. */
export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrapResponse<T>(response);
}

/** Shared client-side DELETE helper. */
export async function deleteJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "DELETE" });
  return unwrapResponse<T>(response);
}
