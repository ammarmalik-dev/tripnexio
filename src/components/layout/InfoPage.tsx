import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** Shared chrome for simple content pages (About, FAQ, Careers, Legal...) so they all look the same. */
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
    <Container className="py-16 sm:py-24">
      <div className={narrow ? "mx-auto flex max-w-3xl flex-col gap-10" : "flex flex-col gap-10"}>
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        {children}
      </div>
    </Container>
  );
}
