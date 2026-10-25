/**
 * Client 2026-10-23 audit — a customer message whose provider call fails (network blip, provider 5xx) is tried once
 * more after a short pause before it is recorded as failed. Only the provider call is retried, never the rendering.
 */
export async function withOneRetry<T>(send: () => Promise<T>, pauseMs = 1500): Promise<T> {
  try {
    return await send();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    return send();
  }
}
