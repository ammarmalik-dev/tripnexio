"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TextField } from "@/components/forms/TextField";
import { PasswordField } from "@/components/forms/PasswordField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { AuthDivider } from "./AuthDivider";
import { GoogleButton, customerGoogleHref } from "./GoogleButton";
import { GuestContinueLink } from "./GuestContinueLink";
import { AuthSuccessNotice } from "./AuthSuccessNotice";
import { postJson, ApiError } from "@/lib/api/client";
import { registerSchema, type RegisterValues } from "@/lib/validation/auth-schema";

export function RegisterForm({
  next,
  googleEnabled = false,
  prefill,
}: {
  /** Same-site path to continue to after registering (P09 Apply flow). */
  next?: string | null;
  googleEnabled?: boolean;
  /** From a Google sign-in with no account yet — email/name to start from. */
  prefill?: { email?: string; fullName?: string };
} = {}) {
  const router = useRouter();
  const [registered, setRegistered] = useState(false);
  /** Set when an earlier guest record matched and a code was emailed to it — the form then asks for that code. */
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: prefill?.fullName ?? "", mobile: "", email: prefill?.email ?? "", password: "", confirmPassword: "", otp: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await postJson<{ otpRequired?: boolean; maskedEmail?: string }>("/api/auth/register", values);
      if (result?.otpRequired) {
        setOtpSentTo(result.maskedEmail ?? "your email");
        toast.success(`We emailed a 6-digit code to ${result.maskedEmail ?? "your email"}.`);
        return;
      }
      toast.success("Account created — you're signed in.");
      if (next) {
        router.push(next);
        router.refresh();
        return;
      }
      setRegistered(true);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages?.[0]) setError(field as keyof RegisterValues, { message: messages[0] });
        }
      }
      toast.error(error instanceof ApiError ? error.message : "Couldn't create your account right now. Please try again.");
    }
  });

  if (registered) {
    return (
      <AuthSuccessNotice
        title="Account created"
        description="You're signed in. Your next requests will be linked to your account automatically."
        cta={{ label: "Go to My Account", href: "/account" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Full Name"
          autoComplete="name"
          required
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <TextField
          label="Mobile Number"
          type="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          required
          error={errors.mobile?.message}
          {...register("mobile")}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint={!errors.password ? "At least 8 characters, with a number" : undefined}
          required
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          label="Confirm Password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        {otpSentTo ? (
          <TextField
            label="Verification Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            hint={!errors.otp ? `We found an earlier request with these details. Enter the code sent to ${otpSentTo}.` : undefined}
            required
            error={errors.otp?.message}
            {...register("otp")}
          />
        ) : null}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          {otpSentTo ? "Verify & Create Account" : "Create Account"}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <AuthDivider />
          <GoogleButton href={customerGoogleHref(next)} />
        </>
      ) : null}
      <GuestContinueLink />

      <p className="text-center text-sm text-ink-secondary">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-ink-accent hover:underline">
          Log In
        </Link>
      </p>
    </div>
  );
}
