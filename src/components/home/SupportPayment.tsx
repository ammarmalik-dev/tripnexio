import { ShieldCheck, Lock, BadgeCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { siteConfig } from "@/lib/site-config";

const badges = [
  { label: "Secure Payments", icon: ShieldCheck },
  { label: "Encrypted Data", icon: Lock },
  { label: "Safe & Reliable", icon: BadgeCheck },
];

export function SupportPayment() {
  return (
    <section id="support" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <MotionReveal>
            <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success">
                <SocialIcon platform="whatsapp" className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-semibold text-ink-primary">Need Help?</h3>
              <p className="flex-1 text-sm text-ink-secondary">
                Talk to our support team on WhatsApp — real people, real answers.
              </p>
              <a
                href={siteConfig.contact.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-2 rounded-md bg-success/15 px-4 py-2.5 text-sm font-medium text-success transition-colors duration-200 hover:bg-success/25"
              >
                <SocialIcon platform="whatsapp" className="h-4 w-4" />
                WhatsApp Support
              </a>
            </GlassCard>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent-light">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold text-ink-primary">Secure Payment</h3>
              <p className="flex-1 text-sm text-ink-secondary">
                Secure payments with confirmation at every step of your journey.
              </p>
            </GlassCard>
          </MotionReveal>
        </div>

        <MotionReveal delay={0.16}>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {badges.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-ink-tertiary">
                <Icon className="h-4 w-4 text-ink-accent" aria-hidden="true" />
                {label}
              </div>
            ))}
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
