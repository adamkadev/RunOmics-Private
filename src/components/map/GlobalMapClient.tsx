"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import type { AllRoutesData } from "@/application/usecases/GetAllRoutes";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import { ClusterPanel } from "./ClusterPanel";
import { YearPicker } from "./YearPicker";
import { useMapRoutes } from "./useMapRoutes";
import { coordLabel, matchesFilters } from "./mapUtils";

interface Props {
  data: AllRoutesData;
}

export function GlobalMapClient({ data }: Props) {
  const { clusters, routeMeta } = data;
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [names, setNames] = useState<string[]>(() => clusters.map(coordLabel));

  const clusterStats = useMemo(
    () =>
      clusters.map((c) => {
        const indices = c.routeIndices.filter((i) => matchesFilters(routeMeta[i], selectedYear));
        return {
          routeCount: indices.length,
          totalKm: Math.round(indices.reduce((s, i) => s + (routeMeta[i]?.distanceKm ?? 0), 0)),
        };
      }),
    [clusters, routeMeta, selectedYear],
  );

  const visibleIndices = useMemo(
    () =>
      clusters[selectedIdx]?.routeIndices.filter((i) =>
        matchesFilters(routeMeta[i], selectedYear),
      ) ?? [],
    [clusters, selectedIdx, routeMeta, selectedYear],
  );

  const { containerRef, resize } = useMapRoutes(data, selectedIdx, visibleIndices);

  useSetFullscreenChromeHidden(isFullscreen);

  useEffect(() => {
    resize();
  }, [isFullscreen, resize]);

  useEffect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN;
    if (!token) return;
    let cancelled = false;
    Promise.all(clusters.map((c) => reverseGeocode(c.center[0], c.center[1], token))).then(
      (results) => {
        if (cancelled) return;
        setNames(clusters.map((c, i) => results[i] ?? coordLabel(c)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [clusters]);

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-background" : "relative h-full w-full"}>
      <div ref={containerRef} role="img" aria-label={t.pages.map.title} className="h-full w-full" />

      <ClusterPanel
        clusters={clusters}
        names={names}
        stats={clusterStats}
        selectedIdx={selectedIdx}
        onSelect={setSelectedIdx}
        isFullscreen={isFullscreen}
      />

      <YearPicker
        years={data.years}
        value={selectedYear}
        onChange={setSelectedYear}
        isFullscreen={isFullscreen}
      />

      <button
        onClick={() => setIsFullscreen((f) => !f)}
        aria-label={isFullscreen ? t.pages.map.exitFullscreen : t.pages.map.fullscreen}
        className={[
          "glass-map-chip absolute right-3 z-10 flex h-11 w-11 items-center justify-center transition-colors hover:bg-muted",
          isFullscreen ? "bottom-[max(env(safe-area-inset-bottom),12px)]" : "bottom-3",
        ].join(" ")}
      >
        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>
    </div>
  );
}
