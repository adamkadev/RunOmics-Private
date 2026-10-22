"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minimize, SlidersHorizontal } from "lucide-react";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { ACTIVITY_TYPES } from "@/domain/activity/types";
import { areaForCluster } from "@/domain/explore/areaForCluster";
import { medianStart } from "@/domain/explore/home";
import type { ExploreAreaRef } from "@/domain/explore/types";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatKm, formatNumber } from "@/lib/formatters";
import { useUrlParam } from "@/lib/useUrlParam";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import type { TerritoryCardContent } from "./TerritoryBand";
import { ClusterPanel } from "./ClusterPanel";
import { HeatFilterSheet } from "./HeatFilterSheet";
import { HeatLegend } from "./HeatLegend";
import { MapAttribution } from "@/components/ui/MapAttribution";
import { GlassLayers, GLASS_CIRCLE, glassClass } from "@/components/ui/GlassSurface";
import { useMapRoutes, type HomeRing } from "./useMapRoutes";
import { LayersButton } from "@/components/explore/LayersButton";
import { DistrictsLegend } from "@/components/explore/DistrictsLegend";
import { useDistrictsCoverage } from "@/components/explore/useDistrictsCoverage";
import { districtsCardContent } from "@/components/explore/districtsCard";
import { useDistrictsOverlay, useDistrictsSync } from "@/components/explore/useDistrictsOverlay";
import { initialMapLayer, parseMapLayer, readStoredMapLayer, storeMapLayer, type MapLayer } from "@/components/explore/mapLayer";
import {
  activeFilterCount,
  areaRows,
  coordLabel,
  computeAreaTerritory,
  matchesFilters,
  NO_HEAT_FILTERS,
  reachKm,
  reachLabel,
  type HeatFilters,
} from "./mapUtils";

interface Props {
  data: MapShellData;
  onContentChange?: (content: TerritoryCardContent | null) => void;
  /** The areas this deployment has Districts for (Explore); none hides the layers button. */
  exploreAreas?: readonly ExploreAreaRef[];
  /** "Plan a run in …" on the Districts card; without it the card has no button. */
  onPlanRun?: (unitId: string) => void;
}

const NO_AREAS: readonly ExploreAreaRef[] = [];
const NO_RUNS: readonly number[] = [];

export function GlobalMapClient({ data, onContentChange, exploreAreas = NO_AREAS, onPlanRun }: Props) {
  const { clusters, routeMeta } = data;
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  // Any number of types and years (Heatmap Filters 1c), set in the sheet.
  const [filters, setFilters] = useState<HeatFilters>(NO_HEAT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [names, setNames] = useState<string[]>(() => clusters.map(coordLabel));

  // Heat or Districts (Explore): the last choice, unless the link asks for
  // one - read once, when the map mounts, and remembered from then on. Never
  // written on load; a change by hand takes the link's layer out of the
  // address, so a remount (List and back, Back to this entry) keeps the hand's
  // choice instead of applying the link again.
  const [layerParam, setLayerParam] = useUrlParam("layer");
  const [linkedLayer] = useState<MapLayer | null>(() => parseMapLayer(layerParam));
  const [layer, setLayer] = useState<MapLayer>(() => initialMapLayer(layerParam, readStoredMapLayer()));
  useEffect(() => {
    if (linkedLayer) storeMapLayer(linkedLayer);
  }, [linkedLayer]);

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

  const availableTypes = useMemo(() => {
    const present = new Set(routeMeta.map((m) => m.type));
    return ACTIVITY_TYPES.filter((ty) => present.has(ty));
  }, [routeMeta]);

  const rows = useMemo(() => areaRows(clusters, routeMeta, filters), [clusters, routeMeta, filters]);

  // The runs of the area on screen under some filters: what the map draws,
  // and what the sheet's button counts.
  const areaRuns = useCallback(
    (f: HeatFilters) => clusters[selectedIdx]?.routeIndices.filter((i) => matchesFilters(routeMeta[i], f)) ?? [],
    [clusters, selectedIdx, routeMeta],
  );
  const visibleIndices = useMemo(() => areaRuns(filters), [areaRuns, filters]);

  const handleSelectCluster = useCallback((idx: number) => setSelectedIdx(idx), []);

  // Districts exist only where an area was built for the area on screen;
  // elsewhere the button hides and the map is the heat.
  const districtsArea = useMemo(() => {
    const cluster = clusters[selectedIdx];
    return cluster && exploreAreas.length > 0 ? areaForCluster(exploreAreas, cluster) : null;
  }, [clusters, selectedIdx, exploreAreas]);
  const districtsOn = layer === "districts" && !!districtsArea;
  const toggleLayer = useCallback(() => {
    const next: MapLayer = layer === "districts" ? "heat" : "districts";
    setLayer(next);
    storeMapLayer(next);
    if (layerParam !== null) setLayerParam(null);
  }, [layer, layerParam, setLayerParam]);

  // Distances run from where the runs start, whatever the filters (the
  // heat's ring follows them; a quartier's distance from home doesn't).
  const districtsHome = useMemo(() => {
    const cluster = clusters[selectedIdx];
    if (!districtsOn || !cluster) return null;
    return medianStart(cluster.routeIndices.flatMap((i) => (routes[i]?.[0] ? [routes[i]![0]!] : [])));
  }, [districtsOn, clusters, selectedIdx, routes]);

  const districts = useDistrictsCoverage({
    enabled: districtsOn,
    area: districtsArea,
    routes,
    clusterIndices: clusters[selectedIdx]?.routeIndices ?? NO_RUNS,
    visibleIndices,
    routeMeta,
    home: districtsHome,
  });
  const districtsState = useMemo(
    () => ({ area: districts.area, coverage: districts.coverage, visible: true, selectedId: null }),
    [districts.area, districts.coverage],
  );
  const overlay = useDistrictsOverlay(districtsState, districtsOn);

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
    const { types, years } = filters;
    const typeLabel = types.length === 1 ? t.activityTypes[types[0]!] : types.length > 1 ? t.pages.map.filters.types(types.length) : null;
    const eyebrow = [
      place ?? s.homeArea,
      ...(typeLabel ? [typeLabel] : []),
      years.length > 0 ? [...years].sort().reverse().join(", ") : t.pages.map.allYears,
    ].join(" · ");
    return {
      eyebrow,
      // Home is the busiest area; elsewhere the ring is around where the runs start.
      headline: s.headline(territory.percentVolume, reach, selectedIdx === data.defaultClusterIdx),
      stats: [
        { label: s.runsStat, value: String(territory.routeCount) },
        { label: s.kmStat, value: formatKm(territory.km), unit: t.units.km },
        { label: s.reachStat, value: formatNumber(reachKm(territory.medianReachKm)), unit: t.units.km },
      ],
    };
  }, [clusters, selectedIdx, territory, names, filters, data.defaultClusterIdx]);

  // In Districts the card talks about quartiers, under the same eyebrow.
  const { coverage: districtsCoverage, status: districtsStatus } = districts;
  const districtsCard = useMemo(
    () =>
      districtsOn && cardContent
        ? districtsCardContent(cardContent.eyebrow, { coverage: districtsCoverage, status: districtsStatus }, onPlanRun)
        : null,
    [districtsOn, cardContent, districtsCoverage, districtsStatus, onPlanRun],
  );
  const shownCard = districtsCard ?? cardContent;

  useEffect(() => {
    onContentChange?.(shownCard);
  }, [onContentChange, shownCard]);

  const { containerRef, resize, mapRef, mapReady } = useMapRoutes(data, routes, selectedIdx, visibleIndices, ring, isFullscreen, { overlay });
  useDistrictsSync(mapRef, mapReady, districtsState);

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
    Promise.all(clusters.map((c) => reverseGeocode(c.labelPoint[0], c.labelPoint[1], token))).then(
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
  const heatSummary = territory
    ? { runs: territory.routeCount, km: formatKm(territory.km), year: filters.years.length > 0 ? [...filters.years].sort().reverse().join(", ") : t.pages.map.allYears }
    : undefined;
  const filterCount = activeFilterCount(filters);
  const f = t.pages.map.filters;
  const circle = glassClass("regular", GLASS_CIRCLE);

  return (
    <div
      className={isFullscreen ? "fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 bg-background" : undefined}
      data-testid="heatmap"
    >
      {isFullscreen && (
        <>
          {/* Solid, full width, 12 pt: what WebKit samples at the top edge,
              so iOS draws no blur of its own over the row (the app's edge
              sampler, which the fullscreen map covers). */}
          <div data-testid="map-edge-sampler" className="fixed inset-x-0 top-[var(--safe-top)] z-40 h-3 bg-background" />
        </>
      )}

      {filtersOpen && (
        <HeatFilterSheet
          types={availableTypes}
          years={data.years}
          value={filters}
          count={(next) => areaRuns(next).length}
          onApply={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      <div
        className={
          isFullscreen
            ? "absolute inset-0 isolate bg-[var(--surface-2)]"
            : "relative isolate h-[360px] overflow-hidden rounded-[24px] bg-[var(--surface-2)] md:h-[560px]"
        }
        // The canvas and its glass controls: marked while the map moves (README §6.12.2).
        data-map-root
      >
        {/* Sized by a wrapper: MapLibre's own stylesheet makes its container
            position: relative, over any class set on it. */}
        <div className="absolute inset-0">
          <div ref={containerRef} role="img" aria-label={t.pages.map.title} className="h-full w-full" />
        </div>

        {/* The soft edge the row floats on (H1): over the map, under the
            row - in the map's root beside the row's glass. Outside it, over
            the whole root, its tint greyed the row out. */}
        {isFullscreen && (
          <div aria-hidden="true" data-testid="map-top-edge" className="map-top-edge">
            <i />
            <i />
          </div>
        )}

        {/* The filter row (Heatmap Filters 1b, Oct 2026): the location pill,
            one Filters circle for type and year, and fullscreen - three 44 pt
            glass controls that fit any phone, never scrolled, never cut. Over
            the map, in the map card or in fullscreen (Liquid Glass v3, §6.10,
            §7.8). */}
        <div
          data-testid="heat-filter-row"
          className={cn("absolute z-30 flex items-center gap-2", isFullscreen ? "inset-x-4 top-3" : "inset-x-2.5 top-2.5")}
        >
          <ClusterPanel rows={rows} names={names} selectedIdx={selectedIdx} onSelect={handleSelectCluster} />
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            aria-label={filterCount > 0 ? f.buttonActive(filterCount) : f.button}
            className={circle}
          >
            <GlassLayers />
            <SlidersHorizontal size={20} strokeWidth={2} aria-hidden="true" />
            {/* How many of type and year are narrowed; none, no badge. On
                the circle's top edge, never above it: in fullscreen the
                row starts at the edge sampler's foot, and the sampler,
                painted over the row, cut a badge 3 pt higher flat. */}
            {filterCount > 0 && (
              <span
                aria-hidden="true"
                data-testid="heat-filter-badge"
                className="absolute -right-[3px] top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground"
              >
                {filterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((on) => !on)}
            aria-label={isFullscreen ? t.pages.map.exitFullscreen : t.pages.map.fullscreen}
            className={circle}
          >
            <GlassLayers />
            {isFullscreen ? <Minimize size={20} strokeWidth={2} aria-hidden="true" /> : <Maximize size={20} strokeWidth={2} aria-hidden="true" />}
          </button>
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

        {/* The scale bottom left, the credits' ⓘ bottom right (3.0): both
            always on the map, in the page and in fullscreen alike. */}
        {isFullscreen ? (
          // The legend card, 24 pt from the edges (Liquid Glass v3, §6.10).
          <div className="pointer-events-none absolute inset-x-6 bottom-[max(24px,var(--safe-bottom))] z-10 flex flex-col items-end gap-2">
            {/* The layers button above the ⓘ, in the same right-hand column. */}
            {districtsArea && <LayersButton on={districtsOn} onToggle={toggleLayer} className="pointer-events-auto" />}
            <MapAttribution className="pointer-events-auto" />
            {districtsOn ? (
              // Districts keeps the heat card's box (drawn by nothing), so the
              // layers button and the ⓘ stay where the finger left them; its
              // solid legend sits at the foot, left (until S1, Phase 4).
              <div className="grid w-full">
                <HeatLegend space className="col-start-1 row-start-1 w-full" summary={heatSummary} />
                <DistrictsLegend className="pointer-events-auto col-start-1 row-start-1 self-end justify-self-start" />
              </div>
            ) : (
              <HeatLegend className="pointer-events-auto w-full" summary={heatSummary} />
            )}
          </div>
        ) : (
          <div className={`pointer-events-none absolute inset-x-3 z-10 flex flex-wrap items-end gap-x-3 gap-y-1.5 ${bottom}`}>
            {districtsOn ? <DistrictsLegend className="shrink-0" /> : <HeatLegend className="shrink-0" />}
            {districtsArea ? (
              // Explore's layers button (V1/V2) 10 pt above the ⓘ, in one
              // flex item with it: a legend that wraps to its own line (a long
              // one on a narrow phone) moves up alone, never under the button.
              // Its right edge lines up with the Expand circle's (10 pt in;
              // the ⓘ is 12). After it in the DOM, the ⓘ's credits open over it.
              <div className="ml-auto flex flex-col items-end gap-2.5">
                <LayersButton on={districtsOn} onToggle={toggleLayer} className="pointer-events-auto -mr-0.5" />
                <MapAttribution className="pointer-events-auto" />
              </div>
            ) : (
              <MapAttribution className="pointer-events-auto ml-auto" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
