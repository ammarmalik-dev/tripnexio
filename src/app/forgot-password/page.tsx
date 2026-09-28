import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/crm/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your TripNexio account password.",
  robots: { index: false },
};

export default function CustomerForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Account help" title="Forgot Password" subtitle="Enter your account email and we'll send you a reset link.">
      <ForgotPasswordForm endpoint="/api/auth/forgot-password" signInHref="/login" accountLabel="a TripNexio account" />
    </AuthShell>
  );
}
