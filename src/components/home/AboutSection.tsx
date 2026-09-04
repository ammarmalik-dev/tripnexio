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
          <div className="relative overflow-hidden rounded-xl">
            <div className="relative aspect-[21/9] w-full">
              <Image
                src="https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1600&q=80"
                alt="Aerial view of the Burj Al Arab on the Dubai coastline"
                fill
                sizes="100vw"
                className="object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-surface-base via-surface-base/60 to-transparent"
                aria-hidden="true"
              />
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 sm:p-10 lg:max-w-xl">
              <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">
                About TripNexio
              </span>
              <p className="text-sm text-ink-secondary sm:text-base">
                TripNexio is a connected travel-services platform for India to
                UAE and GCC visas and flights. One company, one journey — our
                team handles the paperwork and coordination with vendors and
                airlines, in a single, reliable experience.
              </p>
              <Link
                href="/about"
                className="flex w-fit items-center gap-1.5 text-sm font-medium text-ink-accent transition-colors duration-200 hover:text-ink-primary"
              >
                Learn more about us
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
