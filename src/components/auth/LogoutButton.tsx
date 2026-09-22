"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/api/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await postJson("/api/auth/logout", {});
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <Button type="button" size="sm" variant="ghost" onClick={() => void handleLogout()} isLoading={loading}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Log Out
    </Button>
  );
}
