import type { Metadata } from "next";
import { WhatsAppChats } from "@/components/crm/WhatsAppChats";

export const metadata: Metadata = { title: "WhatsApp Chats | Internal Dashboard" };

export default function CrmWhatsAppChatsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">WhatsApp Chats</h1>
        <p className="text-sm text-ink-tertiary">Customers who asked for an agent come first. Reply here — the booking stays one click away.</p>
      </div>
      <WhatsAppChats />
    </div>
  );
}
