"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface MasterColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/**
 * Client corrections 2026-10-05 — the standard Master Data list: a compact
 * table with the identifying fields, and "Edit" opens that one record's
 * editor (its existing card: fields, Save, Enable/Disable) right below the
 * row. Only one record is open at a time, so the page never shows every
 * record's full form at once.
 */
export function MasterTable<T extends { id: string; active: boolean }>({
  rows,
  columns,
  renderEditor,
  minWidth = 720,
}: {
  rows: T[];
  columns: MasterColumn<T>[];
  renderEditor: (row: T) => ReactNode;
  minWidth?: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const span = columns.length + 2;

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
            {columns.map((column) => (
              <th key={column.header} className={cn("px-4 py-3", column.className)}>
                {column.header}
              </th>
            ))}
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = openId === row.id;
            return (
              <Fragment key={row.id}>
                <tr className={cn("border-b border-hairline last:border-b-0", open ? "bg-ink-accent/[0.04]" : "hover:bg-ink-primary/[0.02]")}>
                  {columns.map((column) => (
                    <td key={column.header} className={cn("px-4 py-3 text-ink-secondary", column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", row.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
                      {row.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setOpenId(open ? null : row.id)} aria-expanded={open}>
                      {open ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
                      {open ? "Close" : "Edit"}
                    </Button>
                  </td>
                </tr>
                {open ? (
                  <tr className="border-b border-hairline bg-surface-2/60">
                    <td colSpan={span} className="p-4">
                      {renderEditor(row)}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
