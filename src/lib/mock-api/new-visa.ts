import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

export interface NewVisaSubmitResult {
  referenceId: string;
}

/**
 * Frontend-only mock — simulates the network round trip for a New Visa
 * request so the stepper's loading/success/error states have something
 * real to drive them. Swap this out for the real API call in M2; the
 * calling component only depends on this Promise shape, not on how it
 * resolves.
 */
export async function submitNewVisaRequest(values: NewVisaRequestValues): Promise<NewVisaSubmitResult> {
  await new Promise((resolve) => setTimeout(resolve, 1100));

  // No failure path is wired up yet since there's no real backend to fail —
  // the request flow's error branch (see MultiStepRequestFlow) still exists
  // and renders correctly, it's just not reachable from this mock today.
  void values;
  return { referenceId: `NV-${Date.now().toString().slice(-6)}` };
}
