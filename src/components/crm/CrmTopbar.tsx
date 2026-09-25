"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { GlobalSearch } from "./GlobalSearch";

interface CrmTopbarProps {
  staffName: string;
  staffRole: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
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
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-hairline bg-white/85 px-6 backdrop-blur-md">
      <GlobalSearch />
      <div className="flex shrink-0 items-center gap-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[image:var(--gradient-accent)] text-[11px] font-bold text-white">
            {initials(staffName)}
          </span>
          <div className="text-right">
            <p className="text-sm leading-tight font-semibold text-ink-primary">{staffName}</p>
            <p className="text-[11px] leading-tight text-ink-tertiary">{staffRole}</p>
          </div>
        </div>
        <div className="h-6 w-px bg-hairline" aria-hidden="true" />
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-tertiary transition-colors duration-150 hover:bg-ink-primary/[0.05] hover:text-ink-primary"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
