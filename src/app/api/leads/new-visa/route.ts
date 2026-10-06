import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { getActiveVisaTypes } from "@/lib/visa-types/active-visa-types";
import { db } from "@/lib/db";
import { allowedProcessingTypes, productLabel } from "@/lib/new-visa/products";
import { getNewVisaTravelRules } from "@/lib/new-visa/travel-rules";
import { getWorkingCalendar } from "@/lib/calendar/get-working-calendar";
import { workingDaysBetween } from "@/lib/calendar/working-calendar";
import { flagShortPassportValidity } from "@/lib/new-visa/flag-passport-validity";
import { rejectInvalidUploads, ALLOWED_UPLOAD_MIME_TYPES as IMAGE_OR_PDF } from "@/lib/uploads/validate-upload";
import { newVisaRequestSchema } from "@/lib/validation/new-visa-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { handleOptionalPassportUpload } from "@/lib/ocr/handle-passport-upload";
import { findNewVisaTravellerIssues } from "@/lib/validation/new-visa-schema";
import { computeNewVisaPaxType } from "@/lib/leads/pax-type";
import { computeNewVisaPrice } from "@/lib/new-visa/pricing";
import { createAutoCheckout } from "@/lib/checkout/create-auto-checkout";
import { describeError } from "@/lib/api/describe-error";
import { getProtectionPlanOffer } from "@/lib/protection-plan/country-offer";
import { getProcessingTypeOptions } from "@/lib/processing-types/get";

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "leads-new-visa", LEAD_INTAKE_RATE_LIMIT, "Too many requests. Please try again later.");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = newVisaRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (isHoneypotFilled(parsed.data.website)) {
    return jsonError(400, "Invalid submission.");
  }

  const uploadError = rejectInvalidUploads([parsed.data.passportImageBase64, ...parsed.data.additionalTravellers.map((traveller) => traveller.passportImageBase64)], IMAGE_OR_PDF);
  if (uploadError) return uploadError;

  const {
    fullName,
    mobile,
    email,
    destinationCountry,
    visaType,
    newVisaConfigId,
    travelDate,
    processingType,
    passportImageBase64,
    passportImageMimeType,
    protectionPlanTravellers,
    protectionPlanTermsAccepted,
    passportNumber,
    dob,
    occupation,
    guardianFullName,
    guardianPassportNumber,
    guardianRelationship,
    additionalTravellers,
  } = parsed.data;

  const travellers = [
    {
      fullName,
      passportNumber,
      passportExpiry: parsed.data.passportExpiry,
      dob,
      occupation,
      guardianFullName,
      guardianPassportNumber,
      guardianRelationship,
      passportImageBase64,
      passportImageMimeType,
    },
    ...additionalTravellers,
  ];

  // Handover doc: every traveller needs a passport copy, and anyone under 18
  // needs guardian details — enforced server-side, not just by the form.
  const travellerIssues = findNewVisaTravellerIssues({
    travelDate,
    dob,
    guardianFullName,
    guardianPassportNumber,
    guardianRelationship,
    passportImageBase64,
    additionalTravellers,
  });
  const missingMime = travellers.some((t) => t.passportImageBase64 && !t.passportImageMimeType);
  if (travellerIssues.length > 0 || missingMime) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of travellerIssues) fieldErrors[issue.path] = [issue.message];
    return jsonError(400, "Please complete every traveller's details.", fieldErrors);
  }

  // P12 — Protection Plan per traveller: only where Admin enabled it for this
  // destination, only for real travellers, and never without the customer
  // accepting the full terms (New_Visa.md §8: "without agreement the
  // Protection Plan cannot be purchased").
  const chosenPlanIndexes = [...new Set(protectionPlanTravellers)];
  const protectionPlanOffer = chosenPlanIndexes.length > 0 ? await getProtectionPlanOffer(destinationCountry) : null;
  if (chosenPlanIndexes.length > 0) {
    if (!protectionPlanOffer) {
      return jsonError(400, "Protection Plan isn't available for this destination.", { protectionPlanTravellers: ["Not available for this destination."] });
    }
    if (chosenPlanIndexes.some((index) => index >= travellers.length)) {
      return jsonError(400, "Select Protection Plan only for travellers on this application.", { protectionPlanTravellers: ["Invalid traveller."] });
    }
    if (!protectionPlanTermsAccepted) {
      return jsonError(400, "Accept the Protection Plan terms, or leave Protection Plan unselected.", {
        protectionPlanTermsAccepted: ["Accept the terms first."],
      });
    }
  }

  // Visa type comes from the Admin master for this destination (P06): never
  // trust the client's own `visaTypeRequired` flag — re-derive it here.
  const visaTypeOptions = await getActiveVisaTypes(destinationCountry);
  const pickedVisaType = visaType ? visaTypeOptions.find((option) => option.id === visaType) : undefined;
  if (visaType ? !pickedVisaType : visaTypeOptions.length > 0) {
    return jsonError(400, "Select a visa type.", { visaType: ["Select a visa type"] });
  }

  // P10 — the product (stay duration + entry type) must be an active one of
  // this destination, required whenever the destination has any.
  const products = await db.newVisaCountryConfig.findMany({
    where: { active: true, country: { active: true, code: { equals: destinationCountry, mode: "insensitive" } } },
    select: { id: true, stayDays: true, duration: true, entryKind: true, entryType: true },
  });
  const product = newVisaConfigId ? products.find((option) => option.id === newVisaConfigId) : undefined;
  if (newVisaConfigId ? !product : products.length > 0) {
    return jsonError(400, "Select a visa option.", { newVisaConfigId: ["Select a visa option"] });
  }

  // P23 — the processing type must be an active option in the Admin master
  // (a code Admin disabled is hidden from the form and rejected here too).
  const processingOption = (await getProcessingTypeOptions("NEW_VISA")).find((option) => option.code === processingType);
  if (!processingOption) {
    return jsonError(400, "That processing type isn't available.", { processingType: ["Select an available processing type."] });
  }

  // P10 — minimum UAE working days before travel for the chosen processing type.
  const travelRules = await getNewVisaTravelRules();
  const workingDays = workingDaysBetween(travelDate, new Date(), await getWorkingCalendar("UAE"));
  if (!allowedProcessingTypes(workingDays, travelRules).includes(processingType)) {
    const needed = processingType === "urgent" ? travelRules.minTravelDaysExpress : travelRules.minTravelDaysNormal;
    return jsonError(400, `${processingOption.label} processing needs your travel date at least ${needed} working days away.`, {
      processingType: ["This processing type can't meet your travel date."],
    });
  }

  const paxTypes = travellers.map((t) => computeNewVisaPaxType(t.dob, travelDate));

  try {
    const result = await createLeadFromSubmission({
      serviceType: "NEW_VISA",
      contact: { fullName, mobile, email },
      passengers: travellers.map((t, index) => ({
        fullName: t.fullName,
        passportNumber: t.passportNumber,
        dob: t.dob,
        paxType: paxTypes[index],
      })),
      details: {
        destinationCountry,
        ...(pickedVisaType ? { visaType: pickedVisaType.name, visaTypeId: pickedVisaType.id } : {}),
        ...(product ? { newVisaConfigId: product.id, visaOption: productLabel(product) } : {}),
        travelers: String(travellers.length),
        travelDate,
        // Applicant-wise record, in the same order as details.passengerIds.
        applicants: travellers.map((t) => ({
          fullName: t.fullName,
          passportNumber: t.passportNumber,
          ...(t.passportExpiry ? { passportExpiry: t.passportExpiry } : {}),
          occupation: t.occupation,
          ...(t.guardianFullName
            ? {
                guardian: {
                  fullName: t.guardianFullName,
                  passportNumber: t.guardianPassportNumber,
                  relationship: t.guardianRelationship,
                },
              }
            : {}),
        })),
        processingType,
      },
    });

    // P12 — the chosen travellers' passenger ids and the terms acceptance go
    // on the lead; the booking created next turns them into TERMS_ACCEPTED
    // plans whose price is added to the payment as a "Protection Plan" line.
    if (protectionPlanOffer && chosenPlanIndexes.length > 0) {
      const lead = await db.lead.findUnique({ where: { id: result.leadId }, select: { details: true } });
      await db.lead.update({
        where: { id: result.leadId },
        data: {
          details: {
            ...((lead?.details ?? {}) as Record<string, unknown>),
            protectionPlanPassengerIds: chosenPlanIndexes.map((index) => result.passengerIds[index]),
            protectionPlanTermsAcceptedAt: new Date().toISOString(),
            protectionPlanPrice: protectionPlanOffer.price,
          },
        },
      });
    }

    // Never throws (see handleOptionalPassportUpload); passengerIds follow the travellers' order.
    await Promise.all(
      travellers.map((traveller, index) =>
        handleOptionalPassportUpload({
          passengerId: result.passengerIds[index],
          imageBase64: traveller.passportImageBase64,
          mimeType: traveller.passportImageMimeType,
        })
      )
    );

    // P10 — passport expiring within 6 months of travel (entered or read by
    // OCR just above): a staff task, never a block. Never throws.
    await flagShortPassportValidity({
      leadId: result.leadId,
      travelDate,
      travellers: travellers.map((traveller, index) => ({
        passengerId: result.passengerIds[index],
        fullName: traveller.fullName,
        enteredExpiry: traveller.passportExpiry,
      })),
    });

    // Pay right after the form (client answer, 2026-09-23) — the price is
    // Admin-configured (country + Normal/Express, per-traveller Adult/
    // Child/Infant), computed here rather than trusted from the client. A
    // failure (including no configured rate) must never lose the Lead —
    // staff can still build a manual quotation and send a payment link.
    let payToken: string | undefined;
    try {
      const price = await computeNewVisaPrice({
        countryCode: destinationCountry,
        newVisaConfigId: product?.id ?? null,
        processingType,
        travellerPaxTypes: paxTypes,
      });
      if (price) {
        const checkout = await createAutoCheckout({
          leadId: result.leadId,
          serviceType: "NEW_VISA",
          totalPrice: price.total,
          vendorCost: price.vendorCost,
          invoiceLines: price.invoiceLines,
        });
        payToken = checkout?.token;
      } else {
        console.warn(`[api/leads/new-visa] no PricingRule configured for country=${destinationCountry} processingType=${processingType}`);
      }
    } catch (checkoutError) {
      console.error("[api/leads/new-visa] auto checkout failed", describeError(checkoutError));
    }

    return jsonSuccess({ ...result, payToken }, 201);
  } catch (error) {
    console.error("[api/leads/new-visa]", describeError(error));
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
