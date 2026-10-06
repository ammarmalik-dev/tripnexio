import { describe, expect, it } from "vitest";
import { defaultEmailFooter } from "../src/lib/email/footer";
import { renderEmailLayout } from "../src/lib/email/layout";

const base = {
  siteUrl: "https://tripnexio.com",
  companyName: "TripNexio",
  tagline: "Travel Made Easy with TripNexio.",
  phone: "+91 92381 84005",
  supportEmail: "support@tripnexio.com",
  address: "Mumbai, India",
};

describe("email footer", () => {
  it("default text names the support email and the phone", () => {
    const text = defaultEmailFooter("+91 92381 84005");
    expect(text).toBe(
      "This is an automatically generated email. Please do not reply to this message. For any queries, feedback or suggestions, please contact our support team at support@tripnexio.com or call +91 92381 84005."
    );
  });

  it("wraps the body in the branded layout with the footer below it", () => {
    const html = renderEmailLayout({ ...base, bodyHtml: "<p>Hi</p>", footerText: "Do not reply." });
    expect(html.indexOf("<p>Hi</p>")).toBeLessThan(html.indexOf("Do not reply."));
    expect(html).toContain("https://tripnexio.com/email/logo-white.png");
    expect(html).toContain("Need Assistance?");
  });

  it("escapes Admin-entered footer text and keeps line breaks", () => {
    const html = renderEmailLayout({ ...base, bodyHtml: "", footerText: "<script>x</script>\nLine 2" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;<br>Line 2");
  });

  it("shows the flight illustration and status pill when asked", () => {
    const html = renderEmailLayout({ ...base, bodyHtml: "", footerText: "", hero: { heading: "OTB Status", badge: "Approved", illustration: "flight" } });
    expect(html).toContain("/email/hero-flight.png");
    expect(html).toContain("Approved");
  });
});
