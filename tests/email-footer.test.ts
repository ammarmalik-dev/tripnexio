import { describe, expect, it } from "vitest";
import { defaultEmailFooter } from "../src/lib/email/footer";
import { renderEmailLayout, stripTrailingSignature } from "../src/lib/email/layout";
import { illustrationFor } from "../src/lib/notifications/email-hero";

const base = {
  siteUrl: "https://tripnexio.com",
  companyName: "TripNexio",
  tagline: "Travel Made Easy with TripNexio.",
  phone: "+91 92381 84005",
  supportEmail: "support@tripnexio.com",
  whatsappHref: "https://wa.me/919238184005",
  socials: {
    instagram: "https://instagram.com/tripnexio",
    facebook: "https://facebook.com/tripnexio",
    linkedin: "https://linkedin.com/company/tripnexio",
    x: "https://x.com/tripnexio",
    threads: "",
  },
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
    expect(html).toContain("https://tripnexio.com/email/logo-symbol.png");
    expect(html).toContain("Need assistance?");
  });

  it("follows the client's sample: Team sign-off, automated strip, contacts, socials, no address (2026-10-09, H)", () => {
    const html = renderEmailLayout({ ...base, bodyHtml: "Hi A,<br><br>Thanks.<br><br>— TripNexio", footerText: "" });
    expect(html).toContain("Team TripNexio");
    expect(html).toContain("This is an automated email. Please do not reply to this message.");
    expect(html).toContain("WhatsApp Support");
    expect(html).toContain("/email/so-instagram.png");
    expect(html).not.toContain("/email/so-threads.png");
    expect(html).not.toContain("Explore");
    expect(html).not.toContain("Mumbai");
    expect(html).not.toContain("— TripNexio");
  });

  it("shows the Booking ID / Service card", () => {
    const html = renderEmailLayout({ ...base, bodyHtml: "", footerText: "", hero: { heading: "Request Received", illustration: "request", summary: { reference: "11026VI019", service: "New Visa – United Arab Emirates" } } });
    expect(html).toContain("11026VI019");
    expect(html).toContain("New Visa – United Arab Emirates");
    expect(html).toContain("/email/hero-request.png");
  });

  it("strips only a trailing sign-off", () => {
    expect(stripTrailingSignature("Hi<br>— TripNexio", "TripNexio")).toBe("Hi");
    expect(stripTrailingSignature("Thanks for choosing TripNexio today", "TripNexio")).toBe("Thanks for choosing TripNexio today");
  });

  it("picks the picture per event", () => {
    expect(illustrationFor("LEAD_RECEIVED", "NEW_VISA", null)).toBe("request");
    expect(illustrationFor("QUOTE_READY", "FLIGHT_SPECIAL_FARE", null)).toBe("quote");
    expect(illustrationFor("PAYMENT_RECEIVED", "OTB", null)).toBe("payment");
    expect(illustrationFor("OUTPUT_DELIVERED", "NEW_VISA", null)).toBe("approved");
    expect(illustrationFor("OUTPUT_DELIVERED", "FLIGHT_SPECIAL_FARE", null)).toBe("boarding");
    expect(illustrationFor("SERVICE_STATUS_UPDATE", "VISA_EXTENSION", "Approved")).toBe("approved");
    expect(illustrationFor("SERVICE_STATUS_UPDATE", "VISA_EXTENSION", "Applied")).toBe("visa");
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
