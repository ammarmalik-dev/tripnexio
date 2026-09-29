import { db } from "../db";
import { createTask } from "../tasks/create-task";
import { passportValidityTooShort } from "./passport-validity";

export const PASSPORT_VALIDITY_TASK_TITLE = "Passport validity under 6 months";

/**
 * P10 — after a New Visa request is saved (and any passport OCR has run),
 * creates a staff Task per traveller whose passport expires within 6 months
 * of the travel date — from the date they entered, else the OCR reading.
 * A warning for staff, never a block; one open task per passenger. Never
 * throws: a failure here must not fail the customer's submission.
 */
export async function flagShortPassportValidity(input: {
  leadId: string;
  travelDate: string;
  travellers: { passengerId: string; fullName: string; enteredExpiry?: string | null }[];
}): Promise<void> {
  try {
    for (const traveller of input.travellers) {
      let expiry = traveller.enteredExpiry || null;
      let source = "entered by the customer";
      if (!expiry) {
        const extraction = await db.documentExtraction.findFirst({
          where: { passengerId: traveller.passengerId, extractionType: "PASSPORT" },
          orderBy: { createdAt: "desc" },
          select: { extractedFields: true },
        });
        const fields = (extraction?.extractedFields ?? {}) as { expiryDate?: unknown };
        expiry = typeof fields.expiryDate === "string" ? fields.expiryDate : null;
        source = "read from the passport copy";
      }
      if (!passportValidityTooShort(expiry, input.travelDate)) continue;

      const open = await db.task.findFirst({
        where: { passengerId: traveller.passengerId, title: PASSPORT_VALIDITY_TASK_TITLE, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { id: true },
      });
      if (open) continue;

      await db.$transaction((tx) =>
        createTask(tx, {
          type: "MANUAL_VERIFICATION",
          priority: "HIGH",
          title: PASSPORT_VALIDITY_TASK_TITLE,
          reason: `${traveller.fullName}'s passport expires ${expiry} (${source}) — less than 6 months after the ${input.travelDate} travel date.`,
          entityType: "Lead",
          entityId: input.leadId,
          leadId: input.leadId,
          passengerId: traveller.passengerId,
          serviceType: "NEW_VISA",
        })
      );
    }
  } catch (error) {
    console.error("[new-visa/flag-passport-validity]", error);
  }
}
