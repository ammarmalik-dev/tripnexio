/** P15 — where the post-ticket offer links go (the separate service modules, Flight_Special_Fare.md §22). Client-safe. */
export const POST_TICKET_OFFER_LINKS = {
  returnTicket: "/services/return-ticket",
  otb: "/services/otb",
} as const;
