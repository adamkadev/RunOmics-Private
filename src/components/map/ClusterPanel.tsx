"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { RouteCluster } from "@/application/usecases/GetAllRoutes";
import { t } from "@/i18n";
import {
  MAP_CHIP_ACTIVE,
  MAP_CHIP_CARET_INK,
  MAP_CHIP_COUNT_INK,
  MAP_CHIP_GEOMETRY,
  MAP_CHIP_STYLE,
} from "./mapUtils";

interface ClusterStat {
  routeCount: number;
  totalKm: number;
}

interface Props {
  clusters: RouteCluster[];
  names: string[];
  stats: ClusterStat[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  /** World view has no single selected area - the chip states the whole
   * picture instead of naming a place the map isn't showing. */
  worldView?: boolean;
  totalCount?: number;
}

export function ClusterPanel({ clusters, names, stats, selectedIdx, onSelect, worldView = false, totalCount = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title={worldView ? t.pages.map.allAreas : names[selectedIdx]}
        className={[MAP_CHIP_GEOMETRY, "min-w-0 max-w-[170px] gap-2"].join(" ")}
        style={{ ...MAP_CHIP_STYLE, ...MAP_CHIP_ACTIVE }}
      >
        <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: MAP_CHIP_ACTIVE.color }}>
          {worldView ? t.pages.map.allAreas : names[selectedIdx]}
        </span>
        <span className="min-w-0 shrink truncate tabular-nums" style={{ fontSize: "12px", color: MAP_CHIP_COUNT_INK }}>
          {worldView ? totalCount : (stats[selectedIdx]?.routeCount ?? 0)}
        </span>
        <ChevronDown
          size={10}
          style={{ color: MAP_CHIP_CARET_INK }}
          className={["shrink-0 transition-transform", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && (
        <div className="glass-map-chip absolute top-full z-10 mt-1 w-52 overflow-hidden rounded-[10px]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground/80">{t.pages.map.zones}</p>
            <button
              onClick={() => setOpen(false)}
              aria-label={t.common.close}
              className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {clusters.map((c, i) => (
              <li key={c.id}>
                <button
                  onClick={() => { onSelect(i); setOpen(false); }}
                  aria-current={i === selectedIdx}
                  className={[
                    "flex w-full flex-col gap-0.5 px-3 py-3 text-left transition-colors hover:bg-muted",
                    i === selectedIdx ? "bg-accent/10" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-xs font-medium",
                      i === selectedIdx ? "text-accent-text" : "text-foreground",
                    ].join(" ")}
                  >
                    {names[i]}
                  </span>
                  <span className="text-caption text-subtle">
                    {t.common.runs(stats[i]?.routeCount ?? 0)} · {stats[i]?.totalKm ?? 0} {t.units.km}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
