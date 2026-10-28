import { describe, expect, it } from "vitest";
import { gatewayErrorText } from "../src/lib/payments/create-payment";

describe("gatewayErrorText", () => {
  it("reads a Razorpay SDK error object", () => {
    expect(gatewayErrorText({ statusCode: 400, error: { code: "BAD_REQUEST_ERROR", description: "expire_by is invalid" } })).toBe("expire_by is invalid (HTTP 400)");
  });
  it("keeps Error messages and never prints [object Object]", () => {
    expect(gatewayErrorText(new Error("timeout"))).toBe("timeout");
    expect(gatewayErrorText({ foo: 1 })).toBe('{"foo":1}');
  });
});
