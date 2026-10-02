import { describe, expect, it } from "vitest";
import { appendEmailFooter, defaultEmailFooter } from "../src/lib/email/footer";

describe("email footer", () => {
  it("default text names the support email and the phone", () => {
    const text = defaultEmailFooter("+91 92381 84005");
    expect(text).toBe(
      "This is an automatically generated email. Please do not reply to this message. For any queries, feedback or suggestions, please contact our support team at support@tripnexio.com or call +91 92381 84005."
    );
  });

  it("is appended below the email body", () => {
    const html = appendEmailFooter("<p>Hi</p>", "Do not reply.");
    expect(html.startsWith("<p>Hi</p><hr")).toBe(true);
    expect(html).toContain("Do not reply.");
  });

  it("escapes Admin-entered text and keeps line breaks", () => {
    const html = appendEmailFooter("", "<script>x</script>\nLine 2");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;<br>Line 2");
  });

  it("leaves the email unchanged for an empty footer", () => {
    expect(appendEmailFooter("<p>Hi</p>", "   ")).toBe("<p>Hi</p>");
  });
});
