import type { Metadata } from "next";
import { ServiceTimelinesManager } from "@/components/admin/ServiceTimelinesManager";
import { OtbRulesManager } from "@/components/admin/OtbRulesManager";
import { ReturnTicketRuleConfigManager } from "@/components/admin/ReturnTicketRuleConfigManager";

export const metadata: Metadata = { title: "Timelines / SLA | Admin" };

export default function AdminTimelinesPage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Timelines / SLA</h1>
        <p className="text-sm text-ink-tertiary">
          The central timeline control for every service — document verification time, expected completion time,
          quotation response time, and payment deadline. OTB (working-day/working-hour business calendar) and
          Return Ticket (fixed day-offset rule) keep their own dedicated sections below since their shapes genuinely
          don&apos;t fit the generic one — everything still lives on this one screen, not separate pages.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink-heading">General Service Timelines</h2>
          <p className="text-sm text-ink-tertiary">One card per service. Leave a field blank to leave it unconfigured.</p>
        </div>
        <ServiceTimelinesManager />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink-heading">OTB Processing Timelines</h2>
          <p className="text-sm text-ink-tertiary">
            Standard and urgent OTB processing times, in working days/hours (Mon-Fri). Each airline can override
            these individually on the Airlines screen.
          </p>
        </div>
        <OtbRulesManager />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink-heading">Return Ticket Return-Date Offsets</h2>
          <p className="text-sm text-ink-tertiary">
            How many days after the travel date the return/onward date is computed, per selected visa validity.
          </p>
        </div>
        <ReturnTicketRuleConfigManager />
      </section>
    </div>
  );
}
