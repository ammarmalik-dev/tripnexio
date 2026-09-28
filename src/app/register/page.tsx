import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { isGoogleSignInConfigured, safeNextPath } from "@/lib/auth/google";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a TripNexio account to track requests and manage your bookings.",
};

interface RegisterPageProps {
  searchParams: Promise<{ next?: string; email?: string; name?: string; google?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { next, email, name, google } = await searchParams;
  return (
    <AuthShell eyebrow="Get started" title="Create Your Account" subtitle="Register to track requests and manage your bookings.">
      {google === "new" ? (
        <p role="status" className="rounded-lg bg-accent/10 px-4 py-3 text-sm text-ink-secondary">
          There&apos;s no TripNexio account for that Google email yet. Finish registering below — then you can use
          Google to sign in.
        </p>
      ) : null}
      <RegisterForm
        next={next ? safeNextPath(next, "/account") : null}
        googleEnabled={isGoogleSignInConfigured()}
        prefill={{ email: email?.slice(0, 120), fullName: name?.slice(0, 80) }}
      />
    </AuthShell>
  );
}
