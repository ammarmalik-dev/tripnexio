import { describe, expect, it } from "vitest";
import { safeDownloadName, sniffKnowledgeDocument } from "../src/lib/knowledge/document-files";

describe("Knowledge Centre documents (client doc 16 Nov, L4)", () => {
  it("accepts PDF, DOC and DOCX by their bytes", () => {
    expect(sniffKnowledgeDocument(Buffer.from("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(sniffKnowledgeDocument(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]))).toBe("application/msword");
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....word/document.xml....")]);
    expect(sniffKnowledgeDocument(docx)).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("rejects other files, including a zip that isn't a Word document and a renamed image", () => {
    expect(sniffKnowledgeDocument(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("xl/workbook.xml")]))).toBeNull();
    expect(sniffKnowledgeDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
    expect(sniffKnowledgeDocument(Buffer.from("<html><script>"))).toBeNull();
    expect(sniffKnowledgeDocument(Buffer.alloc(0))).toBeNull();
  });

  it("keeps download names header-safe", () => {
    expect(safeDownloadName('SOP "visa"\r\n.pdf')).toBe("SOP _visa_.pdf");
    expect(safeDownloadName("")).toBe("document");
  });
});
