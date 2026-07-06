"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import type { AllRoutesData } from "@/application/usecases/GetAllRoutes";
import type { ActivityType } from "@/domain/activity/types";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import { ClusterPanel } from "./ClusterPanel";
import { YearPicker } from "./YearPicker";
import { TypePicker } from "./TypePicker";
import { HeatLegend } from "./HeatLegend";
import { RouteInfoCard } from "./RouteInfoCard";
import { useMapRoutes } from "./useMapRoutes";
import { coordLabel, matchesFilters, type HeatFilters } from "./mapUtils";

// Canonical order for the type filter (fastest -> easiest), matching the rest of the app.
const TYPE_ORDER: ActivityType[] = [
  "Sprint",
  "Anaerobic",
  "VO2Max",
  "Threshold",
  "Tempo",
  "Base",
  "Race",
];

interface Props {
  data: AllRoutesData;
}

export function GlobalMapClient({ data }: Props) {
  const { clusters, routeMeta } = data;
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [names, setNames] = useState<string[]>(() => clusters.map(coordLabel));

  const filters: HeatFilters = useMemo(
    () => ({ year: selectedYear, type: selectedType }),
    [selectedYear, selectedType],
  );

  const availableTypes = useMemo(() => {
    const present = new Set(routeMeta.map((m) => m.type));
    return TYPE_ORDER.filter((ty) => present.has(ty));
  }, [routeMeta]);

  const clusterStats = useMemo(
    () =>
      clusters.map((c) => {
        const indices = c.routeIndices.filter((i) => matchesFilters(routeMeta[i], filters));
        return {
          routeCount: indices.length,
          totalKm: Math.round(indices.reduce((s, i) => s + (routeMeta[i]?.distanceKm ?? 0), 0)),
        };
      }),
    [clusters, routeMeta, filters],
  );

  const visibleIndices = useMemo(
    () =>
      clusters[selectedIdx]?.routeIndices.filter((i) => matchesFilters(routeMeta[i], filters)) ?? [],
    [clusters, selectedIdx, routeMeta, filters],
  );

  // Ignore an inspected run once it leaves the screen (filter or zone change),
  // without a cascading setState-in-effect - just derive the effective selection.
  const effectiveRouteIdx =
    selectedRouteIdx != null && visibleIndices.includes(selectedRouteIdx) ? selectedRouteIdx : null;

  const { containerRef, resize } = useMapRoutes(
    data,
    selectedIdx,
    visibleIndices,
    effectiveRouteIdx,
    setSelectedRouteIdx,
  );

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

  const selectedMeta = effectiveRouteIdx != null ? routeMeta[effectiveRouteIdx] : undefined;

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

      <div
        className={[
          "absolute right-3 z-10 flex items-start gap-2",
          isFullscreen ? "top-[max(env(safe-area-inset-top),12px)]" : "top-3",
        ].join(" ")}
      >
        {availableTypes.length > 1 && (
          <TypePicker types={availableTypes} value={selectedType} onChange={setSelectedType} />
        )}
        <YearPicker years={data.years} value={selectedYear} onChange={setSelectedYear} />
      </div>

      {visibleIndices.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
            {t.pages.map.noRoutes}
          </span>
        </div>
      )}

      {selectedMeta ? (
        <RouteInfoCard
          meta={selectedMeta}
          onClose={() => setSelectedRouteIdx(null)}
          isFullscreen={isFullscreen}
        />
      ) : (
        <HeatLegend isFullscreen={isFullscreen} />
      )}

      <button
        onClick={() => setIsFullscreen((f) => !f)}
        aria-label={isFullscreen ? t.pages.map.exitFullscreen : t.pages.map.fullscreen}
        className={[
          "glass-map-chip absolute right-3 z-20 flex h-11 w-11 items-center justify-center transition-colors hover:bg-muted",
          isFullscreen ? "bottom-[max(env(safe-area-inset-bottom),12px)]" : "bottom-3",
        ].join(" ")}
      >
        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>
    </div>
  );
}
