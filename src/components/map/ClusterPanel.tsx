"use client";

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
import { ChipMenuPanel, useChipMenu } from "./chipMenu";

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
  const menu = useChipMenu("start");

  const selectedName = worldView ? t.pages.map.allAreas : names[selectedIdx]

  return (
    <div className="min-w-0 shrink-0">
      <button
        {...menu.chipProps}
        title={selectedName}
        /* Without this the button announces itself as its own contents - "Robertsau 12" -
           which names the current zone and the route count but never says the control
           picks a zone. */
        aria-label={`${t.pages.map.zones}: ${selectedName}`}
        className={[MAP_CHIP_GEOMETRY, "min-w-0 max-w-[170px] gap-2"].join(" ")}
        style={{ ...MAP_CHIP_STYLE, ...MAP_CHIP_ACTIVE }}
      >
        <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: MAP_CHIP_ACTIVE.color }}>
          {selectedName}
        </span>
        <span className="min-w-0 shrink truncate tabular-nums" style={{ fontSize: "12px", color: MAP_CHIP_COUNT_INK }}>
          {worldView ? totalCount : (stats[selectedIdx]?.routeCount ?? 0)}
        </span>
        <ChevronDown
          size={10}
          style={{ color: MAP_CHIP_CARET_INK }}
          className={["shrink-0 transition-transform", menu.open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {/* A column, so that when the room below the chip is short the list
          gives way and scrolls, never the header with its close button. */}
      <ChipMenuPanel menu={menu} className="glass-map-chip flex w-52 flex-col overflow-hidden rounded-[10px]">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-xs font-semibold text-foreground/80">{t.pages.map.zones}</p>
          <button
            onClick={menu.close}
            aria-label={t.common.close}
            className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="max-h-64 min-h-0 overflow-y-auto py-1">
          {clusters.map((c, i) => (
            <li key={c.id}>
              <button
                onClick={() => { onSelect(i); menu.close(); }}
                aria-current={i === selectedIdx}
                className={[
                  "flex w-full flex-col gap-0.5 px-3 py-3 text-left transition-colors hover:bg-muted",
                  i === selectedIdx ? "bg-[var(--segmented-track)]" : "",
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
      </ChipMenuPanel>
    </div>
  );
}
