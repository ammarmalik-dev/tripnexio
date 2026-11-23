import crypto from "crypto";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getAbandonedCouponSettings, type AbandonedCouponSettings } from "../settings/coupon-config";
import { ABANDONED_DRAFT_SOURCE } from "../leads/abandoned-draft";
import { leadReference } from "../leads/reference";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { toWhatsAppId } from "../whatsapp/phone";
import { logReminder, wasRecentlyReminded } from "../automation/reminder-log";
import { isAutomationEnabled, localDateOf } from "../automation/settings";
import { money } from "../invoices/render-invoice";
import { getSystemConfig } from "../settings/system-config";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CLOSED_LEAD_STATUSES = ["CONVERTED", "LOST", "CLOSED"] as const;
const UNPAID_PAYMENT_STATUSES = ["PENDING", "EXPIRED", "FAILED"] as const;
/** Client doc 16 Nov (N9.2) — unpaid-quotation coupons are for these services. */
const UNPAID_QUOTATION_SERVICES = ["VISA_CHANGE", "FLIGHT_SPECIAL_FARE", "VISA_EXTENSION"] as const;
const SECOND_SEND_AFTER_MS = 4 * 60 * 60 * 1000;
const SECOND_SEND_EVENT = "ABANDONED_QUOTE_COUPON:SECOND";
/** No 0/O/1/I — the code is typed by hand from an email/WhatsApp message. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCouponCode(): string {
  const bytes = crypto.randomBytes(8);
  let suffix = "";
  for (const byte of bytes) suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `AQ${suffix}`;
}

async function uniqueCouponCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCouponCode();
    const taken = await db.coupon.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Couldn't generate a unique coupon code.");
}

/** "10% (up to Rs. 500.00)" / "Rs. 500.00" — the customer-facing {{couponValue}}. */
export function formatCouponValue(settings: Pick<AbandonedCouponSettings, "type" | "value" | "maxDiscount">): string {
  if (settings.type === "PERCENTAGE") {
    return `${settings.value}%${settings.maxDiscount != null ? ` (up to ${money(settings.maxDiscount)})` : ""}`;
  }
  const effective = settings.maxDiscount != null ? Math.min(settings.value, settings.maxDiscount) : settings.value;
  return money(effective);
}

/** Date in the Admin-configured business timezone (SystemConfig.timezoneOffsetMinutes), e.g. "7 Oct 2026". */
function formatLocalDate(date: Date, offsetMinutes: number): string {
  return new Date(date.getTime() + offsetMinutes * 60 * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

type AbandonReason = "QUOTE_EXPIRED" | "PAYMENT_UNPAID";

export interface AbandonedQuoteCouponSummary extends Record<string, unknown> {
  enabled: boolean;
  checked: number;
  couponsCreated: number;
  skippedAlreadyIssued: number;
  byReason: Record<AbandonReason, number>;
}

/**
 * P24 — the abandoned-quotation coupon job (n8n → POST
 * /api/automation/abandoned-quote-coupons). Does nothing unless Admin has
 * enabled it AND set type/value/afterHours/validDays (Admin → Coupons).
 *
 * A lead qualifies when it is not CONVERTED/LOST/CLOSED, the customer hasn't
 * opted out of follow-ups, no payment on any of its bookings has succeeded,
 * no ABANDONED_QUOTATION coupon was ever generated for it (Coupon.leadId),
 * and either:
 *  - its latest sent (non-draft) quotation has expired and was created more
 *    than `afterHours` ago, or
 *  - its latest payment on a live booking is unpaid (PENDING/EXPIRED/FAILED)
 *    and was created more than `afterHours` ago.
 * It then gets one single-use coupon (usageLimit 1, scoped to that lead via
 * Coupon.leadId and to the lead's service via Coupon.serviceTypes —
 * resolveCouponForQuotation rejects it anywhere else), sent
 * via notifyCustomer as ABANDONED_QUOTE_COUPON.
 */
export async function runAbandonedQuoteCouponJob(): Promise<AbandonedQuoteCouponSummary> {
  const byReason: Record<AbandonReason, number> = { QUOTE_EXPIRED: 0, PAYMENT_UNPAID: 0 };
  const settings = await getAbandonedCouponSettings();
  if (!settings) return { enabled: false, checked: 0, couponsCreated: 0, skippedAlreadyIssued: 0, byReason };
  // Client doc 16 Nov (N1 / N9.2) — Admin's on / off in Admin → Automation too.
  if (!(await isAutomationEnabled("COUPON_UNPAID_QUOTATION"))) return { enabled: false, checked: 0, couponsCreated: 0, skippedAlreadyIssued: 0, byReason };

  const { timezoneOffsetMinutes } = await getSystemConfig();
  const now = Date.now();
  const cutoff = new Date(now - settings.afterHours * HOUR_MS);

  const candidates = await db.lead.findMany({
    where: {
      status: { notIn: [...CLOSED_LEAD_STATUSES] },
      followUpOptOut: false,
      // Client doc 16 Nov (N9.2) — Visa Change / Flight / Visa Extension, once the customer selected a quotation.
      serviceType: { in: [...UNPAID_QUOTATION_SERVICES] },
      quotations: { some: { isSelected: true } },
      AND: [
        { OR: [{ source: null }, { source: { not: ABANDONED_DRAFT_SOURCE } }] },
        {
          bookings: { some: { status: { not: "CANCELLED" }, payments: { some: { createdAt: { lt: cutoff }, status: { in: [...UNPAID_PAYMENT_STATUSES] } } } } },
        },
      ],
      // Anything already paid is not abandoned.
      bookings: { none: { payments: { some: { status: "SUCCESS" } } } },
    },
    include: {
      customer: true,
      quotations: { where: { isDraft: false }, orderBy: { createdAt: "desc" }, take: 1 },
      bookings: {
        where: { status: { not: "CANCELLED" } },
        include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });

  if (candidates.length === 0) return { enabled: true, checked: 0, couponsCreated: 0, skippedAlreadyIssued: 0, byReason };

  const issuedCoupons = await db.coupon.findMany({
    where: { category: "ABANDONED_QUOTATION", leadId: { in: candidates.map((lead) => lead.id) } },
    select: { leadId: true, code: true, createdAt: true, usageCount: true, validUntil: true, type: true, value: true, maxDiscount: true },
  });
  const alreadyIssued = new Set(issuedCoupons.flatMap((coupon) => (coupon.leadId ? [coupon.leadId] : [])));
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const today = localDateOf(new Date(now), offsetMs);

  let couponsCreated = 0;
  let skippedAlreadyIssued = 0;

  for (const lead of candidates) {
    if (alreadyIssued.has(lead.id)) {
      // N9.2 — sent twice, the same day only: the same coupon again a few hours later while it is still unpaid / unused.
      const coupon = issuedCoupons.find((row) => row.leadId === lead.id);
      if (
        coupon &&
        coupon.usageCount === 0 &&
        (!coupon.validUntil || coupon.validUntil.getTime() > now) &&
        localDateOf(coupon.createdAt, offsetMs) === today &&
        now - coupon.createdAt.getTime() >= SECOND_SEND_AFTER_MS &&
        !(await wasRecentlyReminded(SECOND_SEND_EVENT, "Lead", lead.id, 3650 * DAY_MS))
      ) {
        const couponSettings = { type: coupon.type, value: Number(coupon.value), maxDiscount: coupon.maxDiscount == null ? null : Number(coupon.maxDiscount) } as unknown as AbandonedCouponSettings;
        await notifyCustomer({
          event: NOTIFICATION_EVENTS.ABANDONED_QUOTE_COUPON,
          emailTo: lead.customer.email,
          whatsappTo: toWhatsAppId(lead.customer.mobile),
          smsTo: toWhatsAppId(lead.customer.mobile),
          variables: {
            customerName: lead.customer.name,
            leadReference: leadReference(lead),
            couponCode: coupon.code,
            couponValue: formatCouponValue(couponSettings),
            validUntil: coupon.validUntil ? formatLocalDate(coupon.validUntil, timezoneOffsetMinutes) : "",
          },
          auditTarget: { entityType: "Lead", entityId: lead.id },
        });
        await logReminder(SECOND_SEND_EVENT, "Lead", lead.id);
      }
      skippedAlreadyIssued++;
      continue;
    }

    const latestPayment = lead.bookings
      .flatMap((booking) => booking.payments)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const paymentAbandoned =
      latestPayment != null &&
      (UNPAID_PAYMENT_STATUSES as readonly string[]).includes(latestPayment.status) &&
      latestPayment.createdAt < cutoff;

    // N9.2 — the trigger is a selected quotation that isn't paid.
    const reason: "PAYMENT_UNPAID" | null = paymentAbandoned ? "PAYMENT_UNPAID" : null;
    if (!reason) continue;

    const code = await uniqueCouponCode();
    const validFrom = new Date();
    const validUntil = new Date(validFrom.getTime() + settings.validDays * DAY_MS);
    const reference = leadReference(lead);

    const coupon = await db.$transaction(async (tx) => {
      const created = await tx.coupon.create({
        data: {
          code,
          type: settings.type,
          category: "ABANDONED_QUOTATION",
          value: settings.value,
          maxDiscount: settings.maxDiscount,
          validFrom,
          validUntil,
          usageLimit: 1,
          leadId: lead.id,
          // Admin handover §17 — valid only for this lead's own service.
          serviceTypes: [lead.serviceType],
          active: true,
        },
      });
      const note = `Abandoned-quotation coupon ${created.code} (${formatCouponValue(settings)}, valid until ${validUntil.toISOString()}) generated for lead ${reference} — selected quotation unpaid (via abandoned-quote-coupons automation)`;
      await writeAudit(tx, { entityType: "Coupon", entityId: created.id, action: "CREATE", note });
      await writeAudit(tx, { entityType: "Lead", entityId: lead.id, action: "ABANDONED_COUPON_ISSUED", note });
      return created;
    });

    await notifyCustomer({
      event: NOTIFICATION_EVENTS.ABANDONED_QUOTE_COUPON,
      emailTo: lead.customer.email,
      whatsappTo: toWhatsAppId(lead.customer.mobile),
      smsTo: toWhatsAppId(lead.customer.mobile),
      variables: {
        customerName: lead.customer.name,
        leadReference: reference,
        couponCode: coupon.code,
        couponValue: formatCouponValue(settings),
        validUntil: formatLocalDate(validUntil, timezoneOffsetMinutes),
      },
      auditTarget: { entityType: "Lead", entityId: lead.id },
    });
    await logReminder(NOTIFICATION_EVENTS.ABANDONED_QUOTE_COUPON, "Lead", lead.id);

    couponsCreated++;
    byReason[reason]++;
  }

  return { enabled: true, checked: candidates.length, couponsCreated, skippedAlreadyIssued, byReason };
}
