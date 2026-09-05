import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your TripNexio account to track requests and manage your bookings.",
};

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Welcome back" title="Log In" subtitle="Log in to track your requests and bookings.">
      <LoginForm />
    </AuthShell>
  );
}
