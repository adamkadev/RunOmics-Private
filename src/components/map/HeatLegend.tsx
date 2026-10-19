"use client";

import { useTheme } from "next-themes";
import { heatRamp } from "@/lib/heatRamp";
import { useAccentUiColor } from "@/lib/useAccent";
import { t } from "@/i18n";

export function HeatLegend({ className = "" }: { className?: string }) {
  const accent = useAccentUiColor();
  const { resolvedTheme } = useTheme();
  const ramp = heatRamp(accent);
  const background =
    resolvedTheme === "light"
      ? `linear-gradient(90deg, color-mix(in srgb, ${ramp.light} 20%, transparent), ${ramp.light} 55%, ${ramp.deep})`
      : "linear-gradient(90deg, color-mix(in srgb, var(--accent) 20%, transparent), var(--accent) 55%, var(--heat-end))";

  return (
    <div className={`map-overlay flex items-center gap-2 rounded-full px-2.5 py-1.5 text-caption ${className}`}>
      <span>{t.pages.map.less}</span>
      <div className="h-[5px] w-[72px] rounded-[3px]" data-testid="heat-legend-ramp" style={{ background }} aria-hidden />
      <span>{t.pages.map.more}</span>
    </div>
  );
}
