import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { StaffLoginForm } from "@/components/crm/StaffLoginForm";

export const metadata: Metadata = {
  title: "Staff Login",
  description: "Sign in to the TripNexio CRM.",
};

interface StaffLoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function StaffLoginPage({ searchParams }: StaffLoginPageProps) {
  const { from } = await searchParams;

  return (
    <AuthShell eyebrow="TripNexio CRM" title="Staff Login" subtitle="Sign in with your staff account.">
      <StaffLoginForm redirectTo={from} />
    </AuthShell>
  );
}
