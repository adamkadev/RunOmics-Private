"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, MapPin, X } from "lucide-react";
import { GlassLayers, glassClass } from "@/components/ui/GlassSurface";
import { t } from "@/i18n";
import { formatKm } from "@/lib/formatters";
import { OWN_ROW_SHARE, type AreaRow } from "./mapUtils";
import { ChipMenuPanel, useChipMenu } from "./chipMenu";

interface Props {
  /** Busiest by km first. */
  rows: AreaRow[];
  names: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}

function AreaOption({ row, name, selected, onPick }: { row: AreaRow; name: string; selected: boolean; onPick: () => void }) {
  return (
    <li className="border-t border-border">
      <button
        onClick={onPick}
        aria-current={selected}
        className="grid w-full items-center gap-2.5 px-1 py-3 text-left transition-colors hover:bg-muted"
        style={{ gridTemplateColumns: "minmax(0,1fr) auto 20px" }}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={["truncate text-[15px] text-foreground", selected ? "font-semibold" : ""].join(" ")}>{name}</span>
          <span className="text-[13px] text-muted-foreground">
            {t.common.runs(row.runs)} · {formatKm(row.km)} {t.units.km}
          </span>
        </span>
        <span className="font-display text-[15px] font-semibold tabular-nums text-foreground">{row.sharePercent}%</span>
        <span className="flex justify-end text-accent-text">{selected && <Check size={16} strokeWidth={2.5} />}</span>
      </button>
    </li>
  );
}

export function ClusterPanel({ rows, names, selectedIdx, onSelect }: Props) {
  const menu = useChipMenu("start");
  const [unfolded, setUnfolded] = useState(false);

  const selectedName = names[selectedIdx] ?? "";
  const totalRuns = rows.reduce((s, r) => s + r.runs, 0);
  const totalKm = rows.reduce((s, r) => s + r.km, 0);

  const own = rows.filter((r, i) => i === 0 || r.sharePercent >= OWN_ROW_SHARE || r.idx === selectedIdx);
  const folded = rows.filter((r) => !own.includes(r));
  const showAll = unfolded || folded.length < 2;
  const visible = showAll ? rows : own;
  const foldedKm = folded.reduce((s, r) => s + r.km, 0);

  function pick(idx: number) {
    onSelect(idx);
    setUnfolded(false);
    menu.close();
  }

  return (
    <div className="flex min-w-0 flex-1">
      <button
        {...menu.chipProps}
        title={selectedName}
        aria-label={`${t.pages.map.area}: ${selectedName}`}
        className={glassClass("regular", "flex h-11 min-w-0 flex-1 items-center gap-2 pl-3.5 pr-3 text-foreground")}
      >
        <GlassLayers />
        <MapPin size={18} strokeWidth={2} aria-hidden="true" className="shrink-0 text-accent" />
        <span data-testid="area-label" className="min-w-0 flex-1 truncate text-left text-headline text-foreground">{selectedName}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          aria-hidden="true"
          className={["shrink-0 text-muted-foreground transition-transform", menu.open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      <ChipMenuPanel menu={menu} className="glass-map-chip flex w-[300px] flex-col overflow-hidden rounded-[14px] px-3">
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-col py-2">
            <p className="font-display text-lg font-bold text-foreground">{t.pages.map.areas}</p>
            <p className="text-[13px] text-muted-foreground">{t.pages.map.areasSummary(rows.length, totalRuns)}</p>
          </div>
          <button
            onClick={menu.close}
            aria-label={t.common.close}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="max-h-80 min-h-0 overflow-y-auto">
          {visible.map((row) => (
            <AreaOption key={row.idx} row={row} name={names[row.idx] ?? ""} selected={row.idx === selectedIdx} onPick={() => pick(row.idx)} />
          ))}
          {!showAll && (
            <li className="border-t border-border">
              <button
                onClick={() => setUnfolded(true)}
                className="grid w-full items-center gap-2.5 px-1 py-3 text-left transition-colors hover:bg-muted"
                style={{ gridTemplateColumns: "minmax(0,1fr) auto 20px" }}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] text-foreground">{t.pages.map.moreAreas(folded.length)}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {t.common.runs(folded.reduce((s, r) => s + r.runs, 0))} · {formatKm(foldedKm)} {t.units.km} · {t.pages.map.including(names[folded[0]!.idx] ?? "")}
                  </span>
                </span>
                <span className="font-display text-[15px] font-semibold tabular-nums text-muted-foreground">
                  {totalKm > 0 ? Math.round((foldedKm / totalKm) * 100) : 0}%
                </span>
                <span className="flex justify-end text-muted-foreground"><ChevronRight size={16} /></span>
              </button>
            </li>
          )}
        </ul>
        <p className="pb-3 pt-2 text-xs leading-normal text-muted-foreground">{t.pages.map.shareNote}</p>
      </ChipMenuPanel>
    </div>
  );
}
