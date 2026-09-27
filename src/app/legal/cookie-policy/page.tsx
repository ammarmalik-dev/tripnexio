import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How TripNexio uses cookies and similar technologies.",
};

// Locked content — TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx §12.
// Effective Date: 23 September 2026. Its own "Developer implementation requirement" note
// (maintain a live cookie inventory, block optional scripts until consent, etc.) is a
// separate follow-up item once real analytics/advertising providers are actually installed —
// today's site only sets essential/session cookies, so there is no optional-cookie inventory yet.
export default function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      effectiveDate="23 September 2026"
      intro="TripNexio uses cookies and similar technologies to operate the website, remember preferences, understand website usage, protect the platform and, where enabled and lawfully permitted, support analytics or marketing activities."
      sections={[
        {
          heading: "1. Cookie categories",
          paragraphs: [
            "Necessary cookies help the website operate, maintain sessions, provide security and complete essential requests. Functionality cookies remember choices and preferences. Analytics/performance technologies help measure website usage and improve performance. Advertising/targeting technologies, if used, may support relevant marketing. Security/fraud technologies help detect misuse and suspicious activity.",
          ],
        },
        {
          heading: "2. Session and persistent cookies",
          paragraphs: [
            "Session cookies generally expire when the browsing session ends. Persistent cookies remain for a defined period or until removed by the customer or the relevant system.",
          ],
        },
        {
          heading: "3. Similar technologies",
          paragraphs: [
            "TripNexio may use pixels, tags, local storage, SDKs, log data or similar technologies for functions that cookies may perform.",
          ],
        },
        {
          heading: "4. Google Sign-In",
          paragraphs: [
            "Where Google Sign-In is enabled, Google may use cookies or related technologies to authenticate the customer and maintain the sign-in flow. TripNexio does not receive the customer's Google password through Google Sign-In.",
          ],
        },
        {
          heading: "5. Customer choices",
          paragraphs: [
            "Where applicable, TripNexio should provide an Accept All, Reject Non-Essential and/or Manage Preferences control. Non-essential cookies should not be treated as accepted merely because the customer continues browsing unless the applicable legal basis permits that approach.",
          ],
        },
        {
          heading: "6. Browser settings",
          paragraphs: [
            "Customers may manage or delete cookies through browser controls. Blocking necessary cookies may prevent parts of the website or checkout from working correctly.",
          ],
        },
        {
          heading: "7. Sensitive information",
          paragraphs: [
            "Ordinary cookies or local-storage values should not contain raw passport numbers, visa documents, full payment credentials or other high-risk personal information unless there is a documented, secure architecture and lawful reason for doing so.",
          ],
        },
        {
          heading: "8. Changes",
          paragraphs: [
            "The Cookie Policy and the live cookie inventory should be reviewed whenever TripNexio adds a new analytics, advertising, security, payment, authentication or support provider.",
          ],
        },
      ]}
    />
  );
}
