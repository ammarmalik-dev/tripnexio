import type { FunnelStage } from "@/lib/crm/dashboard";

interface ConversionFunnelChartProps {
  stages: FunnelStage[];
}

/**
 * A narrowing color ramp (accent blue -> deep navy) across the 7 rows
 * visually reinforces the funnel shape on top of the bar-width narrowing
 * itself — manually interpolated (7 fixed stops) rather than computed, since
 * there are always exactly 7 stages (`buildConversionFunnel` in
 * src/lib/crm/dashboard.ts).
 */
const STAGE_COLORS = ["#3e6fdb", "#3763c9", "#3057b6", "#294ba3", "#223f8f", "#1e357c", "#182a4d"];

export function ConversionFunnelChart({ stages }: ConversionFunnelChartProps) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  if (maxCount <= 1 && stages.every((s) => s.count === 0)) {
    return <div className="flex h-32 items-center justify-center text-sm text-ink-tertiary">No leads in this period yet.</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((stage, i) => {
        const widthPercent = Math.max(4, (stage.count / maxCount) * 100);
        const isLast = i === stages.length - 1;
        return (
          <div key={stage.key} className="flex items-center gap-3.5">
            <span className={`w-[150px] shrink-0 text-[12.5px] ${isLast ? "font-bold text-ink-heading" : "text-ink-secondary"}`}>{stage.label}</span>
            <div className="h-[26px] flex-grow rounded-lg bg-ink-primary/[0.04]">
              <div
                className="flex h-full items-center rounded-lg pl-3"
                style={{ width: `${widthPercent}%`, backgroundColor: STAGE_COLORS[i] ?? STAGE_COLORS[STAGE_COLORS.length - 1] }}
              >
                <span className="text-[11.5px] font-bold text-white">{stage.count}</span>
              </div>
            </div>
            <span className={`w-[46px] shrink-0 text-right text-[11.5px] ${isLast ? "font-bold text-success" : "text-ink-muted"}`}>
              {stage.percentOfFirst}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
