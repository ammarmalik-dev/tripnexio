"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface ReusableDocumentItem {
  id: string;
  type: string;
  ageInDays: number;
  reusable: boolean;
  bookingId: string | null;
}

/**
 * New_Visa.md §17 / Visa_Extension.md §16 (Step 21, audit §7.5) — "if a
 * passenger appears in a future booking... Use Existing / Upload New. Do
 * not automatically reuse without customer confirmation." Shown per
 * passenger on the Booking detail page; only ever lists documents NOT
 * already attached to this booking (nothing to offer otherwise) and only
 * ones still genuinely reusable (within the 3-month window, or a retained
 * Passport/Visa type past it) — an ineligible document is a dead end here,
 * staff use the existing "Add Document" flow to request a fresh upload
 * instead, same as if this prompt didn't exist at all.
 */
export function ReusableDocumentsPrompt({
  passengerId,
  bookingId,
  onReused,
}: {
  passengerId: string;
  bookingId: string;
  onReused: () => void;
}) {
  const [documents, setDocuments] = useState<ReusableDocumentItem[] | null>(null);
  const [reusingId, setReusingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<ReusableDocumentItem[]>(`/api/passengers/${passengerId}/reusable-documents?excludeBookingId=${bookingId}`)
      .then((result) => {
        if (!cancelled) setDocuments(result.filter((doc) => doc.reusable));
      })
      .catch(() => {
        // Non-critical — the section just doesn't render without this loaded.
      });
    return () => {
      cancelled = true;
    };
  }, [passengerId, bookingId]);

  const handleUseExisting = async (documentId: string) => {
    setReusingId(documentId);
    try {
      await postJson(`/api/documents/${documentId}/reuse`, { bookingId });
      toast.success("Existing document reused for this booking.");
      setDocuments((current) => current?.filter((doc) => doc.id !== documentId) ?? null);
      onReused();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't reuse that document. Please try again.");
    } finally {
      setReusingId(null);
    }
  };

  if (!documents || documents.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-glass-border bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        This passenger has existing documents from a prior request — confirm reuse, or upload new below.
      </p>
      {documents.map((doc) => (
        <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-ink-secondary">
            {doc.type} — uploaded {doc.ageInDays} day{doc.ageInDays === 1 ? "" : "s"} ago
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleUseExisting(doc.id)} isLoading={reusingId === doc.id}>
            Use Existing
          </Button>
        </div>
      ))}
    </div>
  );
}
