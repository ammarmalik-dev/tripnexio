import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a TripNexio account to track requests and manage your bookings.",
};

export default function RegisterPage() {
  return (
    <AuthShell eyebrow="Get started" title="Create Your Account" subtitle="Register to track requests and manage your bookings.">
      <RegisterForm />
    </AuthShell>
  );
}
