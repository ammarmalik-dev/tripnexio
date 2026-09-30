import type { Metadata } from "next";
import { CalendarClock, Clock, ClipboardList, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
import { ExtensionDetailsSection } from "@/components/services/visa-extension/landing/ExtensionDetailsSection";
import { ImportantNoticesSection } from "@/components/services/visa-extension/landing/ImportantNoticesSection";
import { DocumentsPaymentSection } from "@/components/services/visa-extension/landing/DocumentsPaymentSection";
import { AfterPaymentOutcomesSection } from "@/components/services/visa-extension/landing/AfterPaymentOutcomesSection";
import { db } from "@/lib/db";
import { getDefaultPaymentLinkHours } from "@/lib/settings/system-config";

// P19 — FAQ block + Admin-configured payment-link validity are read from the DB.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Visa Extension",
  description:
    "Extend an existing UAE visa originally issued through TripNexio — submit your details online and our team verifies and processes your extension.",
};

// Locked — P05: exactly these five, nothing else.
const whatYoullNeed = ["Name", "Mobile Number", "Email Address", "Passport Number", "Visa Expiry Date"];

// Locked content — doc §5 "How It Works — reference-style 4-step journey".
const visaProcessSteps = [
  { step: "01", headline: "Share your visa details", supportingCopy: "Enter your name, mobile number, email address, passport number and visa expiry date." },
  { step: "02", headline: "We check your eligibility", supportingCopy: "We review your existing TripNexio visa and extension eligibility." },
  { step: "03", headline: "Review your extension", supportingCopy: "See the verified visa details, extension fee, applicable fine/overstay amount and payment deadline." },
  { step: "04", headline: "Get your extended visa", supportingCopy: "Complete payment and receive your extended visa once processing is completed." },
];

// Locked default from the page doc §6/§9 ("Payment Link — Valid for 24 hours"),
// used when the Admin Timeline/SLA config for VISA_EXTENSION has no payment deadline set.
const DEFAULT_PAYMENT_LINK_HOURS = 24;

async function loadPaymentLinkHours(): Promise<number> {
  try {
    const config = await db.serviceTimelineConfig.findUnique({
      where: { serviceType: "VISA_EXTENSION" },
      select: { active: true, paymentDeadlineHours: true },
    });
    if (config?.active && config.paymentDeadlineHours != null && config.paymentDeadlineHours > 0) {
      return config.paymentDeadlineHours;
    }
    // P24 — Admin → Payment Gateway's system-wide default, same order as create-payment.ts.
    const systemDefault = await getDefaultPaymentLinkHours();
    if (systemDefault != null && systemDefault > 0) return systemDefault;
  } catch (error) {
    // Never take the landing page down over a config read — fall back to the locked copy.
    console.error("[visa-extension] couldn't load timeline config", error);
  }
  return DEFAULT_PAYMENT_LINK_HOURS;
}

export default async function VisaExtensionLandingPage() {
  const paymentLinkHours = await loadPaymentLinkHours();

  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <CalendarClock className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">UAE Visa Extension</span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              Extend Your UAE Visa
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Extend an existing UAE visa originally issued through TripNexio. Submit your details online — our
              team verifies your visa and handles the extension process from there.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.15}>
            <p className="text-sm font-medium text-ink-tertiary">30-Day Extension • Online Request • Guided Process</p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/services/visa-extension/request" variant="primary" size="lg">
                Apply for Visa Extension
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                Track Status
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <MotionReveal>
            <div className="flex flex-col gap-4">
              <SectionHeading eyebrow="Who is this for?" title="Only for TripNexio-issued visas" />
              <p className="text-sm text-ink-secondary sm:text-base">
                We currently offer Visa Extension only for visas originally issued through TripNexio. If we can&apos;t
                find a matching TripNexio visa for your details, we&apos;ll guide you to Visa Change instead.
              </p>
            </div>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-base font-semibold text-ink-heading">What you&rsquo;ll need</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {whatYoullNeed.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How it works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={visaProcessSteps} />
        </Container>
      </section>

      <ExtensionDetailsSection paymentLinkHours={paymentLinkHours} />
      <ImportantNoticesSection />
      <DocumentsPaymentSection paymentLinkHours={paymentLinkHours} />
      <AfterPaymentOutcomesSection />
      <ServiceFaqSection serviceType="VISA_EXTENSION" />

      <section className="pb-20 sm:pb-28">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                Need more time in the UAE?
              </h2>
              <p className="max-w-xl text-sm text-ink-on-dark-secondary sm:text-base">
                Check your extension eligibility and submit your request online.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/services/visa-extension/request" variant="primary" size="lg">
                  Check Extension Eligibility
                </ButtonLink>
                <ButtonLink
                  href={utilityLinks.trackStatus.href}
                  variant="ghost"
                  size="lg"
                  className="border-white/40 text-white hover:border-white/70 hover:bg-white/5"
                >
                  Track Status
                </ButtonLink>
              </div>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
