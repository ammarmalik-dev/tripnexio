interface ServiceBreakdownItem {
  label: string;
  count: number;
}

interface ServiceBreakdownBarsProps {
  items: ServiceBreakdownItem[];
}

/** A ranked horizontal-bar list — which services are actually bringing in leads this period. */
export function ServiceBreakdownBars({ items }: ServiceBreakdownBarsProps) {
  if (items.length === 0) {
    return <div className="flex h-32 items-center justify-center text-sm text-ink-tertiary">No leads in this period yet.</div>;
  }

  const maxCount = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex justify-between">
            <span className="text-xs text-ink-secondary">{item.label}</span>
            <span className="text-xs font-semibold text-ink-primary">{item.count}</span>
          </div>
          <div className="h-[7px] rounded-full bg-ink-primary/[0.04]">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, (item.count / maxCount) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
