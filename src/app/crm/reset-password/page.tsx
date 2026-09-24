import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/crm/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password | Internal Dashboard",
  description: "Choose a new TripNexio Internal Dashboard password.",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell eyebrow="TripNexio Internal Dashboard" title="Reset Password" subtitle="This reset link is missing or incomplete.">
        <Link href="/crm/forgot-password" className="text-center text-sm font-medium text-ink-accent hover:underline">
          Request a new reset link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="TripNexio Internal Dashboard" title="Reset Password" subtitle="Choose a new password for your staff account.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
