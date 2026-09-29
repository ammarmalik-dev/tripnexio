import { Wallet } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format-currency";
import { getSystemConfig } from "@/lib/settings/system-config";
import type { PaxType } from "../../../../generated/prisma/enums";

const PAX_ORDER: PaxType[] = ["ADULT", "CHILD", "INFANT"];
const PAX_LABELS: Record<PaxType, string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };

interface PriceRow {
  paxType: PaxType;
  price: number;
}

interface NationalityGroup {
  /** null = the universal (all-nationality) rule set. */
  nationality: string | null;
  rows: PriceRow[];
}

/**
 * Admin-managed Visa Change rates — the same `PricingRule` rows
 * (serviceType VISA_CHANGE, countryId/processingType null) that
 * `computeVisaChangeFeeSuggestion()` prices a quote from, price =
 * sellingPrice + additionalCharges (vendorCost is internal, never read here).
 * Never throws: an unreachable DB just falls back to the neutral copy.
 */
async function loadVisaChangePriceGroups(): Promise<NationalityGroup[]> {
  try {
    const now = new Date();
    const rules = await db.pricingRule.findMany({
      where: {
        serviceType: "VISA_CHANGE",
        countryId: null,
        processingType: null,
        active: true,
        AND: [
          { OR: [{ validityFrom: null }, { validityFrom: { lte: now } }] },
          { OR: [{ validityUntil: null }, { validityUntil: { gte: now } }] },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        paxType: true,
        nationality: true,
        sellingPrice: true,
        additionalCharges: true,
        nationalityRef: { select: { name: true } },
      },
    });

    const groups = new Map<string, NationalityGroup>();
    for (const rule of rules) {
      const name = rule.nationalityRef?.name ?? (rule.nationality?.trim() || null);
      const key = name?.toLowerCase() ?? "";
      const group = groups.get(key) ?? { nationality: name, rows: [] };
      // Newest rule wins when two rows target the same nationality + passenger type.
      if (!group.rows.some((row) => row.paxType === rule.paxType)) {
        group.rows.push({ paxType: rule.paxType, price: Number(rule.sellingPrice) + Number(rule.additionalCharges) });
      }
      groups.set(key, group);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => PAX_ORDER.indexOf(a.paxType) - PAX_ORDER.indexOf(b.paxType)),
      }))
      .sort((a, b) => {
        if (a.nationality === null) return 1;
        if (b.nationality === null) return -1;
        return a.nationality.localeCompare(b.nationality);
      });
  } catch (error) {
    console.error("[visa-change/pricing] couldn't load Visa Change pricing rules", error);
    return [];
  }
}

/** Locked content — doc §10 "Pricing — Final Customer Copy". */
export async function VisaChangePricingSection() {
  const [groups, systemConfig] = await Promise.all([loadVisaChangePriceGroups(), getSystemConfig()]);
  const hasSpecificNationality = groups.some((group) => group.nationality !== null);

  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow="Pricing"
            title="Your final price is confirmed after availability"
            description="Visa Change pricing is nationality-wise and depends on the confirmed method and package, passenger type, passenger count and applicable charges. The final price is shown after an available option is confirmed and you select your preferred package."
            className="mx-auto"
          />
        </MotionReveal>

        <MotionReveal delay={0.06}>
          {groups.length > 0 ? (
            <GlassCard tier={2} className="mx-auto w-full max-w-3xl p-0 sm:p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <caption className="sr-only">Visa Change prices by nationality and passenger type</caption>
                  <thead>
                    <tr className="border-b border-hairline text-xs tracking-wide text-ink-tertiary uppercase">
                      <th scope="col" className="px-5 py-4 font-medium sm:px-6">Nationality</th>
                      <th scope="col" className="px-5 py-4 font-medium sm:px-6">Passenger</th>
                      <th scope="col" className="px-5 py-4 text-right font-medium sm:px-6">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.flatMap((group) =>
                      group.rows.map((row, rowIndex) => (
                        <tr
                          key={`${group.nationality ?? "all"}-${row.paxType}`}
                          className="border-b border-hairline last:border-b-0"
                        >
                          {rowIndex === 0 ? (
                            <th
                              scope="row"
                              rowSpan={group.rows.length}
                              className="px-5 py-3.5 align-top font-semibold text-ink-heading sm:px-6"
                            >
                              {group.nationality ??
                                (hasSpecificNationality ? "Other nationality" : "All nationalities")}
                            </th>
                          ) : null}
                          <td className="px-5 py-3.5 text-ink-secondary sm:px-6">{PAX_LABELS[row.paxType]}</td>
                          <td className="px-5 py-3.5 text-right font-semibold text-ink-heading tabular-nums sm:px-6">
                            {formatCurrency(row.price, systemConfig.currencyCode)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          ) : (
            <GlassCard tier={2} className="mx-auto flex w-full max-w-3xl items-start gap-4 p-6 sm:p-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-ink-secondary sm:text-base">
                Your nationality-wise price is shown before payment, once an available option is confirmed and you
                select your preferred package.
              </p>
            </GlassCard>
          )}
        </MotionReveal>
      </Container>
    </section>
  );
}
