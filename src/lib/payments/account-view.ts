import type { PaymentGatewayAccount } from "../../generated/prisma/client";
import { accountMode, credentialEnvNames, isAccountConfigured } from "./accounts";

/** What Admin sees for one gateway account — env var NAMES and whether they're set, never their values. */
export function gatewayAccountView(account: PaymentGatewayAccount, stats?: { attempts: number; failures: number; lastAttemptAt: Date | null }) {
  return {
    id: account.id,
    provider: account.provider,
    label: account.label,
    envPrefix: account.envPrefix,
    envVars: credentialEnvNames(account.provider, account.envPrefix),
    configured: isAccountConfigured(account),
    mode: accountMode(account),
    priority: account.priority,
    active: account.active,
    lastCheckedAt: account.lastCheckedAt,
    lastCheckOk: account.lastCheckOk,
    lastCheckMessage: account.lastCheckMessage,
    attempts30d: stats?.attempts ?? 0,
    failures30d: stats?.failures ?? 0,
    lastAttemptAt: stats?.lastAttemptAt ?? null,
  };
}
