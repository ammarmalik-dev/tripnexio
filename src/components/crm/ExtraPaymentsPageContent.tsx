"use client";

import { useState } from "react";
import { ExtraPaymentLookupForm } from "./ExtraPaymentLookupForm";
import { ExtraPaymentsTable } from "./ExtraPaymentsTable";

/** Client-side composition root so the page.tsx wrapper can stay a Server Component with real per-page metadata. */
export function ExtraPaymentsPageContent() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <>
      <ExtraPaymentLookupForm onCreated={() => setRefreshSignal((current) => current + 1)} />
      <ExtraPaymentsTable refreshSignal={refreshSignal} />
    </>
  );
}
