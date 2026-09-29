"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";

/** CRM.md §31 lists Logout under Profile — same endpoint as the topbar's sign-out. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/crm/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout failed");
      router.push("/crm/login");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Please try again.");
      setPending(false);
    }
  };

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => void handleSignOut()} isLoading={pending}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Sign out
    </Button>
  );
}
