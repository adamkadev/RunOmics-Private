"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Maximize, Minimize } from "lucide-react";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { ACTIVITY_TYPES, type ActivityType } from "@/domain/activity/types";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import type { TerritoryCardContent } from "./TerritoryBand";
import { ClusterPanel } from "./ClusterPanel";
import { FilterChip } from "./FilterChip";
import { HeatLegend } from "./HeatLegend";
import { useMapRoutes } from "./useMapRoutes";
import {
  MAP_CHIP_NEUTRAL,
  areaRows,
  coordLabel,
  computeAreaTerritory,
  matchesFilters,
  type HeatFilters,
} from "./mapUtils";

interface Props {
  data: MapShellData;
  onContentChange?: (content: TerritoryCardContent | null) => void;
}

/**
 * The median radius as an upper bound: half the runs stay within it, so it
 * rounds up - "1 km" for 0.6, "1.3 km" for 1.21 - and never reads "0 km".
 */
export function radiusLabel(km: number): string {
  const up = km <= 1 ? 1 : Math.ceil(km * 10) / 10;
  return `${up.toLocaleString(t.locale)} ${t.units.km}`;
}

export function GlobalMapClient({ data, onContentChange }: Props) {
  const { clusters, routeMeta } = data;
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
  const [names, setNames] = useState<string[]>(() => clusters.map(coordLabel));

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
    return ACTIVITY_TYPES.filter((ty) => present.has(ty));
  }, [routeMeta]);

  const rows = useMemo(() => areaRows(clusters, routeMeta, filters), [clusters, routeMeta, filters]);

  const visibleIndices = useMemo(
    () =>
      clusters[selectedIdx]?.routeIndices.filter((i) => matchesFilters(routeMeta[i], filters)) ?? [],
    [clusters, selectedIdx, routeMeta, filters],
  );

  const handleSelectCluster = useCallback((idx: number) => setSelectedIdx(idx), []);

  // The card follows the area and filters on screen: eyebrow, headline and
  // stats all read the same filtered set the map draws, share by km.
  const cardContent = useMemo<TerritoryCardContent | null>(() => {
    const s = t.pages.map.territory;
    const cluster = clusters[selectedIdx];
    if (!cluster) return null;
    const territory = computeAreaTerritory(cluster, routeMeta, routes, filters);
    if (!territory) return null;
    // Without a place name the area is "your home area", never its
    // coordinates: the fallback read "all your 0.0°N 150.0°W running" (G26).
    const areaName = names[selectedIdx];
    const place = areaName && areaName !== coordLabel(cluster) ? areaName : null;
    const radius = radiusLabel(territory.medianRadiusKm);
    const eyebrow = [
      place ?? s.homeArea,
      ...(selectedType ? [t.activityTypes[selectedType]] : []),
      selectedYear ?? t.pages.map.allYears,
    ].join(" · ");
    return {
      eyebrow,
      headline: place ? s.headline(territory.percentVolume, place, radius) : s.headlineHome(territory.percentVolume, radius),
      stats: [
        { value: String(territory.routeCount), label: s.runsStat },
        { value: territory.km.toLocaleString(t.locale), label: s.kmStat },
        { value: radius, label: s.radiusStat },
      ],
    };
  }, [clusters, selectedIdx, routeMeta, routes, filters, names, selectedType, selectedYear]);

  useEffect(() => {
    onContentChange?.(cardContent);
  }, [onContentChange, cardContent]);

  const { containerRef, resize } = useMapRoutes(data, routes, selectedIdx, visibleIndices);

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

  const attributionButton = (overlay: boolean) => (
    <button
      onClick={() => setShowAttribution((v) => !v)}
      aria-label={t.pages.map.attributionLabel}
      aria-expanded={showAttribution}
      className={[
        "flex shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground",
        overlay
          ? "glass-map-chip absolute bottom-[calc(max(env(safe-area-inset-bottom),12px)+22px)] right-3 z-10 h-[30px] w-[30px]"
          : "h-[22px] w-[22px]",
      ].join(" ")}
    >
      <Info size={overlay ? 14 : 12} />
    </button>
  );

  return (
    <div
      className={isFullscreen ? "fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex flex-col bg-background" : "flex flex-col gap-3"}
      data-testid="heatmap"
    >
      {/* The chips: in the page flow, or the fullscreen header with the
          collapse button. All three fit one row at 375 pt; the area name
          truncates first. */}
      <div
        className={[
          "flex items-center gap-2",
          isFullscreen ? "shrink-0 border-b border-border bg-card px-3 py-2" : "",
        ].join(" ")}
      >
        <ClusterPanel rows={rows} names={names} selectedIdx={selectedIdx} onSelect={handleSelectCluster} />
        {availableTypes.length > 1 && (
          <FilterChip
            allLabel={t.pages.map.allTypes}
            options={availableTypes}
            value={selectedType}
            label={(ty) => t.activityTypes[ty]}
            onChange={setSelectedType}
          />
        )}
        <FilterChip
          allLabel={t.pages.map.allYears}
          options={data.years}
          value={selectedYear}
          label={(y) => y}
          onChange={setSelectedYear}
        />
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            aria-label={t.pages.map.exitFullscreen}
            className="ml-auto flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] text-foreground"
            style={{ border: MAP_CHIP_NEUTRAL.border }}
          >
            <Minimize size={16} />
          </button>
        )}
      </div>

      <div className={isFullscreen ? "relative min-h-0 flex-1" : "overflow-hidden rounded-[22px] border border-border bg-card"}>
        <div className={isFullscreen ? "absolute inset-0" : "relative h-[360px]"}>
          <div ref={containerRef} role="img" aria-label={t.pages.map.title} className="h-full w-full" />

          {!process.env.NEXT_PUBLIC_MAPTILER_TOKEN && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
                {t.pages.map.mapUnavailable}
              </span>
            </div>
          )}

          {visibleIndices.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
                {t.pages.map.noRoutes}
              </span>
            </div>
          )}

          {/* Nothing on the routes but this (v4.8): legend and attribution
              live in the footer row below. */}
          {!isFullscreen && (
            <button
              onClick={() => setIsFullscreen(true)}
              aria-label={t.pages.map.fullscreen}
              className="glass-map-chip absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-[10px]"
            >
              <Maximize size={15} />
            </button>
          )}

          {isFullscreen && (
            <>
              <HeatLegend overlay />
              {attributionButton(true)}
            </>
          )}
          {isFullscreen && showAttribution && (
            <span className="glass-map-chip absolute bottom-[calc(max(env(safe-area-inset-bottom),12px)+60px)] right-3 z-10 rounded-[10px] px-3 py-1.5 text-caption text-muted-foreground">
              {t.pages.map.attribution}
            </span>
          )}
        </div>

        {!isFullscreen && (
          <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <HeatLegend />
              {attributionButton(false)}
            </div>
            {showAttribution && <span className="text-caption text-muted-foreground">{t.pages.map.attribution}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
