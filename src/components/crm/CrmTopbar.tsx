"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { GlobalSearch } from "./GlobalSearch";

interface CrmTopbarProps {
  staffName: string;
  staffRole: string;
}

export function CrmTopbar({ staffName, staffRole }: CrmTopbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/crm/auth/logout", { method: "POST" });
      router.push("/crm/login");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Please try again.");
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-hairline bg-surface-1 px-6">
      <GlobalSearch />
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-ink-primary">{staffName}</p>
          <p className="text-xs text-ink-tertiary">{staffRole}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-tertiary transition-colors duration-150 hover:bg-ink-primary/[0.04] hover:text-ink-primary"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
