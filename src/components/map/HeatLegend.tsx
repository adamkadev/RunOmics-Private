"use client";

import { t } from "@/i18n";

/**
 * Rare → Frequent (v4.17): the ramp the tracks build to as they stack, from
 * the same --heat-1..4 stops the map's blending lands on. A pill in the map's
 * bottom-left corner, in the page and in fullscreen.
 */
export function HeatLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`map-overlay flex items-center gap-2 rounded-full px-2.5 py-1.5 text-caption ${className}`}>
      <span>{t.pages.map.less}</span>
      <div
        className="h-[5px] w-[72px] rounded-[3px]"
        data-testid="heat-legend-ramp"
        style={{ background: "linear-gradient(90deg, var(--heat-1), var(--heat-2), var(--heat-3), var(--heat-4))" }}
        aria-hidden
      />
      <span>{t.pages.map.more}</span>
    </div>
  );
}
