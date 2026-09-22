"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { siteConfig } from "@/lib/site-config";

/** Gives staff the customer's own /pay/<token> link for this booking — same page a customer reaches automatically after approving a quote or after Return Ticket/OTB checkout. */
export function CopyPaymentLinkButton({ customerToken }: { customerToken: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!customerToken) return null;

  const url = `${siteConfig.url}/pay/${customerToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Payment link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link — copy it manually instead.", { description: url });
    }
  };

  return (
    <Button type="button" size="sm" variant="ghost" onClick={() => void handleCopy()}>
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      Copy Payment Link
    </Button>
  );
}
