import { CheckCircle2, TriangleAlert } from "lucide-react";

export interface OcrCrossCheckData {
  status: "VALIDATED" | "MISMATCH" | "UNCHECKED";
  checked: string[];
  mismatches: { field: string; entered: string; document: string }[];
}

/**
 * Client doc 2026-10-15 (J4) — the OCR reading checked against what the customer entered: "Data validated"
 * when every compared field matches, "Manual validation required" with the differences otherwise.
 */
export function OcrCrossCheck({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return null;
  const check = value as OcrCrossCheckData;
  if (check.status === "VALIDATED") {
    return (
      <p className="flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Data validated — {check.checked.join(", ")} match the entered details.
      </p>
    );
  }
  if (check.status === "MISMATCH") {
    return (
      <div className="flex flex-col gap-1 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
        <p className="flex items-center gap-1.5 font-semibold">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Manual validation required
        </p>
        <ul className="ml-5 list-disc">
          {check.mismatches.map((mismatch) => (
            <li key={mismatch.field}>
              {mismatch.field}: entered <span className="font-semibold">{mismatch.entered}</span>, document shows{" "}
              <span className="font-semibold">{mismatch.document}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <p className="text-xs text-ink-tertiary">Nothing on this document to compare with the entered details — check it manually.</p>;
}
