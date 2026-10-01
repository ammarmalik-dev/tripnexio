import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS, pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/cn";

interface ListPaginationProps {
  /** Noun for the "Showing X–Y of N <noun>s" summary, e.g. "lead". */
  noun: string;
  page: number;
  pageSize: number;
  total: number;
  itemCount: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  /** Shows the "Rows per page" dropdown when set. Changing it should go back to page 1 (the pagination hooks do). */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
}

const pagerButton =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-transparent px-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:border-hairline hover:bg-surface-1 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40";

/**
 * Pagination footer for every CRM/Admin list: range summary, an optional
 * rows-per-page dropdown, and First / Prev / numbered pages / Next / Last.
 * Works for server-paginated lists (pass the API's total) and client-side
 * ones (useClientPagination). Renders nothing for an empty list.
 */
export function ListPagination({
  noun,
  page,
  pageSize,
  total,
  itemCount,
  disabled,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}: ListPaginationProps) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, first + itemCount - 1);
  const plural = total === 1 ? noun : `${noun}s`;
  const selectId = `page-size-${noun.replace(/\W+/g, "-")}`;

  return (
    <nav
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      aria-label={`${noun} list pagination`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-tertiary">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor={selectId}>Rows per page</label>
            <select
              id={selectId}
              value={pageSize}
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 rounded-lg border border-hairline bg-surface-1 px-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/25"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <p aria-live="polite">
          Showing{" "}
          <span className="font-medium text-ink-secondary">
            {first}–{last}
          </span>{" "}
          of <span className="font-medium text-ink-secondary">{total}</span> {plural}
        </p>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={cn(pagerButton, "hidden sm:inline-flex")}
            onClick={() => onPageChange(1)}
            disabled={disabled || page <= 1}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={pagerButton}
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pageWindow(page, totalPages).map((entry, index) =>
            entry === "gap" ? (
              <span key={`gap-${index}`} className="px-1 text-sm text-ink-muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                disabled={disabled}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                className={cn(
                  pagerButton,
                  entry === page &&
                    "border-accent/30 bg-accent/10 text-accent-on-light hover:border-accent/30 hover:bg-accent/10 hover:text-accent-on-light"
                )}
              >
                {entry}
              </button>
            )
          )}
          <button
            type="button"
            className={pagerButton}
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn(pagerButton, "hidden sm:inline-flex")}
            onClick={() => onPageChange(totalPages)}
            disabled={disabled || page >= totalPages}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
