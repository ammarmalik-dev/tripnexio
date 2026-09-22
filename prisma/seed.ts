/**
 * Local/dev database seed. Per CLAUDE.md hard rule #1, this NEVER inserts
 * real domain data (no real airport/airline/border lists or prices) — only
 * the RBAC bootstrap rows genuinely needed to run the app, plus a handful
 * of masters rows named "Sample ..." so it's obvious they're placeholders,
 * not a real seeded catalog.
 */
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { PERMISSION_CATALOG, ADMIN_FULL_PERMISSION } from "../src/lib/auth/permissions";
import { NOTIFICATION_EVENTS } from "../src/lib/notifications/events";
import { SERVICE_STATUS_SEED } from "./seed-service-statuses";

/**
 * Step 19 Unit 1 (audit §3.9/§7.3) — seeds each service's real, locked
 * status list (see seed-service-statuses.ts's own header for sourcing)
 * plus a "next in the same group" transition chain and each service's
 * explicit extra branches. Idempotent (upsert on the serviceType/scope/name
 * unique constraint) so re-running the seed after an Admin has edited a
 * status via /admin/service-statuses only touches name/group collisions,
 * never blindly overwrites — matches this file's own established
 * always-sync-update-and-create convention (see the airport/airline/border
 * upserts above for the gotcha this avoids).
 */
async function seedServiceStatuses() {
  for (const def of SERVICE_STATUS_SEED) {
    const idByName = new Map<string, string>();

    for (const [index, status] of def.statuses.entries()) {
      const data = {
        serviceType: def.serviceType,
        scope: "BOOKING" as const,
        name: status.name,
        group: status.group ?? null,
        // Position within this service's own seed array — preserves the
        // exact order each status's source MD lists it in.
        displayOrder: index,
        isTerminal: status.isTerminal ?? false,
        blocksRefund: status.blocksRefund ?? false,
        customerLabel: status.customerLabel ?? null,
        mapsToBookingStatus: status.mapsToBookingStatus ?? null,
      };
      const row = await db.serviceStatus.upsert({
        where: { serviceType_scope_name: { serviceType: def.serviceType, scope: "BOOKING", name: status.name } },
        update: data,
        create: data,
      });
      idByName.set(status.name, row.id);
    }

    // Auto-chain: consecutive statuses within the same group, in seed order.
    const byGroup = new Map<string | undefined, string[]>();
    for (const status of def.statuses) {
      const key = status.group;
      const names = byGroup.get(key) ?? [];
      names.push(status.name);
      byGroup.set(key, names);
    }

    const pairs: [string, string][] = [];
    for (const names of byGroup.values()) {
      for (let i = 0; i < names.length - 1; i++) {
        pairs.push([names[i], names[i + 1]]);
      }
    }
    pairs.push(...(def.extraTransitions ?? []));

    for (const [fromName, toName] of pairs) {
      const fromId = idByName.get(fromName);
      const toId = idByName.get(toName);
      if (!fromId || !toId || fromId === toId) continue;
      await db.serviceStatusTransition.upsert({
        where: { fromStatusId_toStatusId: { fromStatusId: fromId, toStatusId: toId } },
        update: {},
        create: { fromStatusId: fromId, toStatusId: toId },
      });
    }
  }
}

const SAMPLE_STAFF_EMAIL = "admin@tripnexio.com";
const SAMPLE_STAFF_PASSWORD = "ChangeMe123!";

// Every day-to-day operational permission — everything except staff.manage,
// roles.manage, masters.manage, data.export, and automation.view, which stay
// Admin-only (admin.full already covers those for the Admin role, so this
// list is deliberately the complement of it). Masters/config data is
// reference data an ops lead curates, not something every staff member
// edits day to day; bulk customer-data export is sensitive; and automation
// run history sits under /admin/** alongside them (the whole section is
// gated as one unit — see ADMIN_SECTION_PERMISSIONS — so keeping this
// Admin-only avoids exposing the rest of that sidebar to every staff
// member just to let them see workflow health). Grant it explicitly via
// the Admin Roles screen if a team wants broader visibility.
//
// refunds.approve is also excluded — CRM.md §21's locked rule is "CRM
// raises, Admin approves/rejects; CRM cannot approve its own refund." Staff
// keeps refunds.edit (create/calculate a refund, which always lands as
// PENDING) but not the approval transition.
//
// leads.reassign is also excluded — CRM.md §34/ADMIN.md §12's locked rule is
// "normal CRM staff CANNOT assign/reassign... Admin CAN." Staff keeps
// leads.edit (claim/assign a currently-unassigned lead) but not the
// reassignment of a lead already assigned to someone else.
//
// ai.assist is also excluded — ADMIN.md §10 frames the AI Command Center as
// "a core Admin capability," and it surfaces cross-domain data (refunds,
// payments, staff workload) in one place regardless of the asker's other
// granular permissions — the same reasoning masters.manage/data.export
// already use for staying Admin-only.
//
// finance.manage is also excluded — ADMIN.md §29's explicit rule: "Internal
// vendor cost and margin must remain Admin-only." Expenses and the P&L
// report both surface exactly those figures.
const STAFF_ROLE_PERMISSIONS = PERMISSION_CATALOG.filter(
  (permission) =>
    ![
      "staff.manage",
      "roles.manage",
      "masters.manage",
      "data.export",
      "automation.view",
      "refunds.approve",
      "leads.reassign",
      "ai.assist",
      "finance.manage",
      ADMIN_FULL_PERMISSION,
    ].includes(permission.name)
).map((permission) => permission.name);

async function main() {
  // The full canonical permission catalog (src/lib/auth/permissions.ts) is
  // seeded up front so the Admin Roles screen always has every permission
  // to assign, even to a brand-new role with nothing checked yet.
  for (const permission of PERMISSION_CATALOG) {
    await db.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  const adminRole = await db.role.upsert({
    where: { name: "Admin" },
    update: { permissions: { set: [{ name: ADMIN_FULL_PERMISSION }] } },
    create: {
      name: "Admin",
      permissions: { connect: [{ name: ADMIN_FULL_PERMISSION }] },
    },
  });

  const staffRole = await db.role.upsert({
    where: { name: "Staff" },
    update: { permissions: { set: STAFF_ROLE_PERMISSIONS.map((name) => ({ name })) } },
    create: {
      name: "Staff",
      permissions: { connect: STAFF_ROLE_PERMISSIONS.map((name) => ({ name })) },
    },
  });

  console.log(`Roles ready: ${adminRole.name}, ${staffRole.name}`);

  // SAMPLE dev-only staff account so the CRM has someone to log in as —
  // change this password before any real deployment. Never seed real staff
  // credentials this way.
  const staffPasswordHash = await bcrypt.hash(SAMPLE_STAFF_PASSWORD, 10);
  const staffUser = await db.user.upsert({
    where: { email: SAMPLE_STAFF_EMAIL },
    update: {},
    create: {
      name: "Sample Admin",
      email: SAMPLE_STAFF_EMAIL,
      passwordHash: staffPasswordHash,
      roleId: adminRole.id,
      active: true,
    },
  });
  console.log(`Sample staff login ready: ${staffUser.email} / ${SAMPLE_STAFF_PASSWORD} (dev only — change before deploying)`);

  const sampleVendor = await db.vendor.upsert({
    where: { id: "sample-vendor-1" },
    update: {},
    create: { id: "sample-vendor-1", name: "Sample Vendor A", service: "NEW_VISA", active: true },
  });
  const sampleFlightVendor = await db.vendor.upsert({
    where: { id: "sample-vendor-2" },
    update: {},
    create: { id: "sample-vendor-2", name: "Sample Flight Consolidator", service: "FLIGHT_SPECIAL_FARE", active: true },
  });
  console.log(`Sample vendors ready: ${sampleVendor.name}, ${sampleFlightVendor.name}`);

  // Every masters upsert below repeats its fields in both `update` and
  // `create` — an empty `update: {}` was tried first, but that's a no-op
  // once the row already exists from an earlier seed run, so a field added
  // to `create` later (e.g. airline prices, displayOrder) never actually
  // reaches a pre-existing sample row. Always keep both in sync.
  const sampleAirport1 = {
    name: "Sample Airport 1",
    code: "SA1",
    country: "Sample Country",
    city: "Sample City",
    countryId: "cty_uae",
    displayOrder: 1,
  };
  await db.airport.upsert({ where: { code: "SA1" }, update: sampleAirport1, create: sampleAirport1 });

  const sampleAirport2 = {
    name: "Sample Airport 2",
    code: "SA2",
    country: "Sample Country",
    city: "Sample City",
    countryId: "cty_india",
    displayOrder: 2,
  };
  await db.airport.upsert({ where: { code: "SA2" }, update: sampleAirport2, create: sampleAirport2 });

  const sampleAirline1 = {
    name: "Sample Airline 1",
    code: "SL1",
    country: "Sample Country",
    otbRequired: true,
    normalPrice: 500,
    urgentPrice: 1500,
    displayOrder: 1,
  };
  await db.airline.upsert({ where: { code: "SL1" }, update: sampleAirline1, create: sampleAirline1 });

  const sampleAirline2 = {
    name: "Sample Airline 2",
    code: "SL2",
    country: "Sample Country",
    otbRequired: false,
    displayOrder: 2,
  };
  await db.airline.upsert({ where: { code: "SL2" }, update: sampleAirline2, create: sampleAirline2 });

  const sampleBorder1 = {
    id: "sample-border-1",
    name: "Sample Border Crossing",
    countryId: "cty_oman",
    uaeLocation: "Sample UAE-Side Location",
    destinationLocation: "Sample Destination-Side Location",
    displayOrder: 1,
  };
  await db.border.upsert({ where: { id: "sample-border-1" }, update: sampleBorder1, create: sampleBorder1 });

  const sampleBorder2 = {
    id: "sample-border-2",
    name: "Sample Border Crossing 2",
    countryId: "cty_saudi_arabia",
    uaeLocation: "Sample UAE-Side Location 2",
    destinationLocation: "Sample Destination-Side Location 2",
    activeForVisaChange: false,
    displayOrder: 2,
  };
  await db.border.upsert({ where: { id: "sample-border-2" }, update: sampleBorder2, create: sampleBorder2 });

  const sampleDocRequirement1 = {
    nationality: "Sample Nationality",
    serviceType: "NEW_VISA" as const,
    documentName: "Sample Document",
    required: true,
  };
  await db.documentRequirement.upsert({
    where: {
      nationality_serviceType_documentName: {
        nationality: sampleDocRequirement1.nationality,
        serviceType: sampleDocRequirement1.serviceType,
        documentName: sampleDocRequirement1.documentName,
      },
    },
    update: sampleDocRequirement1,
    create: sampleDocRequirement1,
  });

  const sampleDocRequirement2 = {
    nationality: "Sample Nationality",
    serviceType: "OTB" as const,
    documentName: "Sample Document 2",
    required: false,
  };
  await db.documentRequirement.upsert({
    where: {
      nationality_serviceType_documentName: {
        nationality: sampleDocRequirement2.nationality,
        serviceType: sampleDocRequirement2.serviceType,
        documentName: sampleDocRequirement2.documentName,
      },
    },
    update: sampleDocRequirement2,
    create: sampleDocRequirement2,
  });

  const samplePricingRule1 = {
    id: "sample-pricing-rule-1",
    serviceType: "NEW_VISA" as const,
    paxType: "ADULT" as const,
    nationality: null,
    basePrice: 2000,
    additionalCharges: 200,
  };
  await db.pricingRule.upsert({ where: { id: "sample-pricing-rule-1" }, update: samplePricingRule1, create: samplePricingRule1 });

  const samplePricingRule2 = {
    id: "sample-pricing-rule-2",
    serviceType: "NEW_VISA" as const,
    paxType: "CHILD" as const,
    nationality: null,
    basePrice: 1200,
    additionalCharges: 100,
  };
  await db.pricingRule.upsert({ where: { id: "sample-pricing-rule-2" }, update: samplePricingRule2, create: samplePricingRule2 });

  const samplePricingRule3 = {
    id: "sample-pricing-rule-3",
    serviceType: "NEW_VISA" as const,
    paxType: "ADULT" as const,
    nationality: "Sample Nationality",
    basePrice: 2500,
    additionalCharges: 200,
  };
  await db.pricingRule.upsert({ where: { id: "sample-pricing-rule-3" }, update: samplePricingRule3, create: samplePricingRule3 });

  const sampleCoupon1 = {
    code: "SAMPLE10",
    type: "PERCENTAGE" as const,
    value: 10,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validUntil: new Date("2026-12-31T23:59:59.000Z"),
    usageLimit: 100,
  };
  await db.coupon.upsert({ where: { code: "SAMPLE10" }, update: sampleCoupon1, create: sampleCoupon1 });

  const sampleCoupon2 = {
    code: "SAMPLE500FLAT",
    type: "FIXED_AMOUNT" as const,
    value: 500,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validUntil: new Date("2026-06-30T23:59:59.000Z"),
    usageLimit: null,
    active: false,
  };
  await db.coupon.upsert({ where: { code: "SAMPLE500FLAT" }, update: sampleCoupon2, create: sampleCoupon2 });

  const sampleFaq1 = {
    id: "sample-faq-1",
    question: "Sample FAQ question?",
    answer: "Sample FAQ answer — replace with real content before launch.",
    serviceType: null,
    category: "General",
    keywords: ["sample"],
    displayOrder: 1,
    active: true,
    published: false,
  };
  await db.faq.upsert({ where: { id: "sample-faq-1" }, update: sampleFaq1, create: sampleFaq1 });

  const sampleFaq2 = {
    id: "sample-faq-2",
    question: "Sample: How long does OTB processing take?",
    answer: "Sample answer — replace with real, service-specific content before launch.",
    serviceType: "OTB" as const,
    category: "Processing Time",
    keywords: ["sample", "otb", "processing"],
    displayOrder: 2,
    active: true,
    published: true,
  };
  await db.faq.upsert({ where: { id: "sample-faq-2" }, update: sampleFaq2, create: sampleFaq2 });

  const sampleTemplate1 = {
    id: "sample-notification-template-1",
    event: "SAMPLE_LEAD_CREATED",
    channel: "WHATSAPP" as const,
    subject: null,
    body: "Hi {{customerName}}, thanks for your {{serviceName}} request with TripNexio. Your reference is {{referenceId}} — our team will reach out shortly.",
  };
  await db.notificationTemplate.upsert({
    where: { event_channel: { event: sampleTemplate1.event, channel: sampleTemplate1.channel } },
    update: sampleTemplate1,
    create: sampleTemplate1,
  });

  const sampleTemplate2 = {
    id: "sample-notification-template-2",
    event: "SAMPLE_PAYMENT_SUCCESS",
    channel: "EMAIL" as const,
    subject: "Payment received — {{bookingId}}",
    body: "Hi {{customerName}},\n\nWe've received your payment of {{amount}} for booking {{bookingId}}. Thank you for choosing TripNexio.",
  };
  await db.notificationTemplate.upsert({
    where: { event_channel: { event: sampleTemplate2.event, channel: sampleTemplate2.channel } },
    update: sampleTemplate2,
    create: sampleTemplate2,
  });

  // The real EMAIL event catalog (src/lib/notifications/events.ts) — every
  // one of these is actually triggered somewhere in the app now (Phase 5B
  // for the request/webhook-triggered events, Phase 5E's n8n workflows for
  // the periodic ones: QUOTE_REMINDER, PAYMENT_REMINDER, LEAD_FOLLOWUP).
  // Copy below is obviously placeholder ("Sample:" prefix on the subject)
  // per hard rule #1 — propose real copy for review before launch, this
  // only exists so the pipeline has something to send.
  const emailTemplates = [
    {
      id: "notification-template-lead-received",
      event: NOTIFICATION_EVENTS.LEAD_RECEIVED,
      subject: "Sample: We've received your {{serviceType}} request — {{leadReference}}",
      body: "Hi {{customerName}},\n\nThanks for your {{serviceType}} request with TripNexio. Your reference is {{leadReference}} — our team will review it and reach out shortly.\n\n— TripNexio",
    },
    {
      id: "notification-template-quote-ready",
      event: NOTIFICATION_EVENTS.QUOTE_READY,
      subject: "Sample: Your TripNexio quote is ready — {{leadReference}}",
      body: "Hi {{customerName}},\n\nYour quote for {{leadReference}} is ready: {{sellingPrice}} (valid until {{quoteValidUntil}}).\n\nReview and approve it here: {{reviewLink}}\n\n— TripNexio",
    },
    {
      id: "notification-template-quote-reminder",
      event: NOTIFICATION_EVENTS.QUOTE_REMINDER,
      subject: "Sample: Reminder — your TripNexio quote for {{leadReference}} is expiring soon",
      body: "Hi {{customerName}},\n\nJust a reminder that your quote for {{leadReference}} will expire soon. Let us know if you'd like to proceed.\n\n— TripNexio",
    },
    {
      id: "notification-template-quote-expired",
      event: NOTIFICATION_EVENTS.QUOTE_EXPIRED,
      subject: "Sample: Your TripNexio quote for {{leadReference}} has expired",
      body: "Hi {{customerName}},\n\nThe quote we shared for {{leadReference}} has expired. Contact us and we'll be happy to share an updated quote.\n\n— TripNexio",
    },
    {
      id: "notification-template-payment-received",
      event: NOTIFICATION_EVENTS.PAYMENT_RECEIVED,
      subject: "Sample: Payment received — {{bookingId}}",
      body: "Hi {{customerName}},\n\nWe've received your payment of {{amount}} for booking {{bookingId}}. Your tax invoice is attached.\n\nThank you for choosing TripNexio.\n\n— TripNexio",
    },
    {
      id: "notification-template-payment-reminder",
      event: NOTIFICATION_EVENTS.PAYMENT_REMINDER,
      subject: "Sample: Reminder — complete your payment for {{bookingId}}",
      body: "Hi {{customerName}},\n\nJust a reminder that your payment of {{amount}} for booking {{bookingId}} is still pending. Let us know if you need any help completing it.\n\n— TripNexio",
    },
    {
      id: "notification-template-documents-required",
      event: NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
      subject: "Sample: Document required — {{leadReference}}",
      body: "Hi {{customerName}},\n\nWe need the following document to proceed with {{leadReference}}: {{documentName}}. Please share it at your earliest convenience.\n\n— TripNexio",
    },
    {
      id: "notification-template-document-approved",
      event: NOTIFICATION_EVENTS.DOCUMENT_APPROVED,
      subject: "Sample: Document verified — {{leadReference}}",
      body: "Hi {{customerName}},\n\nGood news — your {{documentName}} for {{leadReference}} has been verified.\n\n— TripNexio",
    },
    {
      id: "notification-template-document-rejected",
      event: NOTIFICATION_EVENTS.DOCUMENT_REJECTED,
      subject: "Sample: Document needs resubmission — {{leadReference}}",
      body: "Hi {{customerName}},\n\nYour {{documentName}} for {{leadReference}} couldn't be verified. Please resubmit a clear copy.\n\n— TripNexio",
    },
    {
      id: "notification-template-lead-followup",
      event: NOTIFICATION_EVENTS.LEAD_FOLLOWUP,
      subject: "Sample: Still interested in your {{serviceType}} request?",
      body: "Hi {{customerName}},\n\nJust checking in on your {{serviceType}} request ({{leadReference}}) — let us know if you have any questions or would like to proceed.\n\n— TripNexio",
    },
  ];
  for (const template of emailTemplates) {
    const data = { id: template.id, event: template.event, channel: "EMAIL" as const, subject: template.subject, body: template.body, active: true };
    await db.notificationTemplate.upsert({
      where: { event_channel: { event: data.event, channel: data.channel } },
      update: data,
      create: data,
    });
  }

  // Same events, WHATSAPP channel (Phase 5C, extended in 5E) — shorter copy (no subject
  // line on WhatsApp), and deliberately NO metaTemplateName/Language yet:
  // those only get filled in once Meta has actually approved this exact
  // copy as a Message Template (see docs/deployment/WHATSAPP_SETUP.md).
  // Until then sendNotificationWhatsApp() skips these (audited, not an
  // error) rather than attempting an unapproved send.
  const whatsappTemplates = [
    {
      id: "notification-template-lead-received-wa",
      event: NOTIFICATION_EVENTS.LEAD_RECEIVED,
      body: "Hi {{customerName}}, thanks for your {{serviceType}} request with TripNexio. Reference: {{leadReference}}. Our team will reach out shortly.",
    },
    {
      id: "notification-template-quote-ready-wa",
      event: NOTIFICATION_EVENTS.QUOTE_READY,
      body: "Hi {{customerName}}, your quote for {{leadReference}} is ready: {{sellingPrice}} (valid until {{quoteValidUntil}}). Review and pay here: {{reviewLink}}",
    },
    {
      id: "notification-template-quote-reminder-wa",
      event: NOTIFICATION_EVENTS.QUOTE_REMINDER,
      body: "Hi {{customerName}}, your quote for {{leadReference}} is expiring soon. Let us know if you'd like to proceed.",
    },
    {
      id: "notification-template-quote-expired-wa",
      event: NOTIFICATION_EVENTS.QUOTE_EXPIRED,
      body: "Hi {{customerName}}, your quote for {{leadReference}} has expired. Message us for an updated quote.",
    },
    {
      id: "notification-template-payment-received-wa",
      event: NOTIFICATION_EVENTS.PAYMENT_RECEIVED,
      body: "Hi {{customerName}}, we've received your payment of {{amount}} for booking {{bookingId}}. Thank you for choosing TripNexio!",
    },
    {
      id: "notification-template-payment-reminder-wa",
      event: NOTIFICATION_EVENTS.PAYMENT_REMINDER,
      body: "Hi {{customerName}}, your payment of {{amount}} for booking {{bookingId}} is still pending. Let us know if you need help completing it.",
    },
    {
      id: "notification-template-documents-required-wa",
      event: NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
      body: "Hi {{customerName}}, we need {{documentName}} to proceed with {{leadReference}}. Please share it at your earliest convenience.",
    },
    {
      id: "notification-template-document-approved-wa",
      event: NOTIFICATION_EVENTS.DOCUMENT_APPROVED,
      body: "Hi {{customerName}}, your {{documentName}} for {{leadReference}} has been verified. 👍",
    },
    {
      id: "notification-template-document-rejected-wa",
      event: NOTIFICATION_EVENTS.DOCUMENT_REJECTED,
      body: "Hi {{customerName}}, your {{documentName}} for {{leadReference}} couldn't be verified. Please resubmit a clear copy.",
    },
    {
      id: "notification-template-lead-followup-wa",
      event: NOTIFICATION_EVENTS.LEAD_FOLLOWUP,
      body: "Hi {{customerName}}, just checking in on your {{serviceType}} request ({{leadReference}}) — let us know if you'd like to proceed.",
    },
  ];
  for (const template of whatsappTemplates) {
    const data = {
      id: template.id,
      event: template.event,
      channel: "WHATSAPP" as const,
      subject: null,
      body: template.body,
      active: true,
      metaTemplateName: null,
      metaTemplateLanguage: null,
    };
    await db.notificationTemplate.upsert({
      where: { event_channel: { event: data.event, channel: data.channel } },
      update: data,
      create: data,
    });
  }

  // GST is OFF by default per the client's locked rule (ADMIN.md/CRM.md:
  // "Current: GST OFF, invoice non-GST") — gatewayFeePercent keeps the old
  // SAMPLE_GATEWAY_FEE_RATE (0.02) value, which was never in conflict.
  // Deliberately `update: {}` here (unlike every other masters upsert
  // above) — once an admin has actually configured a real rate through
  // /admin/tax-fee, re-running the seed must NOT silently reset it back to
  // this default.
  const taxFeeConfig = { id: "singleton", gstRatePercent: 0, gatewayFeePercent: 2 };
  await db.taxFeeConfig.upsert({ where: { id: taxFeeConfig.id }, update: {}, create: taxFeeConfig });

  // Return_Verified_Ticket.md §6: return/onward date = travelDate + this
  // many days, per the selected visa type — literal reading of "the
  // configured 30-day rule"/"the configured 60-day rule" (the spec doesn't
  // specify a buffer). Same `update: {}` rule as taxFeeConfig above — once
  // an admin has adjusted this, re-seeding must not silently reset it.
  const returnTicketRuleConfig = { id: "singleton", thirtyDayOffsetDays: 30, sixtyDayOffsetDays: 60, ninetyDayOffsetDays: 90 };
  await db.returnTicketRuleConfig.upsert({
    where: { id: returnTicketRuleConfig.id },
    update: {},
    create: returnTicketRuleConfig,
  });

  // OTB processing timelines — client's confirmed answers: standard = 24
  // working days (2026-09-21), urgent = 8 working hours (2026-09-23).
  // `update: {}` so a re-seed never resets what an admin has since configured.
  await db.otbRuleConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", standardProcessingDays: 24, urgentProcessingHours: 8 },
  });

  // New Visa occupation dropdown — the starting list the client specified;
  // Admin adds/removes options at /admin/occupations. `update: {}` so a
  // re-seed never resurrects an option the admin removed or renames one.
  for (const [index, name] of ["Employee", "Business", "Retired", "Student", "Housewife", "None"].entries()) {
    await db.occupation.upsert({ where: { name }, update: {}, create: { name, displayOrder: index } });
  }

  // Return Ticket destinations are Admin-managed (client update). One
  // SAMPLE row so the website form has something to show in a fresh dev DB —
  // the ₹100 rate is a placeholder, not a real price; the client sets real
  // countries/rates at /admin/return-ticket-destinations (hard rule #1).
  await db.returnTicketDestination.upsert({
    where: { countryId: "cty_uae" },
    update: {},
    create: { countryId: "cty_uae", ratePerApplicant: 100, validityOptions: ["THIRTY_DAYS", "SIXTY_DAYS", "NINETY_DAYS"], displayOrder: 0 },
  });

  // New_Visa.md §8: "Default reference price: ₹5,000, configurable by
  // Admin." Eligibility conditions are the doc's own §8 list, transcribed
  // verbatim (real spec content, not a SAMPLE placeholder). termsText IS a
  // SAMPLE placeholder — the doc never gives literal T&C prose ("full
  // applicable conditions are displayed" describes a requirement, not
  // wording) — per CLAUDE.md hard rule #1, propose the real copy to the
  // client for review before replacing this. Same `update: {}` rule as
  // taxFeeConfig/returnTicketRuleConfig above — once an admin has edited
  // this, re-seeding must not silently reset it.
  const protectionPlanConfig = {
    id: "singleton",
    defaultPrice: 5000,
    termsText:
      "SAMPLE TERMS — replace with the real Protection Plan terms and conditions before this goes live. " +
      "By purchasing Protection Plan, the passenger acknowledges the eligibility conditions shown, agrees " +
      "that TripNexio's decision on eligibility is final, and accepts that Protection Plan may be " +
      "cancelled with a refund if found ineligible after purchase, per the terms shown at the time of purchase.",
    eligibilityConditions: [
      "Fresh/first-time passport",
      "No relevant GCC travel history",
      "No relevant legal/immigration issue",
      "No applicable fine/penalty",
      "No false/forged/misleading information",
    ],
  };
  await db.protectionPlanConfig.upsert({
    where: { id: protectionPlanConfig.id },
    update: {},
    create: protectionPlanConfig,
  });

  // ADMIN.md §25: "Current employee coupon limit: ₹500... an Admin
  // configuration value, not permanent hard-coded logic." Same `update: {}`
  // rule as the other singleton configs above — once an admin edits this,
  // re-seeding must not silently reset it.
  const couponConfig = { id: "singleton", employeeCouponCap: 500 };
  await db.couponConfig.upsert({ where: { id: couponConfig.id }, update: {}, create: couponConfig });

  console.log("Sample masters rows ready (clearly labeled — not real domain data).");

  await seedServiceStatuses();
  console.log("Per-service status catalogs ready (Step 19, seeded from the locked service MDs).");

  // Step 28 (audit §4.8) — ADMIN.md §28's own "Initial examples" list,
  // verbatim and in the given order. These are the client's own locked
  // starting categories, not invented/sample data — seeded for real, same
  // treatment the per-service status lists got in Step 19.
  const EXPENSE_CATEGORIES = [
    "Advertising",
    "Salary",
    "Domain",
    "VPS / Hosting",
    "AI",
    "API",
    "WhatsApp",
    "Email",
    "Software",
    "OCR",
    "Payment Gateway",
    "Vendor",
    "Office",
    "Marketing",
    "Operations",
    "Other",
  ];
  // update: {} deliberately, not the full data object — ADMIN.md §28 says
  // "Admin can later add/disable/reorder categories," so once seeded, a
  // re-run must never silently undo an admin's own displayOrder/active
  // edit. Same convention as the singleton config rows above.
  for (const [index, name] of EXPENSE_CATEGORIES.entries()) {
    await db.expenseCategory.upsert({ where: { name }, update: {}, create: { name, displayOrder: index, active: true } });
  }
  console.log("Expense categories ready (Step 28, ADMIN.md §28's locked starter list).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
