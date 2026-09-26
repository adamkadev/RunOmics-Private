"use client";

import { heatLegendSwatches } from "./mapUtils";
import { t } from "@/i18n";

/** Rare → Frequent. Under the map in the page, over its corner in fullscreen (v4.8). */
export function HeatLegend({ overlay = false }: { overlay?: boolean }) {
  const swatches = heatLegendSwatches();

  return (
    <div
      className={[
        "flex items-center gap-2 text-xs text-muted-foreground",
        overlay ? "glass-map-chip absolute bottom-[calc(max(env(safe-area-inset-bottom),12px)+22px)] left-3 z-10 rounded-[12px] px-3 py-2" : "",
      ].join(" ")}
    >
      <span>{t.pages.map.less}</span>
      <div
        className="h-1.5 w-16 rounded-full"
        style={{ background: `linear-gradient(to right, ${swatches.join(", ")})` }}
        aria-hidden
      />
      <span>{t.pages.map.more}</span>
    </div>
  );
}
