interface AreaTrendChartProps {
  data: { label: string; value: number }[];
  /** Distinct id per instance — SVG `<linearGradient>` ids must be unique per page, not just per component. */
  gradientId: string;
  height?: number;
}

/**
 * A hand-drawn SVG line+area chart — no charting library dependency for
 * what's fundamentally one polyline and one filled path. Straight segments
 * between points (not bezier-smoothed) for reliability; `stroke-linejoin`
 * round keeps it visually clean without needing real curve math.
 */
export function AreaTrendChart({ data, gradientId, height = 170 }: AreaTrendChartProps) {
  const width = 620;
  const padX = 20;
  const padTop = 14;
  const baselineY = height - 32;
  const plotWidth = width - padX * 2;

  if (data.length === 0) {
    return <div className="flex h-[170px] items-center justify-center text-sm text-ink-tertiary">No data for this period.</div>;
  }

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = baselineY - (d.value / maxValue) * (baselineY - padTop);
    return { x, y, ...d };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `M${points[0].x.toFixed(1)},${baselineY} L${polyline.replace(/ /g, " L")} L${points[points.length - 1].x.toFixed(1)},${baselineY} Z`;
  const last = points[points.length - 1];

  return (
    <div>
      <svg width="100%" height={height - 24} viewBox={`0 0 ${width} ${height - 24}`} preserveAspectRatio="none" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padX} y1={baselineY} x2={width - padX} y2={baselineY} stroke="var(--hairline)" strokeWidth="1" />
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="4.5" fill="var(--accent-dark)" />
      </svg>
      <div className="mt-1.5 flex justify-between px-1 text-[10.5px] text-ink-muted">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
