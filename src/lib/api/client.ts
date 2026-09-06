import type { ApiErrorBody, ApiSuccessBody } from "./respond";

export class ApiError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.fieldErrors = fieldErrors;
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
