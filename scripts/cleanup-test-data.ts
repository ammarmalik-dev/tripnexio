/**
 * cleanup-test-data.ts — P26: find (and optionally remove) test/sample data.
 *
 * USAGE
 *   npx tsx scripts/cleanup-test-data.ts
 *       DRY RUN (default). Connects via src/lib/db.ts (DATABASE_URL), prints
 *       counts + a sample of what it considers test data. Changes nothing.
 *
 *   npx tsx scripts/cleanup-test-data.ts --confirm
 *       Prints the same report, then asks you to type the exact phrase
 *       DELETE TEST DATA. Anything else aborts. Deletes run in ONE
 *       transaction (all-or-nothing) and write a summary AuditTrail row.
 *
 *   NODE_ENV=production ... --confirm --i-know-this-is-production
 *       With NODE_ENV=production, --confirm is refused unless this extra flag
 *       is also given. (A dry run is always allowed.)
 *
 * WHAT COUNTS AS TEST DATA
 *   - Customers whose email is @example.com/.net/.org, starts with "test+" or
 *     "test@", or starts with a local test-script prefix like "p25." — or whose
 *     name contains the word "Test" or "Sample"; plus everything hanging off
 *     them (leads, quotations, bookings, payments, refunds, documents,
 *     extractions, tasks, passengers, protection plans, OTPs, reset tokens,
 *     reminder logs, staff notifications pointing at them).
 *   - Any Payment whose gatewayRef starts with "mock_" (the mock gateway), with
 *     its refunds — even on a non-test customer's booking (the booking itself
 *     is left in place).
 *   - Master rows named/coded "Sample"/"Test" (whole word): airports,
 *     airlines, borders, vendors, coupons, document requirements; notification
 *     templates whose event starts with SAMPLE_; FAQs whose question starts
 *     with "Sample". A master row still referenced by real (non-test) data —
 *     a FK row or a Lead.details JSON mention — is DEACTIVATED (active=false)
 *     instead of deleted.
 *
 * Existing AuditTrail history is never deleted.
 */
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { db } from "../src/lib/db";
import type { Prisma } from "../src/generated/prisma/client";

const CONFIRM_PHRASE = "DELETE TEST DATA";
const SAMPLE_SIZE = 10;
const CHUNK = 5000;

const args = new Set(process.argv.slice(2));
const wantsDelete = args.has("--confirm");
const productionOverride = args.has("--i-know-this-is-production");
const isProduction = process.env.NODE_ENV === "production";

/** "Sample"/"Test" as a whole word — letters on either side don't count ("Latest", "Testing" don't match; "SAMPLE10" does). */
const TEST_WORD = /(^|[^a-z])(sample|test)([^a-z]|$)/i;
const TEST_EMAIL_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "example domain", pattern: /@example\.(com|net|org)$/i },
  { label: "test+ address", pattern: /^test\+/i },
  { label: "test@ address", pattern: /^test@/i },
  { label: "local test-script prefix (p<n>.)", pattern: /^p\d+\./i },
];

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

function unique(ids: Iterable<string>): string[] {
  return [...new Set(ids)];
}

function printSection(title: string, count: number, sample: string[]) {
  console.log(`\n${title}: ${count}`);
  for (const line of sample.slice(0, SAMPLE_SIZE)) console.log(`   - ${line}`);
  if (count > SAMPLE_SIZE) console.log(`   … and ${count - SAMPLE_SIZE} more`);
}

/** Lead ids whose details JSON mentions this id (Visa Change airport/border ids, OTB airline ids live there, not in FKs). */
async function leadsMentioning(id: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Lead" WHERE details::text LIKE ${`%${id}%`}`;
  return rows.map((row) => row.id);
}

interface MasterPlan {
  label: string;
  toDelete: { id: string; display: string }[];
  toDeactivate: { id: string; display: string; why: string }[];
}

async function main() {
  console.log(`TripNexio test-data cleanup — ${wantsDelete ? "DELETE MODE (will ask for confirmation)" : "DRY RUN (nothing will be changed)"}`);
  console.log(`NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}`);

  if (wantsDelete && isProduction && !productionOverride) {
    console.error("\nRefusing to delete: NODE_ENV=production. Re-run with --i-know-this-is-production as well if you really mean it.");
    process.exitCode = 1;
    return;
  }

  // ---------------------------------------------------------------- customers
  const allCustomers = await db.customer.findMany({ select: { id: true, name: true, email: true, mobile: true } });
  const testCustomers = allCustomers
    .map((customer) => {
      const reasons: string[] = [];
      const email = customer.email ?? "";
      for (const { label, pattern } of TEST_EMAIL_PATTERNS) if (email && pattern.test(email)) reasons.push(label);
      if (TEST_WORD.test(customer.name)) reasons.push("name contains Test/Sample");
      return { ...customer, reasons };
    })
    .filter((customer) => customer.reasons.length > 0);
  const customerIds = testCustomers.map((customer) => customer.id);

  const leads = await db.lead.findMany({ where: { customerId: { in: customerIds } }, select: { id: true, serviceType: true } });
  const leadIds = leads.map((lead) => lead.id);
  const passengers = await db.passenger.findMany({ where: { customerId: { in: customerIds } }, select: { id: true, fullName: true } });
  const passengerIds = passengers.map((passenger) => passenger.id);
  const bookings = await db.booking.findMany({
    where: { OR: [{ customerId: { in: customerIds } }, { leadId: { in: leadIds } }] },
    select: { id: true, bookingId: true },
  });
  const bookingIds = bookings.map((booking) => booking.id);
  const quotations = await db.quotation.findMany({ where: { leadId: { in: leadIds } }, select: { id: true } });
  const quotationIds = quotations.map((quotation) => quotation.id);

  const payments = await db.payment.findMany({
    where: { OR: [{ bookingId: { in: bookingIds } }, { gatewayRef: { startsWith: "mock_" } }] },
    select: { id: true, bookingId: true, gatewayRef: true, status: true },
  });
  const paymentIds = payments.map((payment) => payment.id);
  const testBookingSet = new Set(bookingIds);
  const mockPaymentsOnRealBookings = payments.filter((payment) => !testBookingSet.has(payment.bookingId));
  const refunds = await db.refund.findMany({ where: { paymentId: { in: paymentIds } }, select: { id: true } });
  const refundIds = refunds.map((refund) => refund.id);

  const documents = await db.document.findMany({
    where: { OR: [{ passengerId: { in: passengerIds } }, { bookingId: { in: bookingIds } }] },
    select: { id: true },
  });
  const documentIds = documents.map((document) => document.id);
  const extractionWhere: Prisma.DocumentExtractionWhereInput = {
    OR: [{ documentId: { in: documentIds } }, { passengerId: { in: passengerIds } }, { bookingId: { in: bookingIds } }],
  };
  const extractionCount = await db.documentExtraction.count({ where: extractionWhere });

  const allEntityIds = unique([...customerIds, ...leadIds, ...passengerIds, ...bookingIds, ...quotationIds, ...paymentIds, ...refundIds, ...documentIds]);
  const taskWhere: Prisma.TaskWhereInput = {
    OR: [{ leadId: { in: leadIds } }, { bookingId: { in: bookingIds } }, { passengerId: { in: passengerIds } }, { entityId: { in: allEntityIds } }],
  };
  const taskCount = await db.task.count({ where: taskWhere });
  const protectionPlanWhere: Prisma.ProtectionPlanWhereInput = { OR: [{ bookingId: { in: bookingIds } }, { passengerId: { in: passengerIds } }] };
  const protectionPlanCount = await db.protectionPlan.count({ where: protectionPlanWhere });
  const bookingPassengerWhere: Prisma.BookingPassengerWhereInput = { OR: [{ bookingId: { in: bookingIds } }, { passengerId: { in: passengerIds } }] };
  const bookingPassengerCount = await db.bookingPassenger.count({ where: bookingPassengerWhere });
  const otpCount = await db.customerOtp.count({ where: { customerId: { in: customerIds } } });
  const resetTokenCount = await db.customerPasswordResetToken.count({ where: { customerId: { in: customerIds } } });
  const reminderLogCount = await db.automationReminderLog.count({ where: { entityId: { in: allEntityIds } } });
  const staffNotificationCount = await db.staffNotification.count({ where: { entityId: { in: allEntityIds } } });

  // ------------------------------------------------------------------ masters
  const testLeadSet = new Set(leadIds);
  const testQuotationSet = new Set(quotationIds);
  const testPaymentSet = new Set(paymentIds);
  const realLeadMentions = async (id: string) => (await leadsMentioning(id)).filter((leadId) => !testLeadSet.has(leadId)).length;

  const masters: MasterPlan[] = [];

  {
    const plan: MasterPlan = { label: "Airports", toDelete: [], toDeactivate: [] };
    const rows = await db.airport.findMany({ select: { id: true, name: true, code: true } });
    for (const row of rows.filter((airport) => TEST_WORD.test(airport.name) || TEST_WORD.test(airport.code))) {
      const display = `${row.code} ${row.name}`;
      const mentions = await realLeadMentions(row.id);
      if (mentions > 0) plan.toDeactivate.push({ id: row.id, display, why: `${mentions} lead(s) reference it` });
      else plan.toDelete.push({ id: row.id, display });
    }
    masters.push(plan);
  }
  {
    const plan: MasterPlan = { label: "Airlines", toDelete: [], toDeactivate: [] };
    const rows = await db.airline.findMany({ select: { id: true, name: true, code: true, _count: { select: { otbPrices: true } } } });
    for (const row of rows.filter((airline) => TEST_WORD.test(airline.name) || TEST_WORD.test(airline.code))) {
      const display = `${row.code} ${row.name}`;
      const mentions = await realLeadMentions(row.id);
      if (row._count.otbPrices > 0 || mentions > 0) {
        plan.toDeactivate.push({ id: row.id, display, why: `${row._count.otbPrices} OTB price(s), ${mentions} lead(s) reference it` });
      } else plan.toDelete.push({ id: row.id, display });
    }
    masters.push(plan);
  }
  {
    const plan: MasterPlan = { label: "Borders", toDelete: [], toDeactivate: [] };
    const rows = await db.border.findMany({ select: { id: true, name: true } });
    for (const row of rows.filter((border) => TEST_WORD.test(border.name))) {
      const mentions = await realLeadMentions(row.id);
      if (mentions > 0) plan.toDeactivate.push({ id: row.id, display: row.name, why: `${mentions} lead(s) reference it` });
      else plan.toDelete.push({ id: row.id, display: row.name });
    }
    masters.push(plan);
  }
  {
    const plan: MasterPlan = { label: "Vendors", toDelete: [], toDeactivate: [] };
    const rows = await db.vendor.findMany({ select: { id: true, name: true, quotations: { select: { id: true } } } });
    for (const row of rows.filter((vendor) => TEST_WORD.test(vendor.name))) {
      const realQuotes = row.quotations.filter((quotation) => !testQuotationSet.has(quotation.id)).length;
      if (realQuotes > 0) plan.toDeactivate.push({ id: row.id, display: row.name, why: `${realQuotes} non-test quotation(s) use it` });
      else plan.toDelete.push({ id: row.id, display: row.name });
    }
    masters.push(plan);
  }
  {
    const plan: MasterPlan = { label: "Coupons", toDelete: [], toDeactivate: [] };
    const rows = await db.coupon.findMany({
      select: { id: true, code: true, quotations: { select: { id: true } }, payments: { select: { id: true } } },
    });
    for (const row of rows.filter((coupon) => TEST_WORD.test(coupon.code))) {
      const realQuotes = row.quotations.filter((quotation) => !testQuotationSet.has(quotation.id)).length;
      const realPayments = row.payments.filter((payment) => !testPaymentSet.has(payment.id)).length;
      if (realQuotes + realPayments > 0) {
        plan.toDeactivate.push({ id: row.id, display: row.code, why: `${realQuotes} quotation(s), ${realPayments} payment(s) use it` });
      } else plan.toDelete.push({ id: row.id, display: row.code });
    }
    masters.push(plan);
  }
  {
    const rows = await db.documentRequirement.findMany({ select: { id: true, documentName: true, serviceType: true } });
    masters.push({
      label: "Document requirements",
      toDelete: rows.filter((row) => TEST_WORD.test(row.documentName)).map((row) => ({ id: row.id, display: `${row.serviceType}: ${row.documentName}` })),
      toDeactivate: [],
    });
  }
  {
    const rows = await db.notificationTemplate.findMany({ where: { event: { startsWith: "SAMPLE_" } }, select: { id: true, event: true, channel: true } });
    masters.push({ label: "Notification templates", toDelete: rows.map((row) => ({ id: row.id, display: `${row.event} (${row.channel})` })), toDeactivate: [] });
  }
  {
    const rows = await db.faq.findMany({ where: { question: { startsWith: "Sample" } }, select: { id: true, question: true } });
    masters.push({ label: "FAQs", toDelete: rows.map((row) => ({ id: row.id, display: row.question })), toDeactivate: [] });
  }

  // ------------------------------------------------------------------- report
  console.log("\n=== Test customers and their data ===");
  printSection(
    "Customers",
    testCustomers.length,
    testCustomers.map((customer) => `${customer.id}  ${customer.name} <${customer.email ?? "no email"}> ${customer.mobile}  [${customer.reasons.join(", ")}]`)
  );
  printSection("Leads", leads.length, leads.map((lead) => `${lead.id} (${lead.serviceType})`));
  printSection("Quotations", quotationIds.length, quotationIds);
  printSection("Bookings", bookings.length, bookings.map((booking) => `${booking.id} ${booking.bookingId}`));
  printSection(
    "Payments (test bookings + gatewayRef mock_*)",
    payments.length,
    payments.map((payment) => `${payment.id} ${payment.gatewayRef ?? "(no gatewayRef)"} ${payment.status}`)
  );
  if (mockPaymentsOnRealBookings.length > 0) {
    console.log(`   ! ${mockPaymentsOnRealBookings.length} mock_ payment(s) sit on NON-test bookings — the payments go, the bookings stay.`);
  }
  printSection("Refunds", refundIds.length, refundIds);
  printSection("Passengers", passengers.length, passengers.map((passenger) => `${passenger.id} ${passenger.fullName}`));
  printSection("Documents", documentIds.length, documentIds);
  console.log(`\nDocument extractions: ${extractionCount}`);
  console.log(`Tasks: ${taskCount}`);
  console.log(`Protection plans: ${protectionPlanCount}`);
  console.log(`Booking-passenger links: ${bookingPassengerCount}`);
  console.log(`Customer OTPs: ${otpCount}`);
  console.log(`Customer password-reset tokens: ${resetTokenCount}`);
  console.log(`Automation reminder logs: ${reminderLogCount}`);
  console.log(`Staff notifications: ${staffNotificationCount}`);

  console.log("\n=== Sample/Test master rows ===");
  for (const plan of masters) {
    printSection(`${plan.label} — delete`, plan.toDelete.length, plan.toDelete.map((row) => `${row.id} ${row.display}`));
    if (plan.toDeactivate.length > 0) {
      printSection(`${plan.label} — deactivate (still referenced)`, plan.toDeactivate.length, plan.toDeactivate.map((row) => `${row.id} ${row.display} — ${row.why}`));
    }
  }

  if (!wantsDelete) {
    console.log("\nDry run complete — nothing was changed. Re-run with --confirm to delete.");
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`\nType "${CONFIRM_PHRASE}" to permanently delete the rows above: `);
  rl.close();
  if (answer !== CONFIRM_PHRASE) {
    console.log("Phrase did not match — aborted, nothing was changed.");
    return;
  }

  // ------------------------------------------------------------------- delete
  const summary = await db.$transaction(
    async (tx) => {
      const counts: Record<string, number> = {};
      const add = (key: string, value: number) => {
        counts[key] = (counts[key] ?? 0) + value;
      };

      for (const ids of chunks(allEntityIds)) {
        add("automationReminderLogs", (await tx.automationReminderLog.deleteMany({ where: { entityId: { in: ids } } })).count);
        add("staffNotifications", (await tx.staffNotification.deleteMany({ where: { entityId: { in: ids } } })).count);
      }

      add("protectionPlans", (await tx.protectionPlan.deleteMany({ where: protectionPlanWhere })).count);
      // Plans on non-test bookings that point at a mock payment/refund being removed keep the plan, lose the link.
      add("protectionPlanLinksCleared", (await tx.protectionPlan.updateMany({ where: { refundId: { in: refundIds } }, data: { refundId: null } })).count);
      add("protectionPlanLinksCleared", (await tx.protectionPlan.updateMany({ where: { paymentId: { in: paymentIds } }, data: { paymentId: null } })).count);

      add("refunds", (await tx.refund.deleteMany({ where: { id: { in: refundIds } } })).count);
      add("payments", (await tx.payment.deleteMany({ where: { id: { in: paymentIds } } })).count);
      add("bookingPassengers", (await tx.bookingPassenger.deleteMany({ where: bookingPassengerWhere })).count);
      add("tasks", (await tx.task.deleteMany({ where: taskWhere })).count);
      add("documentExtractions", (await tx.documentExtraction.deleteMany({ where: extractionWhere })).count);
      add("documents", (await tx.document.deleteMany({ where: { id: { in: documentIds } } })).count);

      await tx.booking.updateMany({ where: { linkedBookingId: { in: bookingIds } }, data: { linkedBookingId: null } });
      await tx.booking.updateMany({ where: { originalBookingId: { in: bookingIds } }, data: { originalBookingId: null } });
      add("bookings", (await tx.booking.deleteMany({ where: { id: { in: bookingIds } } })).count);

      await tx.quotation.updateMany({ where: { alternativeOfId: { in: quotationIds } }, data: { alternativeOfId: null } });
      add("quotations", (await tx.quotation.deleteMany({ where: { id: { in: quotationIds } } })).count);

      // Scalar (non-FK) lead pointers elsewhere — cleared so nothing points at a deleted lead.
      await tx.whatsAppConversation.updateMany({ where: { leadId: { in: leadIds } }, data: { leadId: null } });
      await tx.coupon.updateMany({ where: { leadId: { in: leadIds } }, data: { leadId: null } });
      add("leads", (await tx.lead.deleteMany({ where: { id: { in: leadIds } } })).count);

      add("passengers", (await tx.passenger.deleteMany({ where: { id: { in: passengerIds } } })).count);
      add("customerOtps", (await tx.customerOtp.deleteMany({ where: { customerId: { in: customerIds } } })).count);
      add("customerPasswordResetTokens", (await tx.customerPasswordResetToken.deleteMany({ where: { customerId: { in: customerIds } } })).count);
      add("customers", (await tx.customer.deleteMany({ where: { id: { in: customerIds } } })).count);

      // Masters — delete unreferenced rows, deactivate referenced ones.
      const byLabel = new Map(masters.map((plan) => [plan.label, plan] as const));
      const del = (label: string) => (byLabel.get(label)?.toDelete ?? []).map((row) => row.id);
      const off = (label: string) => (byLabel.get(label)?.toDeactivate ?? []).map((row) => row.id);

      add("airportsDeleted", (await tx.airport.deleteMany({ where: { id: { in: del("Airports") } } })).count);
      add("airportsDeactivated", (await tx.airport.updateMany({ where: { id: { in: off("Airports") } }, data: { active: false } })).count);
      add("airlinesDeleted", (await tx.airline.deleteMany({ where: { id: { in: del("Airlines") } } })).count);
      add("airlinesDeactivated", (await tx.airline.updateMany({ where: { id: { in: off("Airlines") } }, data: { active: false } })).count);
      add("bordersDeleted", (await tx.border.deleteMany({ where: { id: { in: del("Borders") } } })).count);
      add("bordersDeactivated", (await tx.border.updateMany({ where: { id: { in: off("Borders") } }, data: { active: false } })).count);

      const vendorDeleteIds = del("Vendors");
      await tx.vendorService.deleteMany({ where: { vendorId: { in: vendorDeleteIds } } });
      await tx.vendorRateHistory.deleteMany({ where: { vendorId: { in: vendorDeleteIds } } });
      add("vendorsDeleted", (await tx.vendor.deleteMany({ where: { id: { in: vendorDeleteIds } } })).count);
      add("vendorsDeactivated", (await tx.vendor.updateMany({ where: { id: { in: off("Vendors") } }, data: { active: false } })).count);

      add("couponsDeleted", (await tx.coupon.deleteMany({ where: { id: { in: del("Coupons") } } })).count);
      add("couponsDeactivated", (await tx.coupon.updateMany({ where: { id: { in: off("Coupons") } }, data: { active: false } })).count);
      add("documentRequirementsDeleted", (await tx.documentRequirement.deleteMany({ where: { id: { in: del("Document requirements") } } })).count);
      add("notificationTemplatesDeleted", (await tx.notificationTemplate.deleteMany({ where: { id: { in: del("Notification templates") } } })).count);
      add("faqsDeleted", (await tx.faq.deleteMany({ where: { id: { in: del("FAQs") } } })).count);

      const note = `Test-data cleanup (scripts/cleanup-test-data.ts${isProduction ? ", PRODUCTION override" : ""}): ${Object.entries(counts)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ") || "nothing matched"}`;
      await tx.auditTrail.create({ data: { entityType: "System", entityId: "cleanup-test-data", action: "CLEANUP_TEST_DATA", note } });
      return counts;
    },
    { maxWait: 10_000, timeout: 300_000 }
  );

  console.log("\nDone. Rows affected:");
  for (const [key, value] of Object.entries(summary)) console.log(`   ${key}: ${value}`);
  console.log("A summary AuditTrail row (entityType System, action CLEANUP_TEST_DATA) was written.");
}

main()
  .catch((error: unknown) => {
    console.error("\nCleanup failed — the transaction was rolled back, nothing was changed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
