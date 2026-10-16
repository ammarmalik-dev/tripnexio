import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { createTask } from "../tasks/create-task";
import type { PassportOcrFields, TicketOcrFields, VisaOcrFields } from "./types";

/**
 * Client doc 2026-10-15 (J4) — every passport, visa and ticket the OCR reads is checked against what the
 * customer entered: passport number, name, date of birth and (for a visa copy) the visa expiry. All checked
 * fields matching shows "Data validated"; any difference shows "Manual validation required" with the
 * differences, and staff get a task. A ticket's PNR is also saved on the booking when none is recorded yet.
 * Nothing on the passenger is changed — staff still confirm OCR data themselves.
 */

export type CrossCheckStatus = "VALIDATED" | "MISMATCH" | "UNCHECKED";

export interface CrossCheckMismatch {
  field: string;
  entered: string;
  document: string;
}

export interface CrossCheckResult {
  status: CrossCheckStatus;
  checked: string[];
  mismatches: CrossCheckMismatch[];
}

export interface EnteredData {
  fullName?: string | null;
  passportNumber?: string | null;
  dob?: string | null;
  visaExpiryDate?: string | null;
}

const lettersOnly = (value: string) => value.toUpperCase().replace(/[^A-Z\s]/g, " ").split(/\s+/).filter(Boolean);
const alnum = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const isoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};

/** Same person: every word of the shorter name appears in the longer one (order and middle names aside). */
export function namesMatch(entered: string, document: string): boolean {
  const a = lettersOnly(entered);
  const b = lettersOnly(document);
  if (a.length === 0 || b.length === 0) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((word) => longer.includes(word));
}

/** Pure comparison — the fields both sides have are compared; anything missing on either side is skipped. */
export function compareWithEntered(document: { name?: string; passportNumber?: string; dob?: string; expiryDate?: string }, entered: EnteredData): CrossCheckResult {
  const checked: string[] = [];
  const mismatches: CrossCheckMismatch[] = [];
  if (document.passportNumber && entered.passportNumber) {
    checked.push("Passport number");
    if (alnum(document.passportNumber) !== alnum(entered.passportNumber)) mismatches.push({ field: "Passport number", entered: entered.passportNumber, document: document.passportNumber });
  }
  if (document.name && entered.fullName) {
    checked.push("Name");
    if (!namesMatch(entered.fullName, document.name)) mismatches.push({ field: "Name", entered: entered.fullName, document: document.name });
  }
  const docDob = document.dob ? isoDate(document.dob) : null;
  const enteredDob = entered.dob ? isoDate(entered.dob) : null;
  if (docDob && enteredDob) {
    checked.push("Date of birth");
    if (docDob !== enteredDob) mismatches.push({ field: "Date of birth", entered: enteredDob, document: docDob });
  }
  const docExpiry = document.expiryDate ? isoDate(document.expiryDate) : null;
  const enteredExpiry = entered.visaExpiryDate ? isoDate(entered.visaExpiryDate) : null;
  if (docExpiry && enteredExpiry) {
    checked.push("Visa expiry");
    if (docExpiry !== enteredExpiry) mismatches.push({ field: "Visa expiry", entered: enteredExpiry, document: docExpiry });
  }
  return { status: checked.length === 0 ? "UNCHECKED" : mismatches.length > 0 ? "MISMATCH" : "VALIDATED", checked, mismatches };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** What the customer entered for this passenger: the Passenger row, plus the lead's applicant entry (visa expiry). */
async function enteredDataFor(passengerId: string | null, leadId: string | null): Promise<EnteredData> {
  const passenger = passengerId ? await db.passenger.findUnique({ where: { id: passengerId }, select: { fullName: true, passportNumber: true, dob: true } }) : null;
  const entered: EnteredData = {
    fullName: passenger?.fullName ?? null,
    passportNumber: passenger?.passportNumber ?? null,
    dob: passenger?.dob ? passenger.dob.toISOString().slice(0, 10) : null,
  };
  if (leadId) {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { details: true } });
    const details = record(lead?.details);
    const applicants = Array.isArray(details.applicants) ? details.applicants.map(record) : [];
    const ids = Array.isArray(details.passengerIds) ? (details.passengerIds as unknown[]) : [];
    const index = passengerId ? ids.indexOf(passengerId) : -1;
    const applicant =
      (index >= 0 ? applicants[index] : undefined) ??
      applicants.find((row) => typeof row.passportNumber === "string" && entered.passportNumber && alnum(row.passportNumber) === alnum(entered.passportNumber));
    const expiry = applicant?.visaExpiryDate ?? details.visaExpiryDate;
    if (typeof expiry === "string") entered.visaExpiryDate = expiry;
  }
  return entered;
}

/**
 * Runs the check for a freshly created extraction and stores it on the extraction. Never throws: a failed
 * check just leaves the extraction for the normal staff review.
 */
export async function crossCheckExtraction(extractionId: string): Promise<CrossCheckResult | null> {
  try {
    const extraction = await db.documentExtraction.findUnique({
      where: { id: extractionId },
      include: { document: { select: { id: true, type: true, leadId: true, passengerId: true, bookingId: true, booking: { select: { id: true, leadId: true, pnr: true, lead: { select: { serviceType: true } } } } } } },
    });
    if (!extraction) return null;
    // A dev-only SAMPLE reading (no OCR key) says nothing about the real document.
    if (/placeholder|sample/i.test(extraction.provider)) return null;
    const fields = record(extraction.extractedFields);
    const leadId = extraction.document.leadId ?? extraction.document.booking?.leadId ?? null;
    const entered = await enteredDataFor(extraction.passengerId ?? extraction.document.passengerId, leadId);

    let documentData: { name?: string; passportNumber?: string; dob?: string; expiryDate?: string };
    if (extraction.extractionType === "PASSPORT") {
      const passport = fields as PassportOcrFields;
      documentData = { name: passport.fullName ?? [passport.givenNames, passport.surname].filter(Boolean).join(" "), passportNumber: passport.passportNumber, dob: passport.dob };
    } else if (extraction.extractionType === "VISA") {
      const visa = fields as VisaOcrFields;
      // Only a visa copy the customer uploaded has an entered expiry to compare; a delivered visa PDF is new.
      documentData = { name: visa.passengerName, passportNumber: visa.passportNumber, expiryDate: /_PDF$/i.test(extraction.document.type) ? undefined : visa.expiryDate };
    } else {
      const ticket = fields as TicketOcrFields;
      documentData = { name: ticket.passengerName };
    }
    const result = compareWithEntered(documentData, entered);

    const ticketPnr = extraction.extractionType === "TICKET" ? (fields as TicketOcrFields).pnr?.trim().toUpperCase() : undefined;
    const booking = extraction.document.booking;
    await db.$transaction(async (tx) => {
      await tx.documentExtraction.update({ where: { id: extractionId }, data: { crossCheck: result as unknown as Prisma.InputJsonObject } });
      await writeAudit(tx, {
        entityType: "DocumentExtraction",
        entityId: extractionId,
        action: "OCR_CROSS_CHECK",
        note:
          result.status === "VALIDATED"
            ? `Data validated against the entered details (${result.checked.join(", ")})`
            : result.status === "MISMATCH"
              ? `Manual validation required — ${result.mismatches.map((m) => `${m.field}: entered "${m.entered}", document "${m.document}"`).join("; ")}`
              : "Nothing to compare with the entered details",
      });
      if (result.status === "MISMATCH") {
        await createTask(tx, {
          type: "MANUAL_VERIFICATION",
          priority: "HIGH",
          title: `Manual validation required: ${extraction.document.type} doesn't match the entered details`,
          reason: result.mismatches.map((m) => `${m.field}: entered "${m.entered}", document "${m.document}"`).join("; "),
          entityType: "DocumentExtraction",
          entityId: extractionId,
          leadId: leadId ?? undefined,
          bookingId: extraction.document.bookingId,
          passengerId: extraction.passengerId ?? extraction.document.passengerId,
          serviceType: booking?.lead.serviceType,
        });
      }
      // The ticket's PNR is saved on the booking when none is recorded yet (never overwritten).
      if (ticketPnr && /^[A-Z0-9]{5,8}$/.test(ticketPnr) && booking && !booking.pnr) {
        await tx.booking.update({ where: { id: booking.id }, data: { pnr: ticketPnr } });
        await writeAudit(tx, { entityType: "Booking", entityId: booking.id, action: "PNR_CAPTURED", note: `PNR ${ticketPnr} captured from the uploaded ticket (OCR)` });
      }
    });
    return result;
  } catch (error) {
    console.error("[ocr/cross-check] failed", error);
    return null;
  }
}
