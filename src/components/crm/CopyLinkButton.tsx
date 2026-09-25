"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";

/** Step 57 — generic copy-to-clipboard button, pulled out of CopyPaymentLinkButton so a raw gateway paymentLink (not just the /pay/<token> page) can be copied the same way. */
export function CopyLinkButton({ url, label = "Copy Link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link — copy it manually instead.", { description: url });
    }
  };

  return (
    <Button type="button" size="sm" variant="ghost" onClick={() => void handleCopy()}>
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {label}
    </Button>
  );
}
