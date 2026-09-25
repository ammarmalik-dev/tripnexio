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
import { FAQ_SEED_DATA } from "./faq-seed-data";
import { ServiceType } from "../src/generated/prisma/enums";

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
// staff.leave.approve is also excluded — Step 38, same "raise vs. approve"
// split as refunds.approve above. Every staff member can request their own
// leave (no permission needed — POST /api/staff-leave is session-gated
// only) but approving/rejecting it is Admin-only by default.
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
//
// payments.approve is also excluded — Step 51, same "raise vs. approve"
// split as refunds.approve/staff.leave.approve above. Staff keeps
// payments.edit (create a payment link or bank-transfer payment, upload a
// slip) but not the confirmation that actually converts the booking.
const STAFF_ROLE_PERMISSIONS = PERMISSION_CATALOG.filter(
  (permission) =>
    ![
      "staff.manage",
      "staff.leave.approve",
      "roles.manage",
      "masters.manage",
      "data.export",
      "automation.view",
      "refunds.approve",
      "leads.reassign",
      "ai.assist",
      "finance.manage",
      "payments.approve",
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

  // Step 36 (Admin FINAL handover §12): Vendor.service was replaced by a
  // VendorService join table so one vendor can cover multiple services.
  // Sample Vendor A is re-seeded covering TWO services specifically to
  // demonstrate that (it was NEW_VISA-only before this step). Service links
  // are synced via delete+recreate rather than nested upsert fields, so
  // re-running the seed always converges to this exact list.
  async function upsertSampleVendor(input: {
    id: string;
    name: string;
    services: Array<"NEW_VISA" | "VISA_EXTENSION" | "FLIGHT_SPECIAL_FARE">;
    pocName: string;
    mobile: string;
    email: string;
  }) {
    const fields = {
      name: input.name,
      pocName: input.pocName,
      mobile: input.mobile,
      email: input.email,
      processingDetails: "Sample processing notes — replace with the real vendor's workflow.",
      availability: "Mon–Sat, 9am–8pm IST",
      active: true,
    };
    const vendor = await db.vendor.upsert({
      where: { id: input.id },
      update: fields,
      create: { id: input.id, ...fields },
    });
    await db.vendorService.deleteMany({ where: { vendorId: vendor.id } });
    await db.vendorService.createMany({ data: input.services.map((service) => ({ vendorId: vendor.id, service })) });
    return vendor;
  }

  const sampleVendor = await upsertSampleVendor({
    id: "sample-vendor-1",
    name: "Sample Vendor A",
    services: ["NEW_VISA", "VISA_EXTENSION"],
    pocName: "Sample POC",
    mobile: "+91 90000 00001",
    email: "vendor-a@example.com",
  });
  const sampleFlightVendor = await upsertSampleVendor({
    id: "sample-vendor-2",
    name: "Sample Flight Consolidator",
    services: ["FLIGHT_SPECIAL_FARE"],
    pocName: "Sample Flight POC",
    mobile: "+91 90000 00002",
    email: "vendor-b@example.com",
  });
  console.log(`Sample vendors ready: ${sampleVendor.name} (2 services), ${sampleFlightVendor.name} (1 service)`);

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

  // Step 41 (Admin FINAL handover §5): DocumentRequirement dropped its DB-
  // level unique constraint (countryId/nationality/paxType are all
  // nullable now — same nullable-column-uniqueness reasoning as
  // PricingRule, Step 40), so upsert-by-compound-key no longer works;
  // find-or-create by the actual semantic key instead.
  async function upsertDocumentRequirementByKey(input: {
    serviceType: "NEW_VISA" | "OTB";
    countryId?: string | null;
    nationality?: string | null;
    paxType?: "ADULT" | "CHILD" | "INFANT" | null;
    documentName: string;
    required: boolean;
  }) {
    const key = {
      serviceType: input.serviceType,
      countryId: input.countryId ?? null,
      nationality: input.nationality ?? null,
      paxType: input.paxType ?? null,
      documentName: input.documentName,
    };
    const existing = await db.documentRequirement.findFirst({ where: key });
    if (existing) {
      return db.documentRequirement.update({ where: { id: existing.id }, data: { required: input.required } });
    }
    return db.documentRequirement.create({ data: { ...key, required: input.required } });
  }

  await upsertDocumentRequirementByKey({
    serviceType: "NEW_VISA",
    nationality: "Sample Nationality",
    documentName: "Sample Document",
    required: true,
  });

  await upsertDocumentRequirementByKey({
    serviceType: "OTB",
    nationality: "Sample Nationality",
    documentName: "Sample Document 2",
    required: false,
  });

  // Step 40 (Admin FINAL handover §4): PricingRule is now the real central
  // pricing control — replaces the retired NewVisaPricing model. This
  // UAE/normal set (adult/child/infant) is what makes a fresh dev DB's New
  // Visa website form actually payable end-to-end, same rates the old
  // NewVisaPricing sample row used. A second, nationality-specific override
  // row demonstrates that dimension still works (not used by New Visa's own
  // lookup today, since its form never asks nationality — see
  // computeNewVisaPrice's own doc comment — but real for any future service
  // that does ask).
  //
  // PricingRule has no DB-level unique constraint on the (serviceType,
  // countryId, processingType, paxType, nationality) tuple (see the
  // model's own doc comment), so a plain upsert-by-fixed-id can't detect a
  // pre-existing row created by something else with a different id — which
  // is exactly what happens on a DB that went through the Step 40
  // migration (it data-migrates the old NewVisaPricing sample row into
  // PricingRule with a random id) and then this seed. find-or-create by
  // the semantic key instead, so re-running this after that migration
  // converges onto the migrated row rather than creating a duplicate.
  async function upsertPricingRuleByKey(input: {
    fallbackId: string;
    serviceType: "NEW_VISA";
    countryId: string | null;
    processingType: string | null;
    paxType: "ADULT" | "CHILD" | "INFANT";
    nationality: string | null;
    vendorCost: number;
    sellingPrice: number;
    additionalCharges: number;
  }) {
    const { fallbackId, ...fields } = input;
    const existing = await db.pricingRule.findFirst({
      where: {
        serviceType: fields.serviceType,
        countryId: fields.countryId,
        processingType: fields.processingType,
        paxType: fields.paxType,
        nationality: fields.nationality,
      },
    });
    if (existing) {
      return db.pricingRule.update({ where: { id: existing.id }, data: fields });
    }
    return db.pricingRule.create({ data: { id: fallbackId, ...fields } });
  }

  await upsertPricingRuleByKey({
    fallbackId: "sample-pricing-rule-1",
    serviceType: "NEW_VISA",
    countryId: "cty_uae",
    processingType: "normal",
    paxType: "ADULT",
    nationality: null,
    vendorCost: 0,
    sellingPrice: 5000,
    additionalCharges: 0,
  });

  await upsertPricingRuleByKey({
    fallbackId: "sample-pricing-rule-2",
    serviceType: "NEW_VISA",
    countryId: "cty_uae",
    processingType: "normal",
    paxType: "CHILD",
    nationality: null,
    vendorCost: 0,
    sellingPrice: 3500,
    additionalCharges: 0,
  });

  await upsertPricingRuleByKey({
    fallbackId: "sample-pricing-rule-3",
    serviceType: "NEW_VISA",
    countryId: "cty_uae",
    processingType: "normal",
    paxType: "INFANT",
    nationality: null,
    vendorCost: 0,
    sellingPrice: 1000,
    additionalCharges: 0,
  });

  await upsertPricingRuleByKey({
    fallbackId: "sample-pricing-rule-4",
    serviceType: "NEW_VISA",
    countryId: null,
    processingType: null,
    paxType: "ADULT",
    nationality: "Sample Nationality",
    vendorCost: 0,
    sellingPrice: 2500,
    additionalCharges: 200,
  });

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

  // Real, client-supplied FAQ content (2026-09-24 "FINAL Page Content/
  // Design/FAQ" docs, 5 services, 124 FAQs total) — see faq-seed-data.ts's
  // own doc comment for the exact source. Deliberately `update: {}`, unlike
  // most other seed rows in this file — once staff have edited one of
  // these via /admin/faqs (fixing wording, publishing/unpublishing), a
  // future `db:seed` run must never silently overwrite that edit. `id` is
  // a stable, deterministic key derived from serviceType + position in the
  // source list, not the question text itself (which a staff edit might
  // change).
  for (const [serviceType, entries] of Object.entries(
    FAQ_SEED_DATA.reduce<Record<string, typeof FAQ_SEED_DATA>>((acc, entry) => {
      (acc[entry.serviceType] ??= []).push(entry);
      return acc;
    }, {})
  )) {
    for (const [index, entry] of entries.entries()) {
      const id = `faq-${serviceType.toLowerCase().replace(/_/g, "-")}-${index + 1}`;
      const data = {
        id,
        question: entry.question,
        answer: entry.answer,
        serviceType: entry.serviceType,
        keywords: entry.keywords,
        displayOrder: index + 1,
        active: true,
        published: true,
      };
      await db.faq.upsert({ where: { id }, update: {}, create: data });
    }
  }

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
    {
      id: "notification-template-visa-extension-reminder",
      event: NOTIFICATION_EVENTS.VISA_EXTENSION_REMINDER,
      subject: "Sample: Your extended UAE visa is valid until {{extensionExpiryDate}}",
      body: "Hi {{customerName}},\n\nYour extended UAE visa (booking {{bookingId}}) is valid until {{extensionExpiryDate}}. If you need a further extension, let us know and we'll check your eligibility.\n\n— TripNexio",
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
    {
      id: "notification-template-visa-extension-reminder-wa",
      event: NOTIFICATION_EVENTS.VISA_EXTENSION_REMINDER,
      body: "Hi {{customerName}}, your extended UAE visa (booking {{bookingId}}) is valid until {{extensionExpiryDate}}. Need a further extension? Just let us know.",
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

  // Step 44 (Admin FINAL handover §13) — every field left blank/null except
  // a clearly-labeled SAMPLE terms line (the one NOT NULL field). GST
  // number, bank details and signatory are real business/financial data —
  // per hard rule #1, never invented here, only a real value the client
  // enters at /admin/invoice-settings. Same `update: {}` protection as
  // taxFeeConfig above — once an admin has configured this for real,
  // re-seeding must never reset it.
  const invoiceConfig = {
    id: "singleton",
    termsAndNotes: "SAMPLE TERMS — replace with the real invoice terms and notes at /admin/invoice-settings before this goes live.",
  };
  await db.invoiceConfig.upsert({ where: { id: invoiceConfig.id }, update: {}, create: invoiceConfig });

  // ReturnTicketRuleConfig seed removed (client update, 2026-09-24) — the
  // visa-type-driven day-offset rule it configured no longer exists.

  // OTB processing timelines — client's confirmed answers: standard = 24
  // working days (2026-09-21), urgent = 8 working hours (2026-09-23).
  // `update: {}` so a re-seed never resets what an admin has since configured.
  await db.otbRuleConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", standardProcessingDays: 24, urgentProcessingHours: 8 },
  });

  // Step 42 (Admin FINAL handover §6) — one empty ServiceTimelineConfig row
  // per service, so the Admin screen always shows all 6 cards with nothing
  // to "create." Every SLA field starts null (hard rule #1 — no real
  // per-service processing/verification/completion/response numbers were
  // ever given beyond OTB's own already-seeded config above). `update: {}`
  // so re-seeding never resets whatever an admin has since configured.
  for (const serviceType of Object.values(ServiceType)) {
    await db.serviceTimelineConfig.upsert({
      where: { serviceType },
      update: {},
      create: { serviceType },
    });
  }

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
    create: { countryId: "cty_uae", ratePerApplicant: 100, displayOrder: 0 },
  });

  // Step 43 (Admin FINAL handover §7) — one SAMPLE New Visa Country
  // Configuration row so /admin/new-visa-countries has something to show
  // in a fresh dev DB. The country (UAE) is real locked-scope market data
  // (see the Country seed migration), but every descriptive field below is
  // clearly-labeled placeholder text — propose the real copy to the client
  // for review before this goes live, per hard rule #1.
  const sampleNewVisaCountryConfig = {
    countryId: "cty_uae",
    visaCategory: "SAMPLE — Tourist / Visit Visa",
    duration: "SAMPLE — 30 Days",
    entryType: "SAMPLE — Single Entry / Multiple Entry",
    processingType: "SAMPLE — Normal & Express available",
    description: "SAMPLE description — replace with the real New Visa country description before this goes live.",
    termsAndConditions: "SAMPLE terms and conditions — replace with the real New Visa country terms before this goes live.",
  };
  await db.newVisaCountryConfig.upsert({
    where: { countryId: "cty_uae" },
    update: sampleNewVisaCountryConfig,
    create: sampleNewVisaCountryConfig,
  });

  // Step 45 (Admin FINAL handover §19) — every field left at its schema
  // default (INR/330min-IST/90-day retention preserve exact prior hardcoded
  // behavior; company overrides null so the static site-config.ts defaults
  // keep applying; maintenance mode off). Deliberately `update: {}` — once
  // an admin has configured this for real, re-seeding must never reset it.
  await db.systemConfig.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });

  // New Visa pricing (Step 35, "pay right after the form"; Step 40, moved
  // onto the central PricingRule table) — the UAE/normal sample rows are
  // seeded above alongside the rest of PricingRule's sample data.

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
