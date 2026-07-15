"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { RouteCluster } from "@/application/usecases/GetAllRoutes";
import { t } from "@/i18n";

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
}

export function ClusterPanel({ clusters, names, stats, selectedIdx, onSelect }: Props) {
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
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title={names[selectedIdx]}
        className="glass-map-chip flex min-w-0 items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted"
      >
        {/* Truncates only when the row is too tight, so the name shrinks before
            it can push the Types / year pickers off the right edge. */}
        <span className="min-w-0 truncate text-xs font-semibold text-accent-text">{names[selectedIdx]}</span>
        <span className="shrink-0 text-caption text-subtle">
          {t.common.runs(stats[selectedIdx]?.routeCount ?? 0)}
        </span>
        <ChevronDown
          size={16}
          className={["shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : ""].join(" ")}
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
