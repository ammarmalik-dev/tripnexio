import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildXlsx } from "../src/lib/excel/xlsx";

describe("buildXlsx (N11–N13)", () => {
  it("writes one worksheet per tab with escaped text and numbers", () => {
    const files = unzipSync(
      buildXlsx([
        { name: "Leads", rows: [["Ref", "Amount"], ["A&B <x>", 12.5]] },
        { name: "Leads", rows: [["dup name"]] },
      ])
    );
    expect(Object.keys(files)).toContain("xl/worksheets/sheet2.xml");
    const sheet1 = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet1).toContain("A&amp;B &lt;x&gt;");
    expect(sheet1).toContain("<v>12.5</v>");
    expect(strFromU8(files["xl/workbook.xml"])).toContain('name="Leads (2)"');
  });
});
