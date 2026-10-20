import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";

/**
 * Shared chrome for simple content pages (About, FAQ, Careers, Legal...) so they all look the same.
 * Client doc 2026-10-20 (M5) — body text is justified (with hyphenation) on Company / Support / Legal pages.
 */
export function InfoPage({
  eyebrow,
  title,
  description,
  narrow = true,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <Container className="pb-16 pt-8 sm:pb-24 sm:pt-10">
      <div className={cn(narrow ? "mx-auto flex max-w-3xl flex-col gap-10" : "flex flex-col gap-10", "[&_li]:text-justify [&_p]:text-justify [&_p]:hyphens-auto")}>
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        {children}
      </div>
    </Container>
  );
}
