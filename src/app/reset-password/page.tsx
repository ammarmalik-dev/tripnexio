import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/crm/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Choose a new TripNexio account password.",
  robots: { index: false },
};

interface CustomerResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function CustomerResetPasswordPage({ searchParams }: CustomerResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell eyebrow="Account help" title="Reset Password" subtitle="This reset link is missing or incomplete.">
        <Link href="/forgot-password" className="text-center text-sm font-medium text-ink-accent hover:underline">
          Request a new reset link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Account help" title="Reset Password" subtitle="Choose a new password for your TripNexio account.">
      <ResetPasswordForm token={token} endpoint="/api/auth/reset-password" signInHref="/login" />
    </AuthShell>
  );
}
