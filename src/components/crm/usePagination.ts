"use client";

import { useMemo, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

/**
 * Page + page-size state for a server-paginated list. Send `page` and
 * `pageSize` to the API, call `resetPage()` whenever a filter changes, and
 * spread `paginationHandlers` into <ListPagination>. Changing the page size
 * goes back to page 1.
 */
export function usePaginationState(initialPageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const setPageSize = (next: number) => {
    setPageSizeState(next);
    setPage(1);
  };

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    resetPage: () => setPage(1),
    paginationHandlers: { onPageChange: setPage, onPageSizeChange: setPageSize },
  };
}

/**
 * Client-side pagination for a list that is already fully loaded (masters,
 * config screens, small reports). Returns the rows for the current page and
 * the props for <ListPagination>. The page is clamped when the list shrinks
 * (after a filter or a delete), so it never shows an empty page.
 */
export function useClientPagination<T>(items: readonly T[], initialPageSize: number = DEFAULT_PAGE_SIZE) {
  const [requestedPage, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  return {
    pageItems,
    page,
    setPage,
    resetPage: () => setPage(1),
    paginationProps: {
      page,
      pageSize,
      total: items.length,
      itemCount: pageItems.length,
      onPageChange: setPage,
      onPageSizeChange: (next: number) => {
        setPageSizeState(next);
        setPage(1);
      },
    },
  };
}
