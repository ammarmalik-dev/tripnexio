import type { PaymentGatewayAccount } from "../../generated/prisma/client";
import type { GatewayProvider } from "../../generated/prisma/enums";
import { db } from "../db";
import { isPlaceholder } from "../env-placeholder";
import type { PaymentGateway } from "./gateway";
import { RazorpayGateway } from "./razorpay-gateway";
import { CashfreeGateway } from "./cashfree-gateway";
import { getPaymentGateway, isProductionRuntime, PaymentGatewayConfigError } from "./get-gateway";

/**
 * Client corrections 2026-10-05 §27 — payment gateway accounts in failover
 * order. Credentials live only in env vars named by `envPrefix`; the DB row
 * holds the label, priority, active flag and last health result.
 */

export const ENV_PREFIX_PATTERN = /^[A-Z][A-Z0-9_]{1,30}$/;

/** The env var names an account reads (shown in Admin so the right keys get set — values never leave the server). */
export function credentialEnvNames(provider: GatewayProvider, envPrefix: string): string[] {
  return provider === "RAZORPAY"
    ? [`${envPrefix}_KEY_ID`, `${envPrefix}_KEY_SECRET`, `${envPrefix}_WEBHOOK_SECRET`]
    : [`${envPrefix}_APP_ID`, `${envPrefix}_SECRET_KEY`, `${envPrefix}_ENV`];
}

export function isAccountConfigured(account: Pick<PaymentGatewayAccount, "provider" | "envPrefix">): boolean {
  const names = credentialEnvNames(account.provider, account.envPrefix);
  // Cashfree's _ENV is optional (defaults to production).
  const required = account.provider === "CASHFREE" ? names.slice(0, 2) : names;
  return required.every((name) => !isPlaceholder(process.env[name]));
}

/** "Live" / "Test" from the key itself (Razorpay rzp_live_/rzp_test_, Cashfree _ENV), never a stored guess. */
export function accountMode(account: Pick<PaymentGatewayAccount, "provider" | "envPrefix">): "Live" | "Test" | "Unknown" {
  if (!isAccountConfigured(account)) return "Unknown";
  if (account.provider === "RAZORPAY") {
    const keyId = process.env[`${account.envPrefix}_KEY_ID`] ?? "";
    return keyId.startsWith("rzp_live_") ? "Live" : keyId.startsWith("rzp_test_") ? "Test" : "Unknown";
  }
  return (process.env[`${account.envPrefix}_ENV`] ?? "production").toLowerCase() === "sandbox" ? "Test" : "Live";
}

/** A live gateway client for one account, or null when its env vars aren't set. */
export function gatewayForAccount(account: Pick<PaymentGatewayAccount, "provider" | "envPrefix">): PaymentGateway | null {
  if (!isAccountConfigured(account)) return null;
  const env = (suffix: string) => process.env[`${account.envPrefix}_${suffix}`]!;
  if (account.provider === "RAZORPAY") return new RazorpayGateway(env("KEY_ID"), env("KEY_SECRET"), env("WEBHOOK_SECRET"));
  const environment = (process.env[`${account.envPrefix}_ENV`] ?? "production").toLowerCase() === "sandbox" ? "sandbox" : "production";
  return new CashfreeGateway(env("APP_ID"), env("SECRET_KEY"), environment);
}

export interface UsableGateway {
  /** null = the development mock (no account rows configured). */
  account: PaymentGatewayAccount | null;
  gateway: PaymentGateway;
}

/**
 * Active, configured accounts in failover order (priority asc). Outside
 * production with nothing configured this is the dev mock; in production with
 * nothing usable it throws PaymentGatewayConfigError (never a silent mock).
 */
export async function usableGateways(): Promise<UsableGateway[]> {
  const accounts = await db.paymentGatewayAccount.findMany({ where: { active: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  const usable = accounts.flatMap((account) => {
    const gateway = gatewayForAccount(account);
    return gateway ? [{ account, gateway }] : [];
  });
  if (usable.length > 0) return usable;
  if (isProductionRuntime()) throw new PaymentGatewayConfigError();
  return [{ account: null, gateway: getPaymentGateway() }];
}

/** The gateway that issued a payment's link — its own account, else the original single Razorpay configuration / dev mock. */
export async function gatewayForPayment(payment: { gatewayAccountId: string | null }): Promise<PaymentGateway> {
  if (payment.gatewayAccountId) {
    const account = await db.paymentGatewayAccount.findUnique({ where: { id: payment.gatewayAccountId } });
    const gateway = account ? gatewayForAccount(account) : null;
    if (gateway) return gateway;
  }
  return getPaymentGateway();
}

/**
 * Every configured gateway of one provider — a webhook is verified against
 * each account's secret in turn (accounts may be disabled for new payments
 * but still receive webhooks for links they issued earlier).
 */
export async function webhookGateways(provider: GatewayProvider): Promise<PaymentGateway[]> {
  const accounts = await db.paymentGatewayAccount.findMany({ where: { provider }, orderBy: { priority: "asc" } });
  const gateways = accounts.flatMap((account) => {
    const gateway = gatewayForAccount(account);
    return gateway ? [gateway] : [];
  });
  if (gateways.length === 0 && provider === "RAZORPAY" && !isProductionRuntime()) {
    try {
      return [getPaymentGateway()];
    } catch {
      return [];
    }
  }
  return gateways;
}
