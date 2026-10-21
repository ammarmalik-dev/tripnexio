interface WeeklyBarChartProps {
  data: { label: string; value: number }[];
  /** Formats the bar's raw value for the tooltip/title — e.g. currency. */
  formatValue?: (value: number) => string;
}

/** A plain flex bar chart — the last bar (most recent week) is emphasized with the deep-navy end of the gradient. */
export function WeeklyBarChart({ data, formatValue }: WeeklyBarChartProps) {
  if (data.length === 0) {
    return <div className="flex h-[140px] items-center justify-center text-sm text-ink-tertiary">No data yet.</div>;
  }

  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <div className="flex h-[140px] items-end gap-2.5 px-1">
        {data.map((d, i) => {
          const heightPercent = Math.max(2, (d.value / maxValue) * 100);
          const isRecent = i >= data.length - 2;
          const valueLabel = formatValue ? formatValue(d.value) : String(d.value);
          // Each bar carries its value on top (non-zero only), so the trend reads without hovering.
          return (
            <div key={`${d.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              {d.value > 0 ? <span className="max-w-full truncate text-[10px] font-semibold text-ink-secondary">{valueLabel}</span> : null}
              <div
                className="w-full rounded-t-md transition-[filter] duration-150 hover:brightness-110"
                style={{
                  height: `${heightPercent * 0.82}%`,
                  background: isRecent ? "linear-gradient(180deg, var(--accent), var(--accent-dark))" : "linear-gradient(180deg, var(--accent-on-dark), var(--accent))",
                }}
                title={valueLabel}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2.5 px-1">
        {data.map((d, i) => (
          <span key={`${d.label}-label-${i}`} className={`flex-1 text-center text-[10.5px] ${i === data.length - 1 ? "font-bold text-ink-heading" : "text-ink-muted"}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
