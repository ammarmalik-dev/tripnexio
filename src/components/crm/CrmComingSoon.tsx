interface CrmComingSoonProps {
  title: string;
}

/** Placeholder for CRM sections beyond Leads (Phase 3B–3D) so the sidebar nav doesn't 404. */
export function CrmComingSoon({ title }: CrmComingSoonProps) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold text-ink-heading">{title}</h1>
      <p className="max-w-sm text-sm text-ink-tertiary">This section is coming soon.</p>
    </div>
  );
}
