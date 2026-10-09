import type { Metadata } from "next";
import { CalendarClock, Clock, ClipboardCheck, ShieldCheck, CreditCard, Send } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ServiceRequirementsSection } from "@/components/services/ServiceRequirementsSection";
import { ServiceHeroBackdrop } from "@/components/services/ServiceHeroBackdrop";
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
// Client testing 2026-10-09 (B18) — the client's list, each with a short description.
const whatYoullNeed = [
  { label: "Name", detail: "As printed on the passport" },
  { label: "Mobile Number", detail: "Active contact number for updates" },
  { label: "Email Address", detail: "For your quotation and extension updates" },
  { label: "Passport Number", detail: "For every applicant" },
  { label: "Visa Expiry Date", detail: "The expiry date on your current visa" },
];

// Client correction 2026-10-05 — compact 4 steps. Step 2 checks the visa and
// documents, not the passengers.
const visaProcessSteps = [
  { step: "01", icon: ClipboardCheck, headline: "Start Your Extension Request", supportingCopy: "Confirm your UAE entry date and required extension details." },
  { step: "02", icon: ShieldCheck, headline: "We Verify Your Visa & Documents", supportingCopy: "Our team checks your TripNexio-issued visa, actual expiry and required documents for eligibility." },
  { step: "03", icon: CreditCard, headline: "Review & Pay", supportingCopy: "Once verification is complete, review the quotation and complete payment." },
  { step: "04", icon: Send, headline: "Receive Your Extended Visa", supportingCopy: "We process the extension and send the extended visa copy by WhatsApp and email." },
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
        <ServiceHeroBackdrop service="VISA_EXTENSION" />
        <Container className="relative flex flex-col items-center gap-6 py-14 text-center sm:py-20">
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
            <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
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

      <section className="py-10 sm:py-14">
        <Container>
          <MotionReveal>
            <div className="flex max-w-3xl flex-col gap-4">
              <SectionHeading eyebrow="Who is this for?" title="Only for TripNexio-issued visas" />
              <p className="text-sm text-ink-secondary sm:text-base">
                We currently offer Visa Extension only for visas originally issued through TripNexio. If we can&apos;t
                find a matching TripNexio visa for your details, we&apos;ll guide you to Visa Change instead.
              </p>
            </div>
          </MotionReveal>

        </Container>
      </section>

      <ServiceRequirementsSection whatYouNeed={whatYoullNeed} documents={[]} />

      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How It Works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={visaProcessSteps} />
        </Container>
      </section>

      <ExtensionDetailsSection paymentLinkHours={paymentLinkHours} />
      <ImportantNoticesSection />
      <DocumentsPaymentSection paymentLinkHours={paymentLinkHours} />
      <AfterPaymentOutcomesSection />
      <ServiceFaqSection serviceType="VISA_EXTENSION" />

      <section className="pb-14 sm:pb-20">
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
              <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
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
