"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe, Maximize, Minimize } from "lucide-react";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import type { ActivityType } from "@/domain/activity/types";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import { ClusterPanel } from "./ClusterPanel";
import { YearPicker } from "./YearPicker";
import { TypePicker } from "./TypePicker";
import { HeatLegend } from "./HeatLegend";
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
  data: MapShellData;
}

export function GlobalMapClient({ data }: Props) {
  const { clusters, routeMeta } = data;
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [worldView, setWorldView] = useState(false);
  const [names, setNames] = useState<string[]>(() => clusters.map(coordLabel));

  // GPS coordinates, sparse and keyed by absolute activity index - populated lazily
  // per zone (see effect below) so the world view and an unvisited zone never pay
  // for coordinate data they don't render. Undefined entries are already handled
  // throughout mapUtils.ts (buildGeoJSON/buildHeatGeoJSON skip missing routes).
  const [routes, setRoutes] = useState<[number, number][][]>([]);
  const loadedClusterIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const cluster = clusters[selectedIdx];
    if (!cluster || loadedClusterIds.current.has(cluster.id)) return;
    let cancelled = false;

    fetch(`/api/map/routes?cluster=${encodeURIComponent(cluster.id)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ routes: Record<string, [number, number][]> }>) : null))
      .then((json) => {
        if (cancelled || !json) return;
        loadedClusterIds.current.add(cluster.id);
        setRoutes((prev) => {
          const next = [...prev];
          for (const [idxStr, coords] of Object.entries(json.routes)) {
            next[Number(idxStr)] = coords;
          }
          return next;
        });
      })
      .catch(() => {
        // Best-effort: the zone just renders with no heat trace until a retry
        // (e.g. a re-select) succeeds.
      });

    return () => {
      cancelled = true;
    };
  }, [selectedIdx, clusters]);

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

  // Shared by the zone dropdown and the world-view bubbles, so either path exits
  // world view the same way and hands the camera back to the per-zone effect.
  const handleSelectCluster = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setWorldView(false);
  }, []);

  const clusterCounts = useMemo(() => clusterStats.map((s) => s.routeCount), [clusterStats]);

  const { containerRef, resize } = useMapRoutes(
    data,
    routes,
    selectedIdx,
    visibleIndices,
    worldView,
    clusterCounts,
    names,
    handleSelectCluster,
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

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-background" : "relative h-full w-full"}>
      <div ref={containerRef} role="img" aria-label={t.pages.map.title} className="h-full w-full" />

      <div
        className={[
          "absolute inset-x-3 z-10 flex items-start justify-between gap-2",
          isFullscreen ? "top-[max(env(safe-area-inset-top),12px)]" : "top-3",
        ].join(" ")}
      >
        <ClusterPanel
          clusters={clusters}
          names={names}
          stats={clusterStats}
          selectedIdx={selectedIdx}
          onSelect={handleSelectCluster}
        />

        <div className="flex shrink-0 items-start gap-2">
          {availableTypes.length > 1 && (
            <TypePicker types={availableTypes} value={selectedType} onChange={setSelectedType} />
          )}
          <YearPicker years={data.years} value={selectedYear} onChange={setSelectedYear} />
        </div>
      </div>

      {!process.env.NEXT_PUBLIC_MAPTILER_TOKEN && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
            {t.pages.map.mapUnavailable}
          </span>
        </div>
      )}

      {!worldView && visibleIndices.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
            {t.pages.map.noRoutes}
          </span>
        </div>
      )}

      {worldView ? (
        <span
          className={[
            "glass-map-chip pointer-events-none absolute left-3 z-10 px-3 py-2 text-xs font-medium text-subtle",
            isFullscreen
              ? "bottom-[calc(max(env(safe-area-inset-bottom),12px)+2.25rem)]"
              : "bottom-11",
          ].join(" ")}
        >
          {t.pages.map.worldViewHint}
        </span>
      ) : (
        <HeatLegend isFullscreen={isFullscreen} />
      )}

      <button
        onClick={() => setWorldView((w) => !w)}
        aria-label={worldView ? t.pages.map.exitWorldView : t.pages.map.worldView}
        aria-pressed={worldView}
        className={[
          "glass-map-chip absolute right-3 z-20 flex h-11 w-11 items-center justify-center transition-colors hover:bg-muted",
          worldView ? "text-accent-text" : "",
          isFullscreen ? "bottom-[calc(max(env(safe-area-inset-bottom),12px)+3.25rem)]" : "bottom-16",
        ].join(" ")}
      >
        <Globe size={16} />
      </button>

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
