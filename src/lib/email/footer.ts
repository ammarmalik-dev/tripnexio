/**
 * The disclaimer at the bottom of every email the system sends (client
 * request 2026-10-03: emails come from a no-reply address, so tell the
 * reader where to go instead). Text from Admin → System Configuration
 * ("Email footer"); blank = DEFAULT below with the support phone filled in.
 */
export const SUPPORT_EMAIL = "support@tripnexio.com";

export function defaultEmailFooter(supportPhone: string): string {
  return (
    "This is an automatically generated email. Please do not reply to this message. " +
    `For any queries, feedback or suggestions, please contact our support team at ${SUPPORT_EMAIL} or call ${supportPhone}.`
  );
}
