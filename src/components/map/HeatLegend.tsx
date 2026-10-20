"use client";

import { useRef } from "react";
import { useTheme } from "next-themes";
import { heatAccent, heatLegendGradient } from "@/lib/heatRamp";
import { useAccent } from "@/lib/useAccent";
import { useHeatVariant } from "@/lib/heatVariant";
import { t } from "@/i18n";

/** "Rare → Frequent" over the map's exact ramp (App Fixes 4d): four stops in light, three in dark. */
/** How long a press on the letter takes to cycle the variant. */
const LONG_PRESS_MS = 500;

export function HeatLegend({ className = "" }: { className?: string }) {
  const accent = heatAccent(useAccent());
  const { resolvedTheme } = useTheme();
  const [variant, toggleVariant] = useHeatVariant();
  const pressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = () => {
    if (pressRef.current) clearTimeout(pressRef.current);
    pressRef.current = null;
  };
  const dark = resolvedTheme !== "light";
  // Dark A as 3.1.0 drew it: faint to full accent, burning to --heat-end.
  // Dark B (owner test): dim accent to full accent, no white end.
  // Dark C (candidate): dim accent, accent, light accent - the core's own ramp.
  const background = !dark
    ? heatLegendGradient("light", accent)
    : variant === "B"
      ? "linear-gradient(90deg, color-mix(in srgb, var(--accent) 40%, #0b0c0c), var(--accent))"
      : variant === "C"
        ? "linear-gradient(90deg, color-mix(in srgb, var(--accent) 40%, #0b0c0c), var(--accent) 70%, color-mix(in srgb, var(--accent) 65%, #ffffff))"
        : "linear-gradient(90deg, color-mix(in srgb, var(--accent) 20%, transparent), var(--accent) 55%, var(--heat-end))";

  return (
    <div className={`map-overlay flex items-center gap-2 rounded-full px-2.5 py-1.5 text-caption ${className}`}>
      <span>{t.pages.map.less}</span>
      <div className="h-[5px] w-20 rounded-[3px]" data-testid="heat-legend-ramp" style={{ background }} aria-hidden />
      <span>{t.pages.map.more}</span>
      {/* The switch while the dark test runs: long-press to cycle A → B → C. */}
      {dark && (
        <button
          type="button"
          onPointerDown={() => {
            if (pressRef.current) clearTimeout(pressRef.current);
            pressRef.current = setTimeout(() => {
              pressRef.current = null;
              toggleVariant();
            }, LONG_PRESS_MS);
          }}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: "none", userSelect: "none" }}
          className="pointer-events-auto ml-0.5 rounded-[6px] border border-border px-1.5 text-[11px] font-semibold leading-[18px] text-foreground"
          data-testid="heat-variant"
          aria-label={`Heatmap ${variant}`}
        >
          {variant}
        </button>
      )}
    </div>
  );
}
