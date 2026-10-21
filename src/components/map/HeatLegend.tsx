"use client";

import { useTheme } from "next-themes";
import { heatAccent, heatLegendGradient } from "@/lib/heatRamp";
import { useAccent } from "@/lib/useAccent";
import { t } from "@/i18n";

/**
 * "Rare → Frequent" over the map's exact ramp: light's four stops (App Fixes
 * 4d); dark is variant A's, faint to full accent, burning to --heat-end.
 */
export function HeatLegend({ className = "" }: { className?: string }) {
  const accent = heatAccent(useAccent());
  const { resolvedTheme } = useTheme();
  const background =
    resolvedTheme === "light"
      ? heatLegendGradient("light", accent)
      : "linear-gradient(90deg, color-mix(in srgb, var(--accent) 20%, transparent), var(--accent) 55%, var(--heat-end))";

  return (
    <div className={`map-overlay flex items-center gap-2 rounded-full px-2.5 py-1.5 text-caption ${className}`}>
      <span>{t.pages.map.less}</span>
      <div className="h-[5px] w-20 rounded-[3px]" data-testid="heat-legend-ramp" style={{ background }} aria-hidden />
      <span>{t.pages.map.more}</span>
    </div>
  );
}
