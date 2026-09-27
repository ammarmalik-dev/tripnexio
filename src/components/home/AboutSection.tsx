import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { MotionReveal } from "@/components/motion/MotionReveal";

export function AboutSection() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <MotionReveal>
          <div className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-[0_8px_24px_-12px_rgb(17_19_24_/_10%)] sm:flex-row">
            <div className="flex flex-col justify-center gap-3 p-6 sm:w-2/5 sm:p-10">
              <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">
                About TripNexio
              </span>
              <p className="text-sm text-ink-secondary sm:text-base">
                TripNexio brings visa and travel services together in one
                simple experience. Choose your service, share your details,
                complete the required steps and track your request with
                guided support along the way.
              </p>
              <Link
                href="/about"
                className="flex w-fit items-center gap-1.5 text-sm font-medium text-ink-accent transition-colors duration-200 hover:text-accent-dark"
              >
                Learn More About Us
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="relative min-h-[220px] w-full sm:w-3/5">
              <Image
                src="https://images.unsplash.com/photo-1520437358207-323b43b50729?auto=format&fit=crop&w=1400&q=80"
                alt="Commercial aircraft taking off at dusk"
                fill
                sizes="(min-width: 640px) 60vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
