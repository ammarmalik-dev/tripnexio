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

// Every day-to-day operational permission — everything except staff.manage
// and roles.manage, which stay Admin-only (admin.full already covers those
// for the Admin role, so this list is deliberately the complement of it).
const STAFF_ROLE_PERMISSIONS = PERMISSION_CATALOG.filter(
  (permission) => !["staff.manage", "roles.manage", ADMIN_FULL_PERMISSION].includes(permission.name)
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

  await db.airport.upsert({
    where: { code: "SA1" },
    update: {},
    create: {
      name: "Sample Airport 1",
      code: "SA1",
      country: "Sample Country",
      city: "Sample City",
      gccClassification: "UAE",
      displayOrder: 1,
    },
  });
  await db.airport.upsert({
    where: { code: "SA2" },
    update: {},
    create: {
      name: "Sample Airport 2",
      code: "SA2",
      country: "Sample Country",
      city: "Sample City",
      gccClassification: "INDIA",
      displayOrder: 2,
    },
  });

  await db.airline.upsert({
    where: { code: "SL1" },
    update: {},
    create: { name: "Sample Airline 1", code: "SL1", country: "Sample Country", otbRequired: true },
  });

  await db.border.upsert({
    where: { id: "sample-border-1" },
    update: {},
    create: {
      id: "sample-border-1",
      name: "Sample Border Crossing",
      side: "OMAN",
      uaeLocation: "Sample UAE-Side Location",
      destinationLocation: "Sample Destination-Side Location",
      displayOrder: 1,
    },
  });

  await db.documentRequirement.upsert({
    where: { nationality_documentName: { nationality: "Sample Nationality", documentName: "Sample Document" } },
    update: {},
    create: { nationality: "Sample Nationality", documentName: "Sample Document", required: true },
  });

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
