"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Clock, XCircle, Upload, FileCheck2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { toast } from "@/components/ui/Toaster";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { formatRupees } from "@/lib/return-ticket/use-return-ticket-destinations";
import { siteConfig } from "@/lib/site-config";
import { utilityLinks } from "@/lib/nav-config";
import { TermsAgreement } from "@/components/terms/TermsAgreement";
import { PostTicketOfferCard } from "@/components/cross-sell/PostTicketOfferCard";
import { SpecialFareAlternativeCard, type SpecialFareAlternativeView } from "./SpecialFareAlternativeCard";

interface CheckoutView {
  serviceType: string;
  leadReference: string;
  bookingId: string | null;
  payment: {
    status: "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED";
    description: string | null;
    /** Service fee only — excludes the Protection Plan line. */
    amount: number;
    protectionPlan: number;
    gst: number;
    gatewayFee: number;
    discount: number;
    total: number;
    paymentLink: string | null;
    linkExpiresAt: string | null;
  } | null;
  quotationExpired: boolean;
  termsAccepted: boolean;
  terms: { title: string; body: string; version: number } | null;
  demoGateway: boolean;
  applicants: { id: string; fullName: string }[];
  documentTypes: { type: string; label: string; required: boolean }[];
  /** P11 — extra documents staff asked a passenger for. */
  requestedDocuments: { passengerId: string; type: string; reason: string; status: string }[];
  /** P10 — earlier uploads the customer may choose to reuse ("Use existing"). */
  reusable: { passengerId: string; type: string; sourceDocumentId: string; uploadedAt: string }[];
  documents: { passengerId: string; type: string; status: string }[];
  /** P15 — show the post-ticket Return Ticket / OTB offer. */
  postTicketOffer: boolean;
  /** P16 — Special Fare alternative offered after the paid flight became unavailable. */
  specialFareAlternative: SpecialFareAlternativeView | null;
  /** P17 — Return Ticket cancellation terms shown before payment. */
  returnTicketCancellation: { fee: number | null } | null;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
const MAX_BYTES = 3 * 1024 * 1024;
const POLL_MS = 4000;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="text-sm text-ink-tertiary">{label}</span>
      <span className={strong ? "text-base font-semibold text-ink-heading" : "text-sm font-medium text-ink-primary"}>{value}</span>
    </div>
  );
}

function DocumentSlot({
  label,
  uploaded,
  uploading,
  onFile,
  reuse,
}: {
  label: string;
  uploaded: boolean;
  uploading: boolean;
  onFile: (file: File) => void;
  /** P10 — when set, offer "Use existing" next to "Upload new"; nothing is reused without this click. */
  reuse?: { uploadedAt: string; onUse: () => void };
}) {
  const [error, setError] = useState<string | null>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return setError("Use a JPEG, PNG, GIF, WebP image or a PDF.");
    if (file.size > MAX_BYTES) return setError("That file is too large (3MB max).");
    setError(null);
    onFile(file);
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-ink-primary">
          {uploaded ? (
            <FileCheck2 className="h-4 w-4 text-success" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
          )}
          {label}
          {uploaded ? <span className="text-xs text-success">Uploaded</span> : null}
        </span>
        <span className="flex items-center gap-2">
          {reuse && !uploaded ? (
            <button
              type="button"
              onClick={reuse.onUse}
              disabled={uploading}
              className="rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-ink-accent ring-1 ring-accent/30 hover:bg-accent/20"
            >
              Use existing
            </button>
          ) : null}
          <label className="cursor-pointer rounded-md bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink-accent ring-1 ring-hairline hover:bg-surface-3">
            {uploading ? "Uploading..." : uploaded ? "Replace" : reuse ? "Upload new" : "Choose file"}
            <input type="file" accept={ALLOWED_TYPES.join(",")} className="sr-only" onChange={handleChange} disabled={uploading} />
          </label>
        </span>
      </div>
      {reuse && !uploaded ? (
        <span className="text-xs text-ink-tertiary">
          We have the copy you uploaded on {new Date(reuse.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
        </span>
      ) : null}
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/** Guest customer page: pay for a Return Ticket / OTB request, then upload the documents it needs. */
export function CheckoutPanel({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [view, setView] = useState<CheckoutView | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [paying, setPaying] = useState(false);
  const [awaitingGateway, setAwaitingGateway] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<CheckoutView>(`/api/pay/${token}`);
        if (cancelled) return;
        setView(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this page. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, reloadNonce]);

  const refresh = useCallback(() => setReloadNonce((n) => n + 1), []);

  // After sending the customer to the real gateway, watch for the webhook to confirm the payment.
  useEffect(() => {
    if (!awaitingGateway) return;
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [awaitingGateway, refresh]);

  const paymentStatus = view?.payment?.status;
  useEffect(() => {
    if (paymentStatus && paymentStatus !== "PENDING" && awaitingGateway) {
      const timer = setTimeout(() => setAwaitingGateway(false), 0);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, awaitingGateway]);

  if (state === "loading") return <Skeleton className="h-96 w-full" />;
  if (state === "error" || !view) {
    return (
      <ErrorState
        title="We couldn't open this page"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  const payment = view.payment;

  const handleDemoPay = async () => {
    setPaying(true);
    try {
      await postJson(`/api/pay/${token}/mock-pay`, {});
      toast.success("Payment received.");
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Payment didn't go through. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const handleUpload = async (passengerId: string, type: string, file: File) => {
    const key = `${passengerId}:${type}`;
    setUploadingKey(key);
    try {
      const fileBase64 = await fileToBase64(file);
      await postJson(`/api/pay/${token}/documents`, { passengerId, type, fileBase64, mimeType: file.type });
      toast.success("Document uploaded.");
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload that file. Please try again.");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleReuse = async (passengerId: string, type: string, sourceDocumentId: string) => {
    setUploadingKey(`${passengerId}:${type}`);
    try {
      await postJson(`/api/pay/${token}/documents/reuse`, { passengerId, type, sourceDocumentId });
      toast.success("Document added.");
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't use that document. Please upload a new one.");
    } finally {
      setUploadingKey(null);
    }
  };

  const hasDocument = (passengerId: string, type: string) =>
    view.documents.some((document) => document.passengerId === passengerId && document.type === type);
  const requiredTypes = view.documentTypes.filter((doc) => doc.required);
  const requiredCount = view.applicants.length * requiredTypes.length;
  const uploadedCount = view.applicants.reduce(
    (total, applicant) => total + requiredTypes.filter((doc) => hasDocument(applicant.id, doc.type)).length,
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium tracking-wide text-ink-accent">Reference {view.leadReference}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-heading">
          {payment?.status === "SUCCESS" ? "Payment received" : "Complete your payment"}
        </h1>
      </div>

      {view.specialFareAlternative ? <SpecialFareAlternativeCard token={token} offer={view.specialFareAlternative} onChanged={refresh} /> : null}

      {!payment ? (
        <ErrorState
          title="No payment is set up for this request"
          description={`Our team will contact you with a payment link. You can also message us on WhatsApp.`}
          action={<ButtonLink href={siteConfig.contact.whatsappHref}>WhatsApp Support</ButtonLink>}
        />
      ) : (
        <div className="rounded-xl border border-hairline bg-surface-1 px-5">
          {payment.description ? <Row label="For" value={payment.description} /> : null}
          <Row label={payment.description ? "Amount" : "Service fee"} value={formatRupees(payment.amount)} />
          {payment.protectionPlan > 0 ? <Row label="Protection Plan" value={formatRupees(payment.protectionPlan)} /> : null}
          {payment.discount > 0 ? <Row label="Discount" value={`− ${formatRupees(payment.discount)}`} /> : null}
          {payment.gst > 0 ? <Row label="GST" value={formatRupees(payment.gst)} /> : null}
          <Row label="Payment gateway fee" value={formatRupees(payment.gatewayFee)} />
          <Row label="Total to pay" value={formatRupees(payment.total)} strong />
        </div>
      )}

      {view.returnTicketCancellation && payment?.status === "PENDING" ? (
        <p className="rounded-lg bg-surface-2 px-4 py-3 text-xs text-ink-secondary">
          <span className="font-medium text-ink-primary">Cancellation: </span>
          {view.returnTicketCancellation.fee !== null && view.returnTicketCancellation.fee > 0
            ? `${formatRupees(view.returnTicketCancellation.fee)} cancellation fee plus gateway charges if you cancel before your request is forwarded to the airline/vendor.`
            : "Gateway charges are non-refundable if you cancel before your request is forwarded to the airline/vendor."}{" "}
          No refund after forwarding or after the ticket is issued.
        </p>
      ) : null}

      {payment?.status === "PENDING" && view.quotationExpired ? (
        <div className="flex flex-col gap-3 rounded-xl border border-error/30 bg-error/10 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-error">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            This quotation has expired.
          </p>
          <p className="text-sm text-ink-secondary">Message us with your reference number and we&apos;ll send you an updated quotation.</p>
          <div>
            <ButtonLink href={siteConfig.contact.whatsappHref}>WhatsApp Support</ButtonLink>
          </div>
        </div>
      ) : null}

      {payment?.status === "PENDING" && !view.quotationExpired && !view.termsAccepted ? (
        <TermsAgreement token={token} terms={view.terms} onAccepted={refresh} />
      ) : null}

      {payment?.status === "PENDING" && !view.quotationExpired && view.termsAccepted ? (
        <div className="flex flex-col gap-3">
          {view.demoGateway ? (
            <>
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-ink-secondary">
                Demo mode: the online payment gateway isn&apos;t connected yet, so no real money is charged. Pressing the
                button below simulates a successful payment.
              </p>
              <Button type="button" size="lg" onClick={() => void handleDemoPay()} isLoading={paying}>
                Pay {formatRupees(payment.total)} (demo)
              </Button>
            </>
          ) : payment.paymentLink ? (
            <>
              <a
                href={payment.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAwaitingGateway(true)}
                className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-white hover:bg-accent-dark"
              >
                Pay {formatRupees(payment.total)} securely
              </a>
              {awaitingGateway ? (
                <p className="flex items-center gap-2 text-sm text-ink-secondary">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Waiting for your payment to be confirmed — this page updates automatically.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {payment && (payment.status === "FAILED" || payment.status === "EXPIRED") ? (
        <div className="flex flex-col gap-3 rounded-xl border border-error/30 bg-error/10 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-error">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {payment.status === "EXPIRED" ? "This payment link has expired." : "The payment didn't go through."}
          </p>
          <p className="text-sm text-ink-secondary">Message us with your reference number and we&apos;ll send a fresh payment link.</p>
          <div>
            <ButtonLink href={siteConfig.contact.whatsappHref}>WhatsApp Support</ButtonLink>
          </div>
        </div>
      ) : null}

      {payment?.status === "SUCCESS" ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <div className="flex flex-col gap-1 text-sm text-ink-secondary">
              <p className="font-semibold text-ink-heading">Thank you — your payment is confirmed.</p>
              {view.bookingId ? (
                <p>
                  Booking ID: <span className="font-medium text-ink-accent">{view.bookingId}</span>
                </p>
              ) : null}
              <p>A receipt has been emailed to you. Next, please upload your documents below.</p>
            </div>
          </div>

          {view.documentTypes.length > 0 || view.requestedDocuments.length > 0 ? (
            <section className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink-heading">Upload your documents</h2>
                <span className="text-xs text-ink-tertiary">
                  {uploadedCount} of {requiredCount} required uploaded
                </span>
              </div>
              {view.applicants.map((applicant) => (
                <div key={applicant.id} className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
                  <p className="text-sm font-semibold text-ink-heading">{applicant.fullName}</p>
                  {view.documentTypes.map((doc) => (
                    <DocumentSlot
                      key={doc.type}
                      label={doc.required ? doc.label : `${doc.label} (where applicable)`}
                      uploaded={hasDocument(applicant.id, doc.type)}
                      uploading={uploadingKey === `${applicant.id}:${doc.type}`}
                      onFile={(file) => void handleUpload(applicant.id, doc.type, file)}
                      reuse={(() => {
                        const offer = view.reusable.find((item) => item.passengerId === applicant.id && item.type === doc.type);
                        return offer
                          ? { uploadedAt: offer.uploadedAt, onUse: () => void handleReuse(applicant.id, doc.type, offer.sourceDocumentId) }
                          : undefined;
                      })()}
                    />
                  ))}
                  {view.requestedDocuments
                    .filter((doc) => doc.passengerId === applicant.id && !view.documentTypes.some((type) => type.type === doc.type))
                    .map((doc) => (
                      <div key={`requested-${doc.type}`} className="flex flex-col gap-1">
                        <DocumentSlot
                          label={`${doc.type} (requested)`}
                          uploaded={doc.status === "RECEIVED" || doc.status === "VERIFIED"}
                          uploading={uploadingKey === `${applicant.id}:${doc.type}`}
                          onFile={(file) => void handleUpload(applicant.id, doc.type, file)}
                        />
                        <span className="px-1 text-xs text-ink-tertiary">Why we need it: {doc.reason}</span>
                      </div>
                    ))}
                </div>
              ))}
              <p className="text-xs text-ink-tertiary">
                JPEG, PNG, GIF, WebP or PDF, up to 3MB each. Our team validates your documents and keeps you updated.
              </p>
            </section>
          ) : null}

          {view.postTicketOffer ? <PostTicketOfferCard bookingToken={token} /> : null}

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={utilityLinks.trackStatus.href}>Track Status</ButtonLink>
            <ButtonLink href="/services" variant="ghost">
              Browse Services
            </ButtonLink>
          </div>
        </>
      ) : null}
    </div>
  );
}
