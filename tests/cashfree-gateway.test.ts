import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { CashfreeGateway, verifyCashfreeSignature } from "../src/lib/payments/cashfree-gateway";

const SECRET = "test-secret-key";
const sign = (timestamp: string, body: string) => crypto.createHmac("sha256", SECRET).update(timestamp + body).digest("base64");

const paidBody = JSON.stringify({
  type: "PAYMENT_LINK_EVENT",
  data: { link_id: "tnx_abc", link_status: "PAID", link_amount_paid: 1234.5, link_currency: "INR", order: { transaction_id: 98765 } },
});

describe("Cashfree webhook", () => {
  const gateway = new CashfreeGateway("app-id", SECRET, "sandbox");

  it("verifies base64(HMAC-SHA256(timestamp + body))", () => {
    expect(verifyCashfreeSignature(paidBody, "1700000000", sign("1700000000", paidBody), SECRET)).toBe(true);
    expect(verifyCashfreeSignature(paidBody, "1700000001", sign("1700000000", paidBody), SECRET)).toBe(false);
  });

  it("parses a PAID link event into PAYMENT_SUCCESS with the amount in paise", () => {
    const event = gateway.verifyAndParseWebhook(paidBody, `1700000000.${sign("1700000000", paidBody)}`);
    expect(event).toMatchObject({ type: "PAYMENT_SUCCESS", gatewayRef: "tnx_abc", amountInPaise: 123450, currency: "INR", gatewayPaymentId: "98765" });
  });

  it("maps EXPIRED to PAYMENT_FAILED", () => {
    const body = JSON.stringify({ type: "PAYMENT_LINK_EVENT", data: { link_id: "tnx_abc", link_status: "EXPIRED" } });
    expect(gateway.verifyAndParseWebhook(body, `1.${sign("1", body)}`)?.type).toBe("PAYMENT_FAILED");
  });

  it("rejects a tampered body, a missing header and a wrong secret", () => {
    const signature = `1700000000.${sign("1700000000", paidBody)}`;
    expect(gateway.verifyAndParseWebhook(paidBody.replace("1234.5", "1.0"), signature)).toBeNull();
    expect(gateway.verifyAndParseWebhook(paidBody, null)).toBeNull();
    expect(new CashfreeGateway("app-id", "other-secret", "sandbox").verifyAndParseWebhook(paidBody, signature)).toBeNull();
  });
});
