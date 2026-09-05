import { NextResponse } from "next/server";

/**
 * Consistent API response shape across every route (CLAUDE.md quality
 * standard: "a consistent error response shape"). Success responses always
 * carry `{ data }`; errors always carry `{ error: { message, fieldErrors? } }`
 * and never leak internals (stack traces, raw DB errors) to the client.
 */
export interface ApiErrorBody {
  error: {
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export interface ApiSuccessBody<T> {
  data: T;
}

export function jsonError(status: number, message: string, fieldErrors?: Record<string, string[]>) {
  const body: ApiErrorBody = fieldErrors ? { error: { message, fieldErrors } } : { error: { message } };
  return NextResponse.json(body, { status });
}

export function jsonSuccess<T>(data: T, status = 200) {
  const body: ApiSuccessBody<T> = { data };
  return NextResponse.json(body, { status });
}
