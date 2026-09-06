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

const SAMPLE_STAFF_EMAIL = "admin@tripnexio.com";
const SAMPLE_STAFF_PASSWORD = "ChangeMe123!";

// Every day-to-day operational permission — everything except staff.manage,
// roles.manage, and masters.manage, which stay Admin-only (admin.full
// already covers those for the Admin role, so this list is deliberately
// the complement of it). Masters (airports/airlines/borders) are reference
// data an ops lead curates, not something every staff member edits day to
// day — grant masters.manage to a role explicitly via the Admin Roles
// screen if a team needs it.
const STAFF_ROLE_PERMISSIONS = PERMISSION_CATALOG.filter(
  (permission) => !["staff.manage", "roles.manage", "masters.manage", ADMIN_FULL_PERMISSION].includes(permission.name)
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
    gccClassification: "UAE" as const,
    displayOrder: 1,
  };
  await db.airport.upsert({ where: { code: "SA1" }, update: sampleAirport1, create: sampleAirport1 });

  const sampleAirport2 = {
    name: "Sample Airport 2",
    code: "SA2",
    country: "Sample Country",
    city: "Sample City",
    gccClassification: "INDIA" as const,
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
    side: "OMAN" as const,
    uaeLocation: "Sample UAE-Side Location",
    destinationLocation: "Sample Destination-Side Location",
    displayOrder: 1,
  };
  await db.border.upsert({ where: { id: "sample-border-1" }, update: sampleBorder1, create: sampleBorder1 });

  const sampleBorder2 = {
    id: "sample-border-2",
    name: "Sample Border Crossing 2",
    side: "SAUDI_ARABIA" as const,
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

  await db.faq.upsert({
    where: { id: "sample-faq-1" },
    update: {},
    create: {
      id: "sample-faq-1",
      question: "Sample FAQ question?",
      answer: "Sample FAQ answer — replace with real content before launch.",
      category: "General",
      keywords: ["sample"],
      published: false,
    },
  });

  console.log("Sample masters rows ready (clearly labeled — not real domain data).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
