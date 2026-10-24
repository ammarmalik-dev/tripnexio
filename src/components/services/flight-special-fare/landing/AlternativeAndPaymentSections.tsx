import type { LucideIcon } from "lucide-react";
import { Route, ArrowRight, TrendingUp, TrendingDown, RefreshCw, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

interface ContentProps {
  content: SitePageContentView;
}

interface RoutePillProps {
  label: string;
  from: string;
  to: string;
  highlight?: boolean;
}

function RoutePill({ label, from, to, highlight = false }: RoutePillProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">{label}</span>
      <p
        className={
          highlight
            ? "flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-base font-semibold text-ink-heading"
            : "flex items-center gap-2 rounded-md border border-hairline px-4 py-3 text-base font-medium text-ink-secondary"
        }
      >
        {from}
        <ArrowRight className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
        <span className="sr-only">to</span>
        {to}
      </p>
    </div>
  );
}

/** Doc §10 — an alternative route, always clearly labelled as different from the request. */
export function AlternativeRouteSection({ content }: ContentProps) {
  const exampleRoutes = content.list("alternativeRoute.exampleRoutes", 3);
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <div className="flex flex-col gap-5">
            <SectionHeading
              eyebrow={content.text("alternativeRoute.eyebrow")}
              title={content.text("alternativeRoute.title")}
              description={content.text("alternativeRoute.intro")}
            />
            <p className="text-sm text-ink-secondary sm:text-base">{content.text("alternativeRoute.note")}</p>
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <GlassCard tier={2} className="flex flex-col gap-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Route className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold text-ink-heading">{content.text("alternativeRoute.exampleTitle")}</h3>
            </div>
            {/* The first route is the request; every route after it is an alternative, highlighted. */}
            {exampleRoutes.map(([label, from, to], index) => (
              <RoutePill key={`${index}-${label}`} label={label} from={from} to={to} highlight={index > 0} />
            ))}
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}

// Locked content — doc §11 alternative-flow outcomes; the wording is edited in Admin → Website Pages, icons cycle by position.
const outcomeIcons: LucideIcon[] = [TrendingUp, TrendingDown, RefreshCw];

/** Doc §11 — payment starts final seat/fare confirmation; ticket is not automatic. */
export function AfterPaymentSection({ content }: ContentProps) {
  const availability = content.list("afterPayment.availability", 2);
  const alternativeOutcomes = content.list("afterPayment.outcomes", 2).map(([title, body], index) => ({
    icon: outcomeIcons[index % outcomeIcons.length],
    title,
    body,
  }));
  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow={content.text("afterPayment.eyebrow")}
            title={content.text("afterPayment.title")}
            description={content.text("afterPayment.intro")}
            className="mx-auto"
          />
        </MotionReveal>
        <MotionReveal delay={0.04}>
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            {availability.map(([lead, text], index) => (
              <GlassCard key={`${index}-${lead}`} tier={2} className="p-5">
                <p className="text-sm text-ink-secondary">
                  <span className="font-semibold text-ink-heading">{lead}</span> {text}
                </p>
              </GlassCard>
            ))}
          </div>
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {alternativeOutcomes.map(({ icon: Icon, title, body }, index) => (
            <li key={`${index}-${title}`}>
              <MotionReveal delay={0.08 + index * 0.06} className="h-full">
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink-heading">{title}</h3>
                  <p className="text-sm text-ink-secondary">{body}</p>
                </GlassCard>
              </MotionReveal>
            </li>
          ))}
        </ul>
        <MotionReveal delay={0.2}>
          <p className="mx-auto flex max-w-2xl items-start justify-center gap-2.5 text-center text-sm font-medium text-ink-heading sm:text-base">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            {content.text("afterPayment.note")}
          </p>
        </MotionReveal>
      </Container>
    </section>
  );
}
