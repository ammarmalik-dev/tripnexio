import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { StaffLoginForm } from "@/components/crm/StaffLoginForm";
import { isGoogleSignInConfigured } from "@/lib/auth/google";

export const metadata: Metadata = {
  title: "Staff Login",
  description: "Sign in to the TripNexio Internal Dashboard.",
};

interface StaffLoginPageProps {
  searchParams: Promise<{ from?: string; google?: string }>;
}

export default async function StaffLoginPage({ searchParams }: StaffLoginPageProps) {
  const { from, google } = await searchParams;

  return (
    <AuthShell eyebrow="TripNexio Internal Dashboard" title="Staff Login" subtitle="Sign in with your staff account.">
      {google ? (
        <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          {google === "no-account"
            ? "That Google account doesn't match an active staff account. Ask an admin, or sign in with your password."
            : "Google sign-in didn't complete. Please try again."}
        </p>
      ) : null}
      <StaffLoginForm redirectTo={from} googleEnabled={isGoogleSignInConfigured()} />
    </AuthShell>
  );
}
