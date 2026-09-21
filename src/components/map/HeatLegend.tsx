"use client";

import { heatLegendSwatches } from "./mapUtils";
import { t } from "@/i18n";

export function HeatLegend({ isFullscreen }: { isFullscreen?: boolean }) {
  const swatches = heatLegendSwatches();

  return (
    <div
      className={[
        "glass-map-chip absolute left-3 z-10 flex items-center gap-2 px-3 py-2",
        isFullscreen
          ? "bottom-[calc(max(env(safe-area-inset-bottom),12px)+2.25rem)]"
          : "bottom-11",
      ].join(" ")}
    >
      <span className="text-caption text-subtle">{t.pages.map.less}</span>
      <div
        className="h-2 w-20 rounded-full"
        style={{ background: `linear-gradient(to right, ${swatches.join(", ")})` }}
        aria-hidden
      />
      <span className="text-caption text-subtle">{t.pages.map.more}</span>
    </div>
  );
}
