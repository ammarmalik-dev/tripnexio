"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { crmNavItems } from "@/lib/crm/nav-config";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

export function CrmSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-2 flex w-60 shrink-0 flex-col gap-6 border-r border-hairline p-4">
      <div className="px-2 pt-1">
        <Logo />
        <p className="mt-1 text-xs font-medium tracking-wide text-ink-tertiary uppercase">CRM</p>
      </div>
      <nav aria-label="CRM" className="flex flex-col gap-1">
        {crmNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-accent/10 text-ink-accent"
                  : "text-ink-secondary hover:bg-ink-primary/[0.04] hover:text-ink-primary"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
