import type { AdminCommandProvider, CommandClassification } from "./command-provider";

/**
 * Selected by get-command-provider.ts when ANTHROPIC_API_KEY isn't
 * configured — same role as KeywordAiProvider does for the WhatsApp bot:
 * a genuinely functional fallback (not a stub), rule-based, so the whole
 * classify → handle → audit pipeline is exercisable in dev without a real
 * API key. Less flexible on phrasing than Claude, but every rule maps
 * directly to a real handler — it never fabricates a match.
 */
export class KeywordCommandProvider implements AdminCommandProvider {
  readonly providerName = "keyword (no ANTHROPIC_API_KEY configured)";

  async classifyCommand(question: string): Promise<CommandClassification> {
    const text = question.toLowerCase().trim();
    if (!text) return { commandType: "NOT_AVAILABLE", param: null, confidence: 0 };

    // Mutating-action verbs checked first — these must never fall through
    // to a read handler just because the sentence also contains a noun
    // like "service" or "price" that a later rule would otherwise match.
    if (/\b(create|add|disable|enable|change|increase|decrease|update|delete|remove)\b/.test(text)) {
      return { commandType: "NOT_AVAILABLE", param: null, confidence: 0.6 };
    }

    if (/\b(visitor|meta|google track|tat\b|\bsla\b|vendor recommend)/.test(text)) {
      return { commandType: "NOT_AVAILABLE", param: null, confidence: 0.5 };
    }

    if (/pending refund/.test(text)) {
      return { commandType: "PENDING_REFUNDS", param: null, confidence: 0.7 };
    }

    if (/failed automation/.test(text)) {
      return { commandType: "FAILED_AUTOMATIONS_TODAY", param: null, confidence: 0.7 };
    }

    if (/\b(whatsapp|n8n|ocr|integration|failed tool|payment gateway)\b/.test(text) && /\b(check|status|health)\b/.test(text)) {
      return { commandType: "INTEGRATION_HEALTH", param: null, confidence: 0.6 };
    }

    if (/staff workload|workload/.test(text)) {
      return { commandType: "STAFF_WORKLOAD", param: null, confidence: 0.7 };
    }

    // "pending-" is included — an unpaid Booking's bookingId is still the
    // PENDING-<random> placeholder (see Booking.bookingId's own schema
    // doc comment; the real TNX-XX-XXXXXX id is only assigned at payment
    // success) — exactly the kind of booking a "why is this stuck"
    // question is most likely to be about.
    const bookingMatch = /\b((?:tnx|nv|ve|vc|ff|rt|otb|pending)-[a-z0-9-]+)/i.exec(text);
    if (bookingMatch && /\b(stuck|delayed|why|status)\b/.test(text)) {
      return { commandType: "BOOKING_DIAGNOSIS", param: bookingMatch[1], confidence: 0.6 };
    }
    if (bookingMatch) {
      return { commandType: "BOOKING_DIAGNOSIS", param: bookingMatch[1], confidence: 0.5 };
    }

    const pocMatch = /\bpoc\b.*?(?:for|of|by)\s+([a-z][a-z\s]{1,40})/i.exec(text) ?? /bookings? (?:handled|assigned) (?:by|to)\s+([a-z][a-z\s]{1,40})/i.exec(text);
    if (pocMatch) {
      return { commandType: "POC_BOOKINGS", param: pocMatch[1].trim(), confidence: 0.5 };
    }

    const customerMatch = /bookings? for\s+([a-z][a-z\s]{1,40})/i.exec(text);
    if (customerMatch) {
      return { commandType: "CUSTOMER_BOOKINGS", param: customerMatch[1].trim(), confidence: 0.5 };
    }

    if (/p&l|today's payments|payments? summary|revenue/.test(text)) {
      return { commandType: "TODAY_PAYMENTS_SUMMARY", param: null, confidence: 0.6 };
    }

    if (/price change|config change/.test(text)) {
      return { commandType: "TODAY_CONFIG_CHANGES", param: null, confidence: 0.6 };
    }

    if (/why (are|is) customers?.*(not purchas|abandon|drop)/.test(text)) {
      const serviceMatch = /(new visa|visa extension|visa change|flight special fare|return ticket|otb)/i.exec(text);
      return { commandType: "SERVICE_FUNNEL", param: serviceMatch?.[1] ?? null, confidence: serviceMatch ? 0.6 : 0.3 };
    }

    return { commandType: "NOT_AVAILABLE", param: null, confidence: 0 };
  }
}
