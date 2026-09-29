"use client";

import "./globals.css";

/**
 * P20 — last-resort boundary when the root layout itself fails. It replaces
 * the whole document, so it renders its own <html>/<body> and uses only the
 * global token classes (no layout components, which may be what failed).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-surface-base font-sans text-ink-primary antialiased">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
          <p className="text-sm font-semibold tracking-wide text-ink-accent uppercase">TripNexio</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-heading">We&apos;ll be right back</h1>
          <p className="text-base text-ink-secondary">
            The site hit an unexpected problem. Please try again in a moment.
          </p>
          {error.digest ? <p className="text-xs text-ink-tertiary">Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
