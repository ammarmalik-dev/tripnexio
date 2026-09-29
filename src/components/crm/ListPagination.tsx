import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ListPaginationProps {
  /** Noun for the "Showing X–Y of N <noun>s" summary, e.g. "lead". */
  noun: string;
  page: number;
  pageSize: number;
  total: number;
  itemCount: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}

/** P21 item 4 — server-side pagination footer (Prev/Next + range summary) for CRM list screens. */
export function ListPagination({ noun, page, pageSize, total, itemCount, disabled, onPageChange }: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = total === 0 ? 0 : first + itemCount - 1;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={`${noun} list pagination`}>
      <p className="text-xs text-ink-tertiary" aria-live="polite">
        Showing {first}–{last} of {total} {noun}
        {total === 1 ? "" : "s"} · Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Prev
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
