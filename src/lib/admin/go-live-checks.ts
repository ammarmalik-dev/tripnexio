import { db } from "@/lib/db";
import { isPlaceholder } from "@/lib/env-placeholder";
import { runSequentially } from "@/lib/db-sequential";
import { TAX_FEE_CONFIG_ID } from "@/lib/settings/tax-fee-config";

export const SYSTEM_CONFIG_ID = "singleton";

export type GoLiveCheckGroup = "Payments" | "Email" | "WhatsApp" | "AI / OCR" | "Automation" | "Settings" | "Master data";

export interface GoLiveCheck {
  key: string;
  group: GoLiveCheckGroup;
  label: string;
  ok: boolean;
  /** What was found — never a secret value, only "set"/"not set" or counts. */
  detail: string;
  /** How to turn a red check green. */
  fixHint: string;
}

export interface GoLiveState {
  ready: boolean;
  markedAt: string | null;
  markedByName: string | null;
}

function envCheck(key: string, group: GoLiveCheckGroup, label: string, envName: string, fixHint: string): GoLiveCheck {
  const ok = !isPlaceholder(process.env[envName]);
  return { key, group, label, ok, detail: ok ? `${envName} is set` : `${envName} is not set`, fixHint };
}

/**
 * Matches "Sample…"/"Test…" at the start of a word ("Sample Airport 1",
 * "SAMPLE10", "TEST-2", "My Test Vendor") but not "Attested"/"Contest" —
 * a plain SQL `contains` would flag a real "Attested degree certificate".
 */
const SAMPLE_WORD = /(^|[^a-z])(sample|test)/i;

function isSampleLike(...values: (string | null | undefined)[]): boolean {
  return values.some((value) => typeof value === "string" && SAMPLE_WORD.test(value));
}

interface InsensitiveContains {
  contains: string;
  mode: "insensitive";
}

/** Coarse SQL pre-filter (`name ILIKE '%sample%' OR '%test%'`); isSampleLike() then applies the word-start rule in JS. */
function containsSampleOrTest<K extends string>(field: K): Record<K, InsensitiveContains>[] {
  return ["sample", "test"].map((term) => {
    const filter: InsensitiveContains = { contains: term, mode: "insensitive" };
    return { [field]: filter } as Record<K, InsensitiveContains>;
  });
}

function sampleCheck(key: string, label: string, count: number, where: string): GoLiveCheck {
  return {
    key: `sample-data-${key}`,
    group: "Master data",
    label: `${label}: no Sample/Test rows`,
    ok: count === 0,
    detail: count === 0 ? "No active Sample/Test rows" : `${count} active Sample/Test row(s)`,
    fixHint: `Delete or disable the placeholder rows in ${where}, and add the real records.`,
  };
}

/**
 * P26 — go-live readiness checks for Admin → Integrations. Every check is a
 * hard green/red; `goLiveReady` can only be set once every one is green
 * (see PATCH /api/admin/integrations-health/go-live). Secrets are only ever
 * reported as set / not set. Master-data checks count ACTIVE rows only — a
 * disabled Sample row isn't customer-facing, and disabling is the usual fix
 * when a placeholder row is still referenced elsewhere and can't be deleted.
 * DB queries run one at a time via runSequentially (the local `prisma dev`
 * database drops connections under a burst of parallel queries).
 */
export async function getGoLiveChecks(): Promise<GoLiveCheck[]> {
  const checks: GoLiveCheck[] = [
    envCheck("razorpay-key-id", "Payments", "Razorpay key id", "RAZORPAY_KEY_ID", "Add RAZORPAY_KEY_ID (Razorpay Dashboard → Account & Settings → API Keys) to the production environment variables and redeploy."),
    envCheck("razorpay-key-secret", "Payments", "Razorpay key secret", "RAZORPAY_KEY_SECRET", "Add RAZORPAY_KEY_SECRET (shown once when the API key is generated) to the production environment variables and redeploy."),
    envCheck("razorpay-webhook-secret", "Payments", "Razorpay webhook secret", "RAZORPAY_WEBHOOK_SECRET", "Create a webhook to /api/webhooks/razorpay in the Razorpay Dashboard, then add its secret as RAZORPAY_WEBHOOK_SECRET and redeploy."),
    envCheck("resend-api-key", "Email", "Resend API key", "RESEND_API_KEY", "Verify the sending domain in Resend, create an API key, and set RESEND_API_KEY (see docs/deployment/EMAIL_SETUP.md)."),
    envCheck("resend-from-email", "Email", "Sender (From) email", "RESEND_FROM_EMAIL", "Set RESEND_FROM_EMAIL to an address on the verified domain, e.g. \"TripNexio <no-reply@tripnexio.com>\"."),
    envCheck("whatsapp-access-token", "WhatsApp", "WhatsApp access token", "WHATSAPP_ACCESS_TOKEN", "Create a permanent System User token in Meta Business Manager and set WHATSAPP_ACCESS_TOKEN (see docs/deployment/WHATSAPP_SETUP.md)."),
    envCheck("whatsapp-phone-number-id", "WhatsApp", "WhatsApp phone number id", "WHATSAPP_PHONE_NUMBER_ID", "Copy the Phone Number ID from Meta → WhatsApp → API Setup into WHATSAPP_PHONE_NUMBER_ID."),
    envCheck("whatsapp-webhook-verify-token", "WhatsApp", "WhatsApp webhook verify token", "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "Set WHATSAPP_WEBHOOK_VERIFY_TOKEN to a random value and enter the same value when registering /api/webhooks/whatsapp in Meta."),
    envCheck("whatsapp-app-secret", "WhatsApp", "WhatsApp app secret", "WHATSAPP_APP_SECRET", "Copy the App Secret from Meta → App Settings → Basic into WHATSAPP_APP_SECRET (used to verify webhook signatures)."),
    envCheck("anthropic-api-key", "AI / OCR", "AI / OCR key (Anthropic)", "ANTHROPIC_API_KEY", "Create an API key in the Anthropic Console and set ANTHROPIC_API_KEY — used for passport OCR and the WhatsApp bot."),
  ];

  const automationOk = !isPlaceholder(process.env.AUTOMATION_API_KEY) || !isPlaceholder(process.env.CRON_SECRET);
  checks.push({
    key: "scheduler-secret",
    group: "Automation",
    label: "Scheduler secret (AUTOMATION_API_KEY or CRON_SECRET)",
    ok: automationOk,
    detail: automationOk ? "At least one scheduler secret is set" : "Neither AUTOMATION_API_KEY nor CRON_SECRET is set",
    fixHint: "Set CRON_SECRET (Vercel Cron) and/or AUTOMATION_API_KEY (n8n) — otherwise every background reminder job is rejected. See AUTOMATION_WORKFLOWS.md.",
  });

  const [
    unapprovedWhatsappTemplates,
    systemConfig,
    taxFee,
    airports,
    airlines,
    borders,
    vendors,
    coupons,
    documentRequirements,
    pricingRules,
    countries,
    visaTypes,
    subServices,
    sampleTemplates,
    sampleFaqs,
  ] = await runSequentially([
    () =>
      db.notificationTemplate.count({
        where: { channel: "WHATSAPP", active: true, OR: [{ metaTemplateName: null }, { metaTemplateName: "" }] },
      }),
    () => db.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { systemAlertEmail: true } }),
    () => db.taxFeeConfig.findUnique({ where: { id: TAX_FEE_CONFIG_ID }, select: { gstRatePercent: true } }),
    () => db.airport.findMany({ where: { active: true, OR: [...containsSampleOrTest("name"), ...containsSampleOrTest("code")] }, select: { name: true, code: true } }),
    () => db.airline.findMany({ where: { active: true, OR: [...containsSampleOrTest("name"), ...containsSampleOrTest("code")] }, select: { name: true, code: true } }),
    () => db.border.findMany({ where: { active: true, OR: containsSampleOrTest("name") }, select: { name: true } }),
    () => db.vendor.findMany({ where: { active: true, OR: containsSampleOrTest("name") }, select: { name: true } }),
    () => db.coupon.findMany({ where: { active: true, OR: containsSampleOrTest("code") }, select: { code: true } }),
    () => db.documentRequirement.findMany({ where: { active: true, OR: containsSampleOrTest("documentName") }, select: { documentName: true } }),
    // PricingRule has no name of its own — it's "sample" when it hangs off a Sample/Test country, visa type or sub-service.
    () =>
      db.pricingRule.findMany({
        where: {
          active: true,
          OR: [
            { country: { OR: containsSampleOrTest("name") } },
            { visaType: { OR: containsSampleOrTest("name") } },
            { subService: { OR: [...containsSampleOrTest("name"), ...containsSampleOrTest("code")] } },
          ],
        },
        select: { country: { select: { name: true } }, visaType: { select: { name: true } }, subService: { select: { name: true, code: true } } },
      }),
    () => db.country.findMany({ where: { active: true, OR: [...containsSampleOrTest("name"), ...containsSampleOrTest("code")] }, select: { name: true, code: true } }),
    () => db.visaType.findMany({ where: { active: true, OR: containsSampleOrTest("name") }, select: { name: true } }),
    () => db.subService.findMany({ where: { active: true, OR: [...containsSampleOrTest("name"), ...containsSampleOrTest("code")] }, select: { name: true, code: true } }),
    () => db.notificationTemplate.count({ where: { active: true, event: { startsWith: "SAMPLE_", mode: "insensitive" } } }),
    () => db.faq.count({ where: { active: true, question: { startsWith: "Sample", mode: "insensitive" } } }),
  ]);

  checks.push({
    key: "whatsapp-meta-templates",
    group: "WhatsApp",
    label: "Every active WhatsApp template has a Meta template name",
    ok: unapprovedWhatsappTemplates === 0,
    detail:
      unapprovedWhatsappTemplates === 0
        ? "All active WhatsApp templates are linked to a Meta template"
        : `${unapprovedWhatsappTemplates} active WhatsApp template(s) have no Meta template name`,
    fixHint: "Get each template approved in Meta Business Manager, then enter its exact name/language in Admin → Notification Templates (or disable the template).",
  });

  const alertEmailSet = Boolean(systemConfig?.systemAlertEmail?.trim());
  checks.push({
    key: "system-alert-email",
    group: "Settings",
    label: "System alert email",
    ok: alertEmailSet,
    detail: alertEmailSet ? "System alert email is set" : "System alert email is not set",
    fixHint: "Set the System Alert Email in Admin → System Configuration so failures reach someone.",
  });

  // P26 task: go-live is blocked while GST > 0 — the client's locked rule is
  // "GST OFF, invoice non-GST" until a GSTIN is registered and confirmed.
  const gstPercent = taxFee ? Number(taxFee.gstRatePercent) : 0;
  checks.push({
    key: "gst-rate",
    group: "Settings",
    label: "GST off (locked rule until GSTIN registration)",
    ok: gstPercent === 0,
    detail: gstPercent === 0 ? "GST is 0% (invoices are non-GST)" : `GST is set to ${gstPercent}%`,
    fixHint: "The locked business rule keeps GST at 0% until the GSTIN is registered and confirmed by the client. Set it back to 0% in Admin → Tax & Fee, or get the client's written go-ahead before charging GST.",
  });

  checks.push(
    sampleCheck("airports", "Airports", airports.filter((row) => isSampleLike(row.name, row.code)).length, "Admin → Airports"),
    sampleCheck("airlines", "Airlines", airlines.filter((row) => isSampleLike(row.name, row.code)).length, "Admin → Airlines"),
    sampleCheck("borders", "Borders", borders.filter((row) => isSampleLike(row.name)).length, "Admin → Borders"),
    sampleCheck("vendors", "Vendors", vendors.filter((row) => isSampleLike(row.name)).length, "Admin → Vendors"),
    sampleCheck("coupons", "Coupons", coupons.filter((row) => isSampleLike(row.code)).length, "Admin → Coupons"),
    sampleCheck(
      "document-requirements",
      "Document requirements",
      documentRequirements.filter((row) => isSampleLike(row.documentName)).length,
      "Admin → Document Requirements"
    ),
    sampleCheck(
      "pricing-rules",
      "Pricing rules",
      pricingRules.filter((row) => isSampleLike(row.country?.name, row.visaType?.name, row.subService?.name, row.subService?.code)).length,
      "Admin → Pricing"
    ),
    sampleCheck("countries", "Countries", countries.filter((row) => isSampleLike(row.name, row.code)).length, "Admin → Countries"),
    sampleCheck("visa-types", "Visa types", visaTypes.filter((row) => isSampleLike(row.name)).length, "Admin → Visa Types"),
    sampleCheck("sub-services", "Sub-services", subServices.filter((row) => isSampleLike(row.name, row.code)).length, "Admin → Sub-services"),
    sampleCheck("notification-templates", "Notification templates (SAMPLE_ events)", sampleTemplates, "Admin → Notification Templates"),
    sampleCheck("faqs", "FAQs (\"Sample…\" questions)", sampleFaqs, "Admin → FAQs")
  );

  return checks;
}

export async function getGoLiveState(): Promise<GoLiveState> {
  const config = await db.systemConfig.findUnique({
    where: { id: SYSTEM_CONFIG_ID },
    select: { goLiveReady: true, goLiveMarkedAt: true, goLiveMarkedById: true },
  });
  if (!config) return { ready: false, markedAt: null, markedByName: null };

  const markedBy = config.goLiveMarkedById
    ? await db.user.findUnique({ where: { id: config.goLiveMarkedById }, select: { name: true } })
    : null;
  return {
    ready: config.goLiveReady,
    markedAt: config.goLiveMarkedAt ? config.goLiveMarkedAt.toISOString() : null,
    markedByName: markedBy?.name ?? null,
  };
}
