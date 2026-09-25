"use client";

import { CopyLinkButton } from "./CopyLinkButton";
import { siteConfig } from "@/lib/site-config";

/** Gives staff the customer's own /pay/<token> link for this booking — same page a customer reaches automatically after approving a quote or after Return Ticket/OTB checkout. */
export function CopyPaymentLinkButton({ customerToken }: { customerToken: string | null }) {
  if (!customerToken) return null;

  const url = `${siteConfig.url}/pay/${customerToken}`;
  return <CopyLinkButton url={url} label="Copy Payment Link" />;
}
