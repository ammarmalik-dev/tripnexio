import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { isGoogleSignInConfigured, safeNextPath } from "@/lib/auth/google";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your TripNexio account to track requests and manage your bookings.",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; google?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, google } = await searchParams;
  return (
    <AuthShell eyebrow="Welcome back" title="Log In" subtitle="Log in to track your requests and bookings.">
      {google === "failed" ? (
        <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          Google sign-in didn&apos;t complete. Please try again, or log in with your email and password.
        </p>
      ) : null}
      <LoginForm next={next ? safeNextPath(next, "/account") : null} googleEnabled={isGoogleSignInConfigured()} />
    </AuthShell>
  );
}
