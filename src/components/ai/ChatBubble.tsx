import type { ReactNode } from "react";
import { Sparkles, User } from "lucide-react";
import { cn } from "@/lib/cn";

interface ChatBubbleProps {
  role: "user" | "assistant";
  children: ReactNode;
}

export function ChatBubble({ role, children }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex items-start gap-2.5", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-ink-primary/[0.06] text-ink-secondary" : "bg-accent/10 text-accent-on-light"
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </span>
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-2 rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "rounded-tr-sm bg-[image:var(--gradient-accent)] text-white"
            : "rounded-tl-sm border border-hairline bg-surface-1 text-ink-primary"
        )}
      >
        {children}
      </div>
    </div>
  );
}
