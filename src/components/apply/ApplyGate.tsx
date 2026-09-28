import { Suspense, type ReactNode } from "react";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { isGoogleSignInConfigured } from "@/lib/auth/google";
import { ApplyChoice } from "./ApplyChoice";

/**
 * P09 — Apply on any service first offers Log In / Continue as Guest,
 * skipped when the customer is already signed in. Both paths lead to the
 * exact same request form and data model; options already chosen (query
 * parameters such as country or processing type) are carried through login.
 */
export async function ApplyGate({ children }: { children: ReactNode }) {
  const session = await getCustomerSession();
  if (session) return <>{children}</>;
  return (
    <Suspense>
      <ApplyChoice googleEnabled={isGoogleSignInConfigured()}>{children}</ApplyChoice>
    </Suspense>
  );
}
