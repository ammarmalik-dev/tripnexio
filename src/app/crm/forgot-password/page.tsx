import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/crm/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password | Internal Dashboard",
  description: "Reset your TripNexio Internal Dashboard password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="TripNexio Internal Dashboard" title="Forgot Password" subtitle="Enter your staff email and we'll send you a reset link.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
