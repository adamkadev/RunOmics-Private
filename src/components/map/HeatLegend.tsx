"use client";

import { t } from "@/i18n";

/**
 * Rare → Frequent (v4.17): the accent from a fifth of its strength to
 * --heat-end, where overlapping tracks end up. A pill in the map's
 * bottom-left corner, in the page and in fullscreen.
 */
export function HeatLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`map-overlay flex items-center gap-2 rounded-full px-2.5 py-1.5 text-caption ${className}`}>
      <span>{t.pages.map.less}</span>
      <div
        className="h-[5px] w-[72px] rounded-[3px]"
        data-testid="heat-legend-ramp"
        style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--accent) 20%, transparent), var(--accent) 55%, var(--heat-end))" }}
        aria-hidden
      />
      <span>{t.pages.map.more}</span>
    </div>
  );
}
