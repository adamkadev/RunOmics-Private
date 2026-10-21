"use client";

import { useTheme } from "next-themes";
import { heatAccent, heatLegendGradient } from "@/lib/heatRamp";
import { useAccent } from "@/lib/useAccent";
import { Glass } from "@/components/ui/GlassSurface";
import { t } from "@/i18n";

/** What the area on screen holds, for the fullscreen legend's first line. */
export interface HeatLegendSummary {
  runs: number;
  km: string;
  year: string;
}

/**
 * "Rare → Frequent" over the map's exact ramp: light's four stops (App Fixes
 * 4d); dark is variant A's, faint to full accent, burning to --heat-end.
 * Regular glass over the map (Liquid Glass v3, G11): a capsule on the page;
 * in fullscreen, with a summary, the r28 legend card - "152 runs · 1,316 km"
 * and the year over the ramp.
 */
export function HeatLegend({ className = "", summary }: { className?: string; summary?: HeatLegendSummary }) {
  const accent = heatAccent(useAccent());
  const { resolvedTheme } = useTheme();
  const background =
    resolvedTheme === "light"
      ? heatLegendGradient("light", accent)
      : "linear-gradient(90deg, color-mix(in srgb, var(--accent) 30%, transparent), var(--accent) 55%, var(--heat-end))";

  const ramp = (wide: boolean) => (
    <div className="flex items-center gap-2.5 text-[13px] text-foreground">
      <span>{t.pages.map.less}</span>
      <div className={wide ? "h-1.5 flex-1 rounded-[3px]" : "h-[5px] w-[72px] rounded-[3px]"} data-testid="heat-legend-ramp" style={{ background }} aria-hidden />
      <span>{t.pages.map.more}</span>
    </div>
  );

  if (summary) {
    return (
      <Glass className={`flex flex-col gap-2 rounded-[28px] px-[18px] py-3.5 ${className}`} data-testid="heat-legend">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-headline text-foreground">
            {t.common.runs(summary.runs)} · {summary.km} {t.units.km}
          </span>
          <span className="shrink-0 text-[13px] text-muted-foreground">{summary.year}</span>
        </div>
        <div>{ramp(true)}</div>
      </Glass>
    );
  }

  return (
    <Glass className={`flex h-9 items-center px-3.5 ${className}`} data-testid="heat-legend">
      <div>{ramp(false)}</div>
    </Glass>
  );
}
