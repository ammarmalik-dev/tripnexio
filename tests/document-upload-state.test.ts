import { describe, expect, it } from "vitest";
import { countRequiredUploaded, isDocumentUploaded, uploadedDocumentSlots } from "../src/lib/documents/upload-state";
import { ocrKindForDocumentType } from "../src/lib/ocr/document-kind";
import { extractOcrFields, PASSPORT_FIELD_KEYS, TICKET_FIELD_KEYS, VISA_FIELD_KEYS } from "../src/lib/ocr/ocr-prompts";
import { documentSetEvent, isInternalDocumentEvent, isQuietDocumentMove } from "../src/lib/service-status/document-events";
import { mergeNationalityRequirements } from "../src/lib/checkout/required-documents";

describe("pay page upload state (client doc 2026-10-27, C8 / E3)", () => {
  it("a Pending slot, a missing or a rejected document is not uploaded", () => {
    expect(isDocumentUploaded({ status: "REQUIRED", fileUrl: null })).toBe(false);
    expect(isDocumentUploaded({ status: "MISSING", fileUrl: null })).toBe(false);
    expect(isDocumentUploaded({ status: "REJECTED", fileUrl: "/api/files/x" })).toBe(false);
    expect(isDocumentUploaded({ status: "RECEIVED", fileUrl: null })).toBe(false);
    expect(isDocumentUploaded({ status: "RECEIVED", fileUrl: "/api/files/x" })).toBe(true);
    expect(isDocumentUploaded({ status: "VERIFIED", fileUrl: null })).toBe(true);
  });

  it("counts only real files, per passenger — the 4-of-4 screenshot case reads 0 of 4", () => {
    const rows = ["Onward Ticket", "Passport Copy", "Return Ticket", "Visa Copy"].map((type) => ({ passengerId: "p1", type, status: "REQUIRED", fileUrl: null }));
    const uploaded = uploadedDocumentSlots(rows);
    expect(uploaded).toEqual([]);
    expect(countRequiredUploaded({ passengerIds: ["p1"], requiredTypes: rows.map((row) => row.type), uploaded })).toEqual({ uploaded: 0, required: 4 });

    const withOne = [...rows, { passengerId: "p1", type: "Passport Copy", status: "RECEIVED", fileUrl: "/api/files/a" }];
    expect(countRequiredUploaded({ passengerIds: ["p1"], requiredTypes: rows.map((row) => row.type), uploaded: uploadedDocumentSlots(withOne) })).toEqual({
      uploaded: 1,
      required: 4,
    });
  });

  it("another passenger's upload never fills this passenger's slot", () => {
    const uploaded = uploadedDocumentSlots([{ passengerId: "p2", type: "PASSPORT", status: "VERIFIED", fileUrl: "/f" }]);
    expect(countRequiredUploaded({ passengerIds: ["p1", "p2"], requiredTypes: ["PASSPORT"], uploaded })).toEqual({ uploaded: 1, required: 2 });
  });

  it("a passenger-specific document counts only for its passengers (D11)", () => {
    expect(
      countRequiredUploaded({ passengerIds: ["p1", "p2"], requiredTypes: ["PASSPORT", { type: "NOC", passengerIds: ["p2"] }], uploaded: [] })
    ).toEqual({ uploaded: 0, required: 3 });
  });
});

describe("OCR document kind and reply parsing (C9)", () => {
  it("picks the pipeline from the document type", () => {
    expect(ocrKindForDocumentType("PASSPORT")).toBe("PASSPORT");
    expect(ocrKindForDocumentType("Passport Front Page")).toBe("PASSPORT");
    expect(ocrKindForDocumentType("Passport Photograph")).toBeNull();
    expect(ocrKindForDocumentType("Passport Last Page")).toBeNull();
    expect(ocrKindForDocumentType("RETURN_TICKET")).toBe("TICKET");
    expect(ocrKindForDocumentType("ONWARD_TICKET")).toBe("TICKET");
    expect(ocrKindForDocumentType("VISA_COPY")).toBe("VISA");
    expect(ocrKindForDocumentType("PAN Card")).toBeNull();
  });

  it("reads the documented { fields } shape", () => {
    const result = extractOcrFields<Record<string, string>>('{"fields":{"pnr":"ABC123","airline":"Emirates"}}', TICKET_FIELD_KEYS);
    expect(result.fields).toEqual({ pnr: "ABC123", airline: "Emirates" });
  });

  it("reads fields given at the top level, in snake_case, in an array, or as numbers", () => {
    expect(extractOcrFields('{"visaNumber":"V1","passenger_name":"DEEPA V"}', VISA_FIELD_KEYS).fields).toEqual({ visaNumber: "V1", passengerName: "DEEPA V" });
    expect(extractOcrFields('[{"fields":{"flightNumber":"EK 500"}},{"fields":{"flightNumber":"EK 501"}}]', TICKET_FIELD_KEYS).fields).toEqual({
      flightNumber: "EK 500",
    });
    expect(extractOcrFields('{"fields":[{"ticketNumber":1761234567890}]}', TICKET_FIELD_KEYS).fields).toEqual({ ticketNumber: "1761234567890" });
  });

  it("drops empty / null / unknown values and survives a fenced or non-JSON reply", () => {
    expect(extractOcrFields('```json\n{"fields":{"pnr":"","airline":null,"seat":"12A","arrivalAirport":"DXB"}}\n```', TICKET_FIELD_KEYS).fields).toEqual({
      arrivalAirport: "DXB",
    });
    expect(extractOcrFields("sorry, can't read this", TICKET_FIELD_KEYS)).toEqual({ mrzRaw: null, fields: {} });
  });

  it("keeps the passport MRZ", () => {
    const result = extractOcrFields('{"mrzRaw":"P<UTO\\nL89","fields":{"sex":"F"}}', PASSPORT_FIELD_KEYS);
    expect(result.mrzRaw).toBe("P<UTO\nL89");
    expect(result.fields).toEqual({ sex: "F" });
  });
});

describe("document notifications (C11)", () => {
  it("maps the document set to one stage event", () => {
    expect(documentSetEvent(["RECEIVED", "REQUIRED"])).toBe("DOCUMENTS_RECEIVED");
    expect(documentSetEvent(["VERIFIED", "REJECTED"])).toBe("DOCUMENTS_REJECTED");
    expect(documentSetEvent(["VERIFIED", "REQUIRED"])).toBe("DOCUMENTS_REQUESTED");
    expect(documentSetEvent(["VERIFIED", "VERIFIED"])).toBe("DOCUMENTS_VALIDATED");
  });

  it("uploads are internal only; validated / rejected / required reach the customer", () => {
    expect(isInternalDocumentEvent("DOCUMENTS_RECEIVED")).toBe(true);
    expect(isInternalDocumentEvent("ADDITIONAL_DOCUMENTS_RECEIVED")).toBe(true);
    expect(isInternalDocumentEvent("DOCUMENTS_VALIDATED")).toBe(false);
    expect(isInternalDocumentEvent("DOCUMENTS_REJECTED")).toBe(false);
    expect(isInternalDocumentEvent("DOCUMENTS_REQUESTED")).toBe(false);
  });
});

describe("quiet document moves (C11)", () => {
  it("validating part of a set still being uploaded sends nothing; a missing flag or a later request does", () => {
    expect(isQuietDocumentMove("DOCUMENTS_REQUESTED", "DOCUMENTS_RECEIVED", ["VERIFIED", "REQUIRED"])).toBe(true);
    expect(isQuietDocumentMove("DOCUMENTS_REQUESTED", "DOCUMENTS_RECEIVED", ["VERIFIED", "MISSING"])).toBe(false);
    expect(isQuietDocumentMove("DOCUMENTS_REQUESTED", "DOCUMENTS_VALIDATED", ["VERIFIED", "REQUIRED"])).toBe(false);
    expect(isQuietDocumentMove("DOCUMENTS_RECEIVED", "DOCUMENTS_REQUESTED", ["RECEIVED"])).toBe(true);
    expect(isQuietDocumentMove("DOCUMENTS_VALIDATED", "DOCUMENTS_RECEIVED", ["VERIFIED"])).toBe(false);
    expect(isQuietDocumentMove("DOCUMENTS_REJECTED", "DOCUMENTS_RECEIVED", ["VERIFIED", "REJECTED"])).toBe(false);
  });
});

describe("Visa Change documents per nationality (D11)", () => {
  const passengers = [
    { id: "p1", nationalityId: "IN", nationality: "India" },
    { id: "p2", nationalityId: "PK", nationality: "Pakistan" },
  ];

  it("a nationality row applies only to that nationality's passengers; an all-nationalities row to everyone", () => {
    const result = mergeNationalityRequirements(
      [
        { documentName: "Passport Copy", required: true, nationalityId: null, nationality: null },
        { documentName: "Police Clearance", required: true, nationalityId: "PK", nationality: null },
        { documentName: "Bank Statement", required: false, nationalityId: null, nationality: "india" },
        { documentName: "Sponsor Letter", required: true, nationalityId: "BD", nationality: null },
      ],
      passengers
    );
    expect(result).toEqual([
      { type: "Passport Copy", label: "Passport Copy", required: true },
      { type: "Police Clearance", label: "Police Clearance", required: true, passengerIds: ["p2"] },
      { type: "Bank Statement", label: "Bank Statement", required: false, passengerIds: ["p1"] },
    ]);
  });

  it("the same document for everyone and for one nationality is asked of everyone", () => {
    const result = mergeNationalityRequirements(
      [
        { documentName: "Photo", required: false, nationalityId: "IN", nationality: null },
        { documentName: "Photo", required: true, nationalityId: null, nationality: null },
      ],
      passengers
    );
    expect(result).toEqual([{ type: "Photo", label: "Photo", required: true }]);
  });
});
