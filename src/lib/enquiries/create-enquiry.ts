import { db } from "../db";
import { writeAudit } from "../audit/log";
import { findCustomerByMobile } from "../customers/find-by-mobile";
import { notifyStaff } from "../staff-notifications/notify";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { ENQUIRY_CATEGORY_LABELS, enquiryReference } from "./labels";
import type { EnquiryCategory } from "../../generated/prisma/enums";

export interface CreateEnquiryInput {
  category: EnquiryCategory;
  fullName: string;
  mobile: string;
  email: string;
  subject: string;
  message: string;
  bookingReference?: string | null;
}

/**
 * A Contact-form submission becomes an Enquiry, not a lead. It is linked to
 * an existing customer when the mobile (then email) matches, but never
 * creates a customer. A COMPLAINT is escalated at once: marked escalated
 * and sent to everyone who can reassign leads (managers) plus admins.
 * Notifications run after the write and never throw.
 */
export async function createEnquiry(input: CreateEnquiryInput): Promise<{ id: string; reference: string }> {
  const isComplaint = input.category === "COMPLAINT";
  const existing =
    (await findCustomerByMobile(db, input.mobile)) ?? (input.email ? await db.customer.findUnique({ where: { email: input.email } }) : null);

  const enquiry = await db.$transaction(async (tx) => {
    const created = await tx.enquiry.create({
      data: {
        reference: `TMP-${crypto.randomUUID()}`,
        category: input.category,
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email,
        bookingReference: input.bookingReference || null,
        subject: input.subject,
        message: input.message,
        customerId: existing?.id ?? null,
        escalatedAt: isComplaint ? new Date() : null,
      },
    });
    const withReference = await tx.enquiry.update({
      where: { id: created.id },
      data: { reference: enquiryReference(created.id, input.category) },
    });
    await writeAudit(tx, {
      entityType: "Enquiry",
      entityId: created.id,
      action: "CREATE",
      note: `${ENQUIRY_CATEGORY_LABELS[input.category]} received via the Contact form${existing ? ` from existing customer ${existing.id}` : ""}${isComplaint ? "; escalated" : ""}`,
    });
    return withReference;
  });

  await notifyStaff(
    isComplaint
      ? {
          type: "COMPLAINT",
          title: `Complaint ${enquiry.reference}: ${input.subject}`,
          body: `${input.fullName} raised a complaint via the Contact form. It has been escalated.`,
          link: `/crm/enquiries/${enquiry.id}`,
          entityType: "Enquiry",
          entityId: enquiry.id,
          recipients: { permission: "leads.reassign" },
        }
      : {
          type: "NEW_ENQUIRY",
          title: `New ${ENQUIRY_CATEGORY_LABELS[input.category].toLowerCase()} ${enquiry.reference}`,
          body: `${input.fullName}: ${input.subject}`,
          link: `/crm/enquiries/${enquiry.id}`,
          entityType: "Enquiry",
          entityId: enquiry.id,
          recipients: { permission: "leads.view" },
        }
  );

  await notifyCustomer({
    event: isComplaint ? NOTIFICATION_EVENTS.COMPLAINT_RECEIVED : NOTIFICATION_EVENTS.ENQUIRY_RECEIVED,
    emailTo: input.email,
    whatsappTo: null,
    variables: {
      customerName: input.fullName,
      enquiryReference: enquiry.reference,
      subject: input.subject,
      category: ENQUIRY_CATEGORY_LABELS[input.category],
    },
    auditTarget: { entityType: "Enquiry", entityId: enquiry.id },
  });

  return { id: enquiry.id, reference: enquiry.reference };
}
