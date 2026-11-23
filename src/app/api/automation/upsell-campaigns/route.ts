import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { logReminder, wasRecentlyReminded } from "@/lib/automation/reminder-log";
import { isAutomationEnabled, localClock, localDateOf } from "@/lib/automation/settings";
import { crossUpsellDue, otbOfferDue, returnTicketOfferDue, visaExtensionUpsellDue } from "@/lib/automation/campaign-schedule";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { ensureLeadCustomerToken } from "@/lib/quotations/select-quotation";
import type { ServiceType } from "@/generated/prisma/enums";

/** Once per offer, ever. */
const ONCE_MS = 3650 * 24 * 60 * 60 * 1000;
/** Client doc 16 Nov — local send hours. */
const HOUR_OTB_RT = 16;
const HOUR_VE_UPSELL = 12;
const HOUR_CROSS = 20;
const PAID = ["CONFIRMED", "PROCESSING", "COMPLETED"] as const;
const UAE_OMAN = new Set(["AE", "ARE", "UAE", "OM", "OMN", "OMAN"]);

type CampaignBooking = Awaited<ReturnType<typeof loadBookings>>[number];

function loadBookings(serviceTypes: ServiceType[]) {
  return db.booking.findMany({
    where: { status: { in: [...PAID] }, lead: { serviceType: { in: serviceTypes }, followUpOptOut: false, crossSellOptOut: false } },
    select: {
      id: true,
      bookingId: true,
      customerId: true,
      createdAt: true,
      customer: { select: { name: true, email: true, mobile: true } },
      lead: {
        select: {
          id: true,
          serviceType: true,
          travelDate: true,
          customerToken: true,
          country: { select: { code: true, name: true } },
          quotations: { where: { isSelected: true }, select: { flightScope: true }, take: 1 },
        },
      },
      documents: { where: { type: { in: ["VISA_PDF", "TICKET_PDF"] }, deliveredAt: { not: null } }, select: { deliveredAt: true }, orderBy: { deliveredAt: "asc" }, take: 1 },
    },
    take: 2000,
  });
}

const isUaeOrOman = (booking: CampaignBooking) =>
  UAE_OMAN.has((booking.lead.country?.code ?? "").toUpperCase()) || /emirates|oman/i.test(booking.lead.country?.name ?? "");

/** International: a New Visa always is; a flight when its quotation says so (or its destination isn't India). */
const isInternational = (booking: CampaignBooking) =>
  booking.lead.serviceType === "NEW_VISA" ||
  booking.lead.quotations[0]?.flightScope === "INTERNATIONAL" ||
  (!booking.lead.quotations[0]?.flightScope && !!booking.lead.country && !/^(IN|IND)$/i.test(booking.lead.country.code));

/** The customer already started (or bought) this service after the booking — no offer for it. */
async function alreadyApplied(booking: CampaignBooking, serviceType: ServiceType, since: Date = booking.createdAt): Promise<boolean> {
  return (await db.lead.count({ where: { customerId: booking.customerId, serviceType, createdAt: { gt: since } } })) > 0;
}

async function sendOffer(booking: CampaignBooking, event: string, applyPath: string, extra: Record<string, string> = {}) {
  const travelDate = booking.lead.travelDate ? booking.lead.travelDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
  const token = booking.lead.customerToken ?? (await ensureLeadCustomerToken({ id: booking.lead.id, customerToken: booking.lead.customerToken }));
  await notifyCustomer({
    event,
    emailTo: booking.customer.email,
    whatsappTo: toWhatsAppId(booking.customer.mobile),
    variables: {
      customerName: booking.customer.name,
      bookingId: booking.bookingId,
      serviceName: SERVICE_TYPE_LABELS[booking.lead.serviceType],
      destination: booking.lead.country?.name ?? "your destination",
      travelDate,
      applyLink: `${siteConfig.url}${applyPath}`,
      unsubscribeLink: `${siteConfig.url}/follow-ups/stop/${token}`,
      ...extra,
    },
    auditTarget: { entityType: "Booking", entityId: booking.id },
  });
}

/**
 * Client doc 16 Nov — the upsell campaigns, run every hour; each sends only at its local hour, once per offer, while
 * Admin keeps it on (Admin → Automation), never after the customer's Stop Reminders / "No thanks", and never when the
 * customer already started that service. Upsell links are the normal application pages (a lead is created only when
 * the customer starts the application — the forms' own draft).
 * - N5 OTB (UAE / Oman visa or ticket): the day after delivery and 2 days before travel, 4:00 PM, max two per trip —
 *   one offer per customer and travel date when both a visa and a ticket were bought.
 * - N7 Visa Extension after a Visa Change approval (visa delivered): day 50 / 55 / 60, 12:00 PM.
 * - N8 Return Ticket (international visa or flight): 3 and 1 day before travel, 4:00 PM.
 * - N10 Flight → New Visa and New Visa → Flight: 5 and 2 days before departure, 8:00 PM.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");
  try {
    const summary = await recordAutomationRun("upsell-campaigns", async () => {
      const clock = await localClock();
      const sent: Record<string, number> = { otb: 0, returnTicket: 0, visaExtension: 0, newVisa: 0, flight: 0 };

      if (clock.hour === HOUR_OTB_RT) {
        const otbOn = await isAutomationEnabled("OTB_UPSELL");
        const rtOn = await isAutomationEnabled("RETURN_TICKET_UPSELL");
        if (otbOn || rtOn) {
          for (const booking of await loadBookings(["NEW_VISA", "FLIGHT_SPECIAL_FARE"])) {
            const travel = booking.lead.travelDate ? booking.lead.travelDate.toISOString().slice(0, 10) : null;
            const delivered = booking.documents[0]?.deliveredAt;
            // N5 — OTB.
            if (otbOn && delivered && isUaeOrOman(booking)) {
              const offer = otbOfferDue(clock.date, localDateOf(delivered, clock.offsetMs), travel);
              const key = `OTB_UPSELL:${offer}:${travel ?? booking.id}`;
              if (offer && !(await wasRecentlyReminded(key, "Customer", booking.customerId, ONCE_MS)) && !(await alreadyApplied(booking, "OTB"))) {
                await sendOffer(booking, NOTIFICATION_EVENTS.OTB_UPSELL, "/services/otb/request");
                await logReminder(key, "Customer", booking.customerId);
                sent.otb++;
              }
            }
            // N8 — Return Ticket.
            if (rtOn && travel && isInternational(booking)) {
              const offer = returnTicketOfferDue(clock.date, travel);
              const key = `RETURN_TICKET_UPSELL:${offer}:${travel}`;
              if (offer && !(await wasRecentlyReminded(key, "Customer", booking.customerId, ONCE_MS)) && !(await alreadyApplied(booking, "RETURN_TICKET"))) {
                await sendOffer(booking, NOTIFICATION_EVENTS.RETURN_TICKET_UPSELL, "/services/return-ticket/request");
                await logReminder(key, "Customer", booking.customerId);
                sent.returnTicket++;
              }
            }
          }
        }
      }

      // N7 — Visa Extension after a Visa Change approval.
      if (clock.hour === HOUR_VE_UPSELL && (await isAutomationEnabled("VISA_EXTENSION_UPSELL"))) {
        for (const booking of await loadBookings(["VISA_CHANGE"])) {
          const approved = booking.documents[0]?.deliveredAt;
          if (!approved) continue;
          const day = visaExtensionUpsellDue(clock.date, localDateOf(approved, clock.offsetMs));
          const key = `VISA_EXTENSION_UPSELL:${day}`;
          if (day && !(await wasRecentlyReminded(key, "Booking", booking.id, ONCE_MS)) && !(await alreadyApplied(booking, "VISA_EXTENSION", approved))) {
            await sendOffer(booking, NOTIFICATION_EVENTS.VISA_EXTENSION_UPSELL, "/services/visa-extension/request", { dayNumber: String(day) });
            await logReminder(key, "Booking", booking.id);
            sent.visaExtension++;
          }
        }
      }

      // N10 — Flight → New Visa and New Visa → Flight.
      if (clock.hour === HOUR_CROSS) {
        const toVisa = await isAutomationEnabled("NEW_VISA_UPSELL");
        const toFlight = await isAutomationEnabled("FLIGHT_UPSELL");
        if (toVisa || toFlight) {
          for (const booking of await loadBookings(["NEW_VISA", "FLIGHT_SPECIAL_FARE"])) {
            if (!booking.lead.travelDate) continue;
            const day = crossUpsellDue(clock.date, booking.lead.travelDate.toISOString().slice(0, 10));
            if (!day) continue;
            const flight = booking.lead.serviceType === "FLIGHT_SPECIAL_FARE";
            if (flight ? !toVisa || !isInternational(booking) : !toFlight) continue;
            const event = flight ? NOTIFICATION_EVENTS.NEW_VISA_UPSELL : NOTIFICATION_EVENTS.FLIGHT_UPSELL;
            const key = `${event}:${day}`;
            if (await wasRecentlyReminded(key, "Booking", booking.id, ONCE_MS)) continue;
            if (await alreadyApplied(booking, flight ? "NEW_VISA" : "FLIGHT_SPECIAL_FARE")) continue;
            const path = flight ? `/services/new-visa/request${booking.lead.country ? `?country=${encodeURIComponent(booking.lead.country.code)}` : ""}` : "/services/flight-special-fare/request";
            await sendOffer(booking, event, path);
            await logReminder(key, "Booking", booking.id);
            if (flight) sent.newVisa++;
            else sent.flight++;
          }
        }
      }

      return { localDate: clock.date, localHour: clock.hour, sent };
    });
    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/upsell-campaigns]", error instanceof Error ? error.message : "error");
    return jsonError(500, "Upsell campaign job failed.");
  }
}

/** Same handler for GET (Vercel Cron) and POST (n8n / VPS scheduler). */
export const GET = POST;
