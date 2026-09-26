"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Globe, Maximize, Minimize } from "lucide-react";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { ACTIVITY_TYPES, type ActivityType } from "@/domain/activity/types";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import type { TerritoryCardContent } from "./TerritoryBand";
import { ClusterPanel } from "./ClusterPanel";
import { YearPicker } from "./YearPicker";
import { TypePicker } from "./TypePicker";
import { HeatLegend } from "./HeatLegend";
import { useMapRoutes } from "./useMapRoutes";
import {
  MAP_CHIP_COUNT_INK,
  MAP_CHIP_NEUTRAL,
  coordLabel,
  computeAreaTerritory,
  computeWorldTerritory,
  matchesFilters,
  type HeatFilters,
} from "./mapUtils";

interface Props {
  data: MapShellData;
  onContentChange?: (content: TerritoryCardContent | null) => void;
}

/** A median radius under a kilometre reads "under 1 km", never "0 km". */
function radiusLabel(km: number): string {
  return km < 1 ? t.pages.map.territory.underOneKm : `${km} ${t.units.km}`;
}

export function GlobalMapClient({ data, onContentChange }: Props) {
  const { clusters, routeMeta } = data;
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [worldView, setWorldView] = useState(false);
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

  const handleSelectCluster = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setWorldView(false);
  }, []);

  // Three chips plus a count can outgrow the row at any width - the rail
  // scrolls rather than overlapping or wrapping, exactly like the Activities
  // filter row, with a fade that only appears once there's more to scroll to.
  const chipRailRef = useRef<HTMLDivElement>(null);
  const [chipFade, setChipFade] = useState(false);
  const updateChipFade = useCallback(() => {
    const el = chipRailRef.current;
    if (!el) return;
    setChipFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);
  useLayoutEffect(() => {
    updateChipFade();
    const el = chipRailRef.current;
    if (!el) return;
    const obs = new ResizeObserver(updateChipFade);
    obs.observe(el);
    // A viewport resize (rotation, browser chrome show/hide) changes the
    // rail's width via layout, but not always in a single reflow the
    // ResizeObserver's own callback batches before paint - a plain window
    // listener catches it as a fallback.
    window.addEventListener("resize", updateChipFade);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", updateChipFade);
    };
  }, [updateChipFade]);
  // The scroller's own box never changes size when a chip's label does (a
  // longer area name, a type getting picked) - only its scrollWidth does,
  // which ResizeObserver on the scroller itself won't catch.
  useEffect(() => {
    updateChipFade();
  }, [updateChipFade, selectedType, selectedYear, worldView, names, selectedIdx]);

  const clusterCounts = useMemo(() => clusterStats.map((s) => s.routeCount), [clusterStats]);
  const totalFilteredCount = useMemo(() => clusterStats.reduce((sum, s) => sum + s.routeCount, 0), [clusterStats]);

  // The card follows whatever area, filters and zoom level are on screen -
  // "all areas" at world zoom is itself a state the card has to name, not a
  // reason to keep showing the last selected place.
  const cardContent = useMemo<TerritoryCardContent | null>(() => {
    const s = t.pages.map.territory;
    if (worldView) {
      const world = computeWorldTerritory(clusters, names, routeMeta, filters);
      if (!world) return null;
      return {
        eyebrow: s.eyebrowWorld,
        headline: s.headlineWorld(world.areaCount, world.topSharePercent, /°[NS] /.test(world.topAreaName) ? s.homeArea : world.topAreaName),
        primaryStat: { value: String(world.routeCount), label: s.routesStat },
        secondaryStat: { value: String(world.areaCount), label: s.areasStat },
      };
    }

    const cluster = clusters[selectedIdx];
    if (!cluster) return null;
    const territory = computeAreaTerritory(cluster, routeMeta, routes, filters);
    if (!territory) return null;
    // Without a place name the area is "your home area", never its
    // coordinates: the fallback read "all your 0.0°N 150.0°W running" (G26).
    const areaName = names[selectedIdx];
    const place = areaName && areaName !== coordLabel(cluster) ? areaName : null;
    const radius = radiusLabel(territory.medianRadiusKm);
    return {
      eyebrow: s.eyebrowFor(place ?? s.homeArea),
      headline: place ? s.headline(territory.percentVolume, radius, place) : s.headlineHome(territory.percentVolume, radius),
      primaryStat: { value: String(territory.routeCount), label: s.routesStat },
      secondaryStat: { value: radius, label: s.radiusStat },
    };
  }, [worldView, clusters, selectedIdx, routeMeta, routes, filters, names]);

  useEffect(() => {
    onContentChange?.(cardContent);
  }, [onContentChange, cardContent]);

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
    <div className={isFullscreen ? "fixed inset-0 z-50 flex flex-col bg-background" : "flex h-full w-full flex-col"}>
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} role="img" aria-label={t.pages.map.title} className="h-full w-full" />

      {/* A solid scrim, not the individual chips' own translucency, is what
          keeps these readable once the map is panned under bright tiles.
          The row sits above the map canvas as a separate element - a drag
          that starts here never reaches maplibre's own pan handler, and the
          row has no transform of its own, so it never moves when the map does. */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex items-start gap-2 px-3 pb-2.5"
        style={{
          background: "var(--raised)",
          borderBottom: "1px solid var(--divider)",
          paddingTop: isFullscreen ? "max(env(safe-area-inset-top), 12px)" : "12px",
        }}
      >
        {/* The rail scrolls instead of wrapping or overlapping - three chips
            plus a count can outgrow the row at any width, and a chip that
            can touch its neighbour is the row being wrong, not the content. */}
        <div className="relative min-w-0 flex-1">
          <div
            ref={chipRailRef}
            onScroll={updateChipFade}
            className="flex items-start gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ClusterPanel
              clusters={clusters}
              names={names}
              stats={clusterStats}
              selectedIdx={selectedIdx}
              onSelect={handleSelectCluster}
              worldView={worldView}
              totalCount={totalFilteredCount}
            />
            {availableTypes.length > 1 && (
              <TypePicker types={availableTypes} value={selectedType} onChange={setSelectedType} />
            )}
            <YearPicker years={data.years} value={selectedYear} onChange={setSelectedYear} />
          </div>
          {chipFade && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-[26px]"
              style={{ background: "linear-gradient(90deg, transparent, var(--raised) 80%)" }}
            />
          )}
        </div>

        {/* The collapse button is a sibling of the scroller, never a chip
            inside it - that's what was pushing the chips into each other. */}
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            aria-label={t.pages.map.exitFullscreen}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] transition-colors hover:bg-foreground/[0.06]"
            style={{ ...MAP_CHIP_NEUTRAL }}
          >
            <Minimize size={16} />
          </button>
        )}
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
          "glass-map-chip absolute z-20 flex h-11 w-11 items-center justify-center transition-colors hover:bg-muted",
          worldView ? "text-accent-text" : "",
          isFullscreen ? "right-[max(env(safe-area-inset-right),10px)] bottom-[calc(max(env(safe-area-inset-bottom),10px)+3.25rem)]" : "right-2.5 bottom-16",
        ].join(" ")}
      >
        <Globe size={16} />
      </button>

      {/* Entering fullscreen is a bottom-right affordance (where the thumb
          already is); leaving it is the top-right control above, not this
          same spot - bottom-right during panning is too easy to hit by
          accident for an exit. */}
      {!isFullscreen && (
        <button
          onClick={() => setIsFullscreen(true)}
          aria-label={t.pages.map.fullscreen}
          className="glass-map-chip absolute right-2.5 bottom-2.5 z-20 flex h-11 w-11 items-center justify-center transition-colors hover:bg-muted"
        >
          <Maximize size={16} />
        </button>
      )}
    </div>

      <div
        style={{
          background: "var(--raised)",
          borderTop: "1px solid var(--divider)",
          padding: "7px 11px",
        }}
      >
        {/* The strip is dark in both themes, like the chip row above the map,
            so it takes the chips' fixed ink rather than the theme's. */}
        <span style={{ fontSize: "9.5px", color: MAP_CHIP_COUNT_INK }}>{t.pages.map.attribution}</span>
      </div>
    </div>
  );
}
