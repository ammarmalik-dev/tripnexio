"use client";

import { useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/forms/Textarea";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface ImportResult {
  created: number;
  updated: number;
  errorCount: number;
  errors: { line: number; message: string }[];
}

const CSV_EXAMPLE = "iata_code,airport_name,city,country\n<IATA code>,<airport name>,<city>,<country code or name>";

/**
 * Bulk-load airports from a CSV the client supplies (e.g. an export from
 * their IATA/OpenFlights source). Nothing is pre-filled or invented — rows
 * come only from the file the admin pastes or uploads.
 */
export function AirportImportPanel() {
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      const data = await postJson<ImportResult>("/api/admin/airports/import", { csv });
      setResult(data);
      toast.success(`Import finished: ${data.created} added, ${data.updated} updated.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't import airports. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Bulk Import (CSV)</h2>
      <p className="text-xs text-ink-tertiary">
        Columns: <code>iata_code, airport_name, city, country</code>. Existing codes are updated, new ones are added. The country
        must already exist under Admin → Countries (matched by code or name).
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        className="text-sm text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-primary"
      />
      <Textarea
        label="Or paste CSV"
        name="airport-csv"
        rows={5}
        placeholder={CSV_EXAMPLE}
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleImport()} isLoading={importing} disabled={!csv.trim()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Import Airports
        </Button>
      </div>
      {result ? (
        <div className="rounded-lg bg-surface-2 p-4 text-sm text-ink-secondary">
          <p>
            {result.created} added · {result.updated} updated · {result.errorCount} row error(s).
          </p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-error">
              {result.errors.map((rowError, index) => (
                <li key={index}>
                  Line {rowError.line}: {rowError.message}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="mt-3 text-xs font-medium text-ink-accent underline"
            onClick={() => window.location.reload()}
          >
            Reload airport list
          </button>
        </div>
      ) : null}
    </section>
  );
}
