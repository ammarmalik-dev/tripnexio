import { IndianRupee } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { db } from "@/lib/db";

interface OtbPriceRow {
  key: string;
  airline: string;
  processing: "Normal" | "Urgent";
  price: number;
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Locked content — OTB Page Content v3 §13. Prices are never hard-coded:
 * rows come from the Admin-managed Airline master (active, OTB-required).
 * A Normal row is shown when normalPrice is set; an Urgent row only when
 * urgentPrice is set. Destination/passenger-type overrides (OtbPrice) are
 * resolved at request time — hence "The final amount is shown before payment."
 */
async function loadOtbPriceRows(): Promise<OtbPriceRow[]> {
  try {
    const airlines = await db.airline.findMany({
      where: { active: true, otbRequired: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { name: true, code: true, normalPrice: true, urgentPrice: true, displayOrder: true },
    });
    const rows: OtbPriceRow[] = [];
    for (const airline of airlines) {
      const label = `${airline.name} (${airline.code})`;
      if (airline.normalPrice !== null) {
        rows.push({ key: `${airline.code}-normal`, airline: label, processing: "Normal", price: Number(airline.normalPrice) });
      }
      if (airline.urgentPrice !== null) {
        rows.push({ key: `${airline.code}-urgent`, airline: label, processing: "Urgent", price: Number(airline.urgentPrice) });
      }
    }
    return rows;
  } catch (error) {
    // Never take the landing page down over the pricing table.
    console.error("[otb-pricing] couldn't load airline prices", error);
    return [];
  }
}

export async function OtbPricingSection() {
  const rows = await loadOtbPriceRows();

  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading align="center" eyebrow="Pricing" title="OTB Pricing" className="mx-auto" />
        </MotionReveal>
        <MotionReveal delay={0.06}>
          <GlassCard tier={2} className="flex flex-col gap-5 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <IndianRupee className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-ink-secondary sm:text-base">
                The applicable OTB price depends on the airline and selected processing option. The final amount is
                shown before payment.
              </p>
            </div>

            {rows.length > 0 ? (
              <>
                <div className="w-full overflow-x-auto rounded-lg border border-hairline">
                  <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                    <caption className="sr-only">OTB price by airline and processing option</caption>
                    <thead className="bg-surface-1">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold text-ink-heading">Airline</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-ink-heading">Processing</th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold text-ink-heading">OTB Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key} className="border-t border-hairline">
                          <td className="px-4 py-3 text-ink-primary">{row.airline}</td>
                          <td className="px-4 py-3 text-ink-secondary">{row.processing}</td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-ink-heading">
                            {formatInr(row.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-ink-tertiary">
                  The price can also vary by destination and passenger type &mdash; the final amount for your
                  destination and passengers is shown before payment.
                </p>
              </>
            ) : null}
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
