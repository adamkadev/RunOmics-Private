"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { ACTIVITY_TYPES, type ActivityType } from "@/domain/activity/types";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import type { TerritoryCardContent } from "./TerritoryBand";
import { ClusterPanel } from "./ClusterPanel";
import { FilterChip } from "./FilterChip";
import { HeatLegend } from "./HeatLegend";
import { useMapRoutes, type HomeRing } from "./useMapRoutes";
import {
  areaRows,
  coordLabel,
  computeAreaTerritory,
  matchesFilters,
  reachKm,
  reachLabel,
  type HeatFilters,
} from "./mapUtils";

interface Props {
  data: MapShellData;
  onContentChange?: (content: TerritoryCardContent | null) => void;
}

export function GlobalMapClient({ data, onContentChange }: Props) {
  const { clusters, routeMeta } = data;
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  const territory = useMemo(() => {
    const cluster = clusters[selectedIdx];
    return cluster ? computeAreaTerritory(cluster, routeMeta, routes, filters) : null;
  }, [clusters, selectedIdx, routeMeta, routes, filters]);

  // The ring on the map is the one the card's sentence names, at the
  // distance it states.
  const ring = useMemo<HomeRing | null>(
    () => (territory ? { center: territory.home, radiusKm: reachKm(territory.medianReachKm) } : null),
    [territory],
  );

  // The card follows the area and filters on screen: eyebrow, headline and
  // stats all read the same filtered set the map draws, share by km.
  const cardContent = useMemo<TerritoryCardContent | null>(() => {
    const s = t.pages.map.territory;
    const cluster = clusters[selectedIdx];
    if (!cluster || !territory) return null;
    // Without a place name the area is "your home area", never its
    // coordinates: the fallback read "all your 0.0°N 150.0°W running" (G26).
    const areaName = names[selectedIdx];
    const place = areaName && areaName !== coordLabel(cluster) ? areaName : null;
    const reach = reachLabel(territory.medianReachKm);
    const eyebrow = [
      place ?? s.homeArea,
      ...(selectedType ? [t.activityTypes[selectedType]] : []),
      selectedYear ?? t.pages.map.allYears,
    ].join(" · ");
    return {
      eyebrow,
      // Home is the busiest area; elsewhere the ring is around where the runs start.
      headline: s.headline(territory.percentVolume, reach, selectedIdx === data.defaultClusterIdx),
      stats: [
        { label: s.runsStat, value: String(territory.routeCount) },
        { label: s.kmStat, value: territory.km.toLocaleString(t.locale), unit: t.units.km },
        { label: s.reachStat, value: reachKm(territory.medianReachKm).toLocaleString(t.locale), unit: t.units.km },
      ],
    };
  }, [clusters, selectedIdx, territory, names, selectedType, selectedYear, data.defaultClusterIdx]);

  useEffect(() => {
    onContentChange?.(cardContent);
  }, [onContentChange, cardContent]);

  const { containerRef, resize } = useMapRoutes(data, routes, selectedIdx, visibleIndices, ring);

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

  // Bottom overlays sit clear of the home indicator in fullscreen.
  const bottom = isFullscreen ? "bottom-[max(env(safe-area-inset-bottom),12px)]" : "bottom-3";

  return (
    <div
      className={isFullscreen ? "fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex flex-col bg-background" : "flex flex-col gap-3.5"}
      data-testid="heatmap"
    >
      {/* The chips on their own row under the title (v4.17), wrapping rather
          than cutting the area's name; in fullscreen, the header row with the
          collapse button. */}
      <div
        className={[
          "flex flex-wrap items-center gap-2",
          isFullscreen ? "shrink-0 border-b border-border bg-card px-3 py-2" : "mt-1",
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
            className="map-overlay ml-auto flex size-11 shrink-0 items-center justify-center rounded-[12px] text-[var(--text-2)]"
          >
            <Minimize size={16} />
          </button>
        )}
      </div>

      <div
        className={
          isFullscreen
            ? "relative min-h-0 flex-1 bg-[var(--surface-2)]"
            : "relative h-[360px] overflow-hidden rounded-2xl border border-border bg-[var(--surface-2)] md:h-[560px]"
        }
      >
        {/* Sized by a wrapper: MapLibre's own stylesheet makes its container
            position: relative, over any class set on it. */}
        <div className="absolute inset-0">
          <div ref={containerRef} role="img" aria-label={t.pages.map.title} className="h-full w-full" />
        </div>

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

        {!isFullscreen && (
          <button
            onClick={() => setIsFullscreen(true)}
            aria-label={t.pages.map.fullscreen}
            className="map-overlay absolute right-3 top-3 z-20 flex size-11 items-center justify-center rounded-[12px] text-[var(--text-2)]"
          >
            <Maximize size={16} />
          </button>
        )}

        {/* The scale bottom left, the licence line bottom right (v4.17): both
            always on the map, in the page and in fullscreen alike. Where the
            two do not fit on one line - a phone - the credit takes the
            corner and the scale sits just above it, never across it. */}
        <div className={`pointer-events-none absolute inset-x-3 z-10 flex flex-wrap items-end gap-x-3 gap-y-1.5 ${bottom}`}>
          <HeatLegend className="shrink-0" />
          <span
            className="ml-auto text-right text-caption leading-tight text-subtle"
            data-testid="map-attribution"
          >
            {/* Each credit whole: a narrow map wraps between them, not inside one. */}
            {t.pages.map.attribution.split(" · ").map((credit, i) => (
              <Fragment key={credit}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">{credit}</span>
              </Fragment>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
