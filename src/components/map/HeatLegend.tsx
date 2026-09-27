"use client";

import { t } from "@/i18n";

/**
 * Rare → Frequent, the map's own scale (v5.6 #5): band grey and thin to ink
 * and wide. Under the map in the page, over its corner in fullscreen (v4.8).
 */
export function HeatLegend({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      className={[
        "flex items-center gap-2 text-xs text-muted-foreground",
        overlay ? "glass-map-chip absolute bottom-[calc(max(env(safe-area-inset-bottom),12px)+22px)] left-3 z-10 rounded-[12px] px-3 py-2" : "",
      ].join(" ")}
    >
      <span>{t.pages.map.less}</span>
      <div
        className="h-1.5 w-16"
        data-testid="heat-legend-wedge"
        style={{
          background: "linear-gradient(to right, var(--band), var(--foreground))",
          clipPath: "polygon(0 40%, 100% 0, 100% 100%, 0 60%)",
        }}
        aria-hidden
      />
      <span>{t.pages.map.more}</span>
    </div>
  );
}
