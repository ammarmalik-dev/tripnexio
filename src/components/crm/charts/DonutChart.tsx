interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel: string;
}

/**
 * A CSS `conic-gradient` donut — no SVG arc-path math needed for a simple
 * proportional ring. `segments` order also drives the legend order.
 */
export function DonutChart({ segments, centerLabel }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <div className="flex h-[170px] items-center justify-center text-sm text-ink-tertiary">No data for this period.</div>;
  }

  const stops = segments
    .reduce<{ text: string; runningTotal: number }[]>((acc, s) => {
      const previousTotal = acc.length > 0 ? acc[acc.length - 1].runningTotal : 0;
      const startDeg = (previousTotal / total) * 360;
      const runningTotal = previousTotal + s.value;
      const endDeg = (runningTotal / total) * 360;
      return [...acc, { text: `${s.color} ${startDeg.toFixed(2)}deg ${endDeg.toFixed(2)}deg`, runningTotal }];
    }, [])
    .map((entry) => entry.text)
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[132px] w-[132px] rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-surface-1">
          <span className="text-lg font-extrabold text-ink-heading">{total}</span>
          <span className="text-[9.5px] font-medium tracking-wide text-ink-muted uppercase">{centerLabel}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12.5px] text-ink-secondary">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="text-[12.5px] font-semibold text-ink-primary">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
