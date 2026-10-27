import { describe, expect, it } from "vitest";
import { visaExtensionRequestSchema } from "@/lib/validation/visa-extension-schema";
import { visaChangeRequestSchema } from "@/lib/validation/visa-change-schema";
import { buildQuoteFormSchema } from "@/lib/validation/quotation-schema";
import { checkBase64Upload } from "@/lib/uploads/validate-upload";
import { DOCUMENT_UPLOAD_MAX_BYTES, DOCUMENT_UPLOAD_TYPES } from "@/lib/uploads/document-rules";
import { alignDeadlineToVerifiedExpiry, urgentDeadlineFromDetails } from "@/lib/visa-extension/rules";
import { tripFacts } from "@/lib/leads/trip-summary";
import { importantInfoFor } from "@/lib/outputs/output-notes";

// A tiny but real PDF / JPEG (magic bytes are what the server sniffs).
const PDF_BASE64 = Buffer.from("%PDF-1.4\n%test\n").toString("base64");
const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");

describe("Client doc 2026-10-27 (D1) — website Visa Extension / Visa Change submissions", () => {
  it("accepts a realistic Visa Extension payload with a PDF passport and a JPG visa copy", () => {
    const result = visaExtensionRequestSchema.safeParse({
      website: "",
      fullName: "Aisha Khan",
      mobile: "+971 50 123 4567",
      email: "aisha@example.com",
      passportNumber: "n1234567",
      visaExpiryDate: "2026-10-17",
      passportImageBase64: PDF_BASE64,
      passportImageMimeType: "application/pdf",
      visaImageBase64: JPEG_BASE64,
      visaImageMimeType: "image/jpeg",
      additionalApplicants: [
        {
          fullName: "Omar Khan",
          passportNumber: "N7654321",
          visaExpiryDate: "2026-10-17",
          passportImageBase64: JPEG_BASE64,
          passportImageMimeType: "image/png",
          visaImageBase64: PDF_BASE64,
          visaImageMimeType: "application/pdf",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a realistic two-passenger Visa Change payload with PDF visa copies", () => {
    const result = visaChangeRequestSchema.safeParse({
      website: "",
      changeType: "BORDER_EXIT",
      fullName: "Ravi Menon",
      passportNumber: "z1234567",
      visaLastDate: "2026-11-02",
      mobile: "+91 98765 43210",
      email: "ravi@example.com",
      nationalityId: "nat_in",
      paxType: "ADULT",
      visaImageBase64: PDF_BASE64,
      visaImageMimeType: "application/pdf",
      additionalPassengers: [
        { fullName: "Anu Menon", passportNumber: "Z7654321", visaLastDate: "2026-11-02", nationalityId: "nat_in", paxType: "CHILD", visaImageBase64: PDF_BASE64, visaImageMimeType: "application/pdf" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("the server upload check accepts the same PDF and JPG", () => {
    expect(checkBase64Upload(PDF_BASE64, DOCUMENT_UPLOAD_TYPES, DOCUMENT_UPLOAD_MAX_BYTES).ok).toBe(true);
    expect(checkBase64Upload(JPEG_BASE64, DOCUMENT_UPLOAD_TYPES, DOCUMENT_UPLOAD_MAX_BYTES).ok).toBe(true);
  });
});

describe("Client doc 2026-10-27 (D2/D7) — per-passenger quotation (Visa Extension / Visa Change)", () => {
  const paxCosting = [
    { passengerId: "p1", cost: 400, fine: 50, selling: 700 },
    { passengerId: "p2", cost: 400, fine: 0, selling: 650 },
  ];
  it("validates once the hidden quote-level vendor cost has its default", () => {
    expect(buildQuoteFormSchema(false).safeParse({ vendorId: "v1", vendorCost: 0, paxCosting }).success).toBe(true);
  });
  it("(root cause) failed when the vendor cost was left undefined", () => {
    const result = buildQuoteFormSchema(false).safeParse({ vendorId: "v1", paxCosting });
    expect(result.success).toBe(false);
  });
});

describe("Client doc 2026-10-27 (D3) — urgent payment deadline follows the staff-verified expiry", () => {
  it("moves a stored 19 Oct deadline to the verified 17 Oct, 6:00 PM UAE (14:00Z)", () => {
    const aligned = alignDeadlineToVerifiedExpiry({ day: "2026-10-19", at: "2026-10-19T14:00:00.000Z", nextDayHolidays: [] }, "2026-10-17");
    expect(aligned).toEqual({ day: "2026-10-17", at: "2026-10-17T14:00:00.000Z", nextDayHolidays: [] });
  });
  it("reads the block from lead details aligned to verifiedExpiryDate", () => {
    const deadline = urgentDeadlineFromDetails({
      eligibilityOutcome: "URGENT_TODAY",
      verifiedExpiryDate: "2026-10-17",
      visaExpiryDate: "2026-10-19",
      urgentDeadline: { day: "2026-10-19", at: "2026-10-19T14:00:00.000Z", nextDayHolidays: [{ country: "UAE", name: "Holiday" }] },
    });
    expect(deadline?.day).toBe("2026-10-17");
    expect(deadline?.at).toBe("2026-10-17T14:00:00.000Z");
  });
  it("leaves a correct block untouched", () => {
    const block = { day: "2026-10-17", at: "2026-10-17T14:00:00.000Z", nextDayHolidays: [] };
    expect(alignDeadlineToVerifiedExpiry(block, "2026-10-17")).toBe(block);
  });
});

describe("Client doc 2026-10-27 (D10/D12) — Visa Change messages", () => {
  it("request-received trip facts never name a destination country", () => {
    const facts = tripFacts({ serviceType: "VISA_CHANGE", paxCount: 2, travelDate: null, details: {}, country: { name: "United Arab Emirates" } });
    expect(facts.map((fact) => fact.label)).not.toContain("Destination");
    expect(JSON.stringify(facts)).not.toContain("United Arab Emirates");
  });
  it("the package email gets the Important Travel Instructions unless its body already has them", () => {
    const info = importantInfoFor("VC_PACKAGE_GENERATED", undefined, "Hi, your package is ready.");
    expect(info?.title).toBe("Important Travel Instructions");
    expect(info?.lines).toContain("Check your flight status and reach the airport at least 3 hours before departure.");
    expect(info?.lines).toContain("Please review all details carefully to help avoid last-minute issues.");
    expect(info?.closing).toBe("Have a safe and pleasant journey with TripNexio!");
    expect(importantInfoFor("VC_PACKAGE_GENERATED", undefined, "Important Travel Instructions:\n...")).toBeNull();
  });
});
