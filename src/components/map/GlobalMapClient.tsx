"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minimize, SlidersHorizontal } from "lucide-react";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { ACTIVITY_TYPES } from "@/domain/activity/types";
import { areaForCluster } from "@/domain/explore/areaForCluster";
import { medianStart } from "@/domain/explore/home";
import { circleOf } from "@/domain/explore/avoidSpots";
import type { ExploreAreaRef } from "@/domain/explore/types";
import { TEST_MAPS } from "@/lib/maptiler";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatKm, formatNumber } from "@/lib/formatters";
import { useUrlParam } from "@/lib/useUrlParam";
import { MAP_PADDING, type CameraPadding, type LngLatBounds } from "@/lib/routeFrame";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import type { TerritoryCardContent } from "./TerritoryBand";
import { ClusterPanel } from "./ClusterPanel";
import { HeatFilterSheet } from "./HeatFilterSheet";
import { HeatLegend } from "./HeatLegend";
import { MapAttribution, type MapCredit } from "@/components/ui/MapAttribution";
import { GlassLayers, GLASS_CIRCLE, glassClass } from "@/components/ui/GlassSurface";
import { useMapRoutes, type HomeRing } from "./useMapRoutes";
import { clusterTracks, type ClusterTracks } from "./mapData";
import { LayersButton } from "@/components/explore/LayersButton";
import { DistrictsLegend } from "@/components/explore/DistrictsLegend";
import { useDistrictsCoverage } from "@/components/explore/useDistrictsCoverage";
import { districtsCardContent } from "@/components/explore/districtsCard";
import { useDistrictsOverlay, useDistrictsSync } from "@/components/explore/useDistrictsOverlay";
import { initialMapLayer, parseMapLayer, readStoredMapLayer, storeMapLayer, type MapLayer } from "@/components/explore/mapLayer";
import { NextQuartierCard } from "@/components/explore/NextQuartierCard";
import { QuartierSheet } from "@/components/explore/QuartierSheet";
import { useDistrictsTap, useQuartierCamera } from "@/components/explore/useQuartierMap";
import { RouteGeneratorMode } from "@/components/explore/RouteGeneratorMode";
import { generatorUnit, useExploreGenerator } from "@/components/explore/useExploreGenerator";
import {
  easyPaceOf,
  lineBounds,
  medianOf,
  unionBounds,
  type ExplorePlan,
} from "@/components/explore/routeGenerator";
import type { RouteDrawing } from "@/components/explore/routeLayer";
import { combineOverlays, useRouteOverlay, useRouteSync } from "@/components/explore/useRouteOverlay";
import { QUARTIER_EASE_MS, quartierPadding, sheetBoxOf, unitBounds } from "@/components/explore/quartierCamera";
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
  /** What `data` and the tracks are fetched under. */
  version: string;
  onContentChange?: (content: TerritoryCardContent | null) => void;
  /** Areas with Districts; none hides the layers button. */
  exploreAreas?: readonly ExploreAreaRef[];
  explorePlans?: readonly ExplorePlan[];
  /** Unit id → the day it passed 90 %, worked out on the server. */
  completedSince?: Readonly<Record<string, string>>;
  /** 'YYYY-MM-DD', on this device's clock. */
  today?: string | null;
}

const NO_AREAS: readonly ExploreAreaRef[] = [];
const NO_RUNS: readonly number[] = [];
const NO_CREDITS: readonly MapCredit[] = [];
const NO_PLANS: readonly ExplorePlan[] = [];
const NO_TRACKS: [number, number][][] = [];

/** Until the panel is measured: it stands about 430 pt tall on a phone. */
const GENERATOR_PADDING: CameraPadding = { top: 72, right: 24, bottom: 460, left: 24 };

/** Close enough to see which street the circle covers. */
const SPOT_ZOOM = 16;

const samePadding = (a: CameraPadding | null, b: CameraPadding | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left);

const bboxBounds = ([minLon, minLat, maxLon, maxLat]: readonly [number, number, number, number]): LngLatBounds => ({ minLon, minLat, maxLon, maxLat });

interface ClusterTracksState {
  routes: [number, number][][];
  /** The last fetch for this cluster failed: nothing would come without a retry. */
  failed: boolean;
  retry: () => void;
}

/** A cluster's tracks, gathered by global route index as each cluster arrives. */
function useClusterTracks(version: string, clusterId: string | null): ClusterTracksState {
  const [tracks, setTracks] = useState<{ version: string; routes: [number, number][][]; loaded: Set<string> }>(
    () => ({ version, routes: [], loaded: new Set() }),
  );
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${version}|${clusterId}`;
  const failed = clusterId !== null && failedFor === key;

  useEffect(() => {
    if (clusterId === null) return;
    let cancelled = false;
    void clusterTracks(version, clusterId).then((answer: ClusterTracks | null) => {
      if (cancelled) return;
      if (!answer) {
        setFailedFor(`${version}|${clusterId}`);
        return;
      }
      setFailedFor(null);
      setTracks((prev) => {
        const same = prev.version === version;
        if (same && prev.loaded.has(clusterId)) return prev;
        const routes = same ? [...prev.routes] : [];
        for (const [idxStr, coords] of Object.entries(answer)) routes[Number(idxStr)] = coords;
        return { version, routes, loaded: new Set(same ? [...prev.loaded, clusterId] : [clusterId]) };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [version, clusterId, attempt]);

  const retry = useCallback(() => {
    setFailedFor(null);
    setAttempt((n) => n + 1);
  }, []);

  // A phone back from a tunnel or from the background tries again by itself.
  useEffect(() => {
    if (!failed) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [failed, retry]);

  return { routes: tracks.version === version ? tracks.routes : NO_TRACKS, failed, retry };
}

export function GlobalMapClient({ data, version, onContentChange, exploreAreas = NO_AREAS, explorePlans = NO_PLANS, completedSince, today = null }: Props) {
  const { clusters, routeMeta } = data;
  // A link's area (the Explored card's other areas) opens its busiest cluster; the hand's choice drops it.
  const [areaParam, setAreaParam] = useUrlParam("area");
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const linked = areaParam ? clusters.findIndex((cluster) => areaForCluster(exploreAreas, cluster)?.id === areaParam) : -1;
    return linked >= 0 ? linked : data.defaultClusterIdx;
  });
  const [filters, setFilters] = useState<HeatFilters>(NO_HEAT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // By hand only; the generator expands the map too (isFullscreen).
  const [expanded, setExpanded] = useState(false);
  const [names, setNames] = useState<string[]>(() => clusters.map(coordLabel));

  // The generator's distance when no plan gives one.
  const medianKm = useMemo(() => medianOf(routeMeta, clusters[selectedIdx]?.routeIndices ?? NO_RUNS, (m) => m.distanceKm), [routeMeta, clusters, selectedIdx]);
  const easyPace = useMemo(() => easyPaceOf(routeMeta, clusters[selectedIdx]?.routeIndices ?? NO_RUNS, today), [routeMeta, clusters, selectedIdx, today]);

  const [quartierParam, setQuartierParam] = useUrlParam("quartier");
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const districtsArea = useMemo(() => {
    const cluster = clusters[selectedIdx];
    return cluster && exploreAreas.length > 0 ? areaForCluster(exploreAreas, cluster) : null;
  }, [clusters, selectedIdx, exploreAreas]);
  const onGeneratorReturn = useCallback((back: { expanded: boolean; unitId: string | null }) => {
    setExpanded(back.expanded);
    setOpenUnitId(back.unitId);
  }, []);
  const closeSheet = useCallback(() => setOpenUnitId(null), []);
  const explore = useExploreGenerator({
    clusters,
    defaultClusterIdx: data.defaultClusterIdx,
    exploreAreas,
    explorePlans,
    today,
    districtsArea,
    medianKm,
    easyPace,
    expanded,
    openUnitId,
    onReturn: onGeneratorReturn,
    onOpen: closeSheet,
  });
  const { generator, generatorOpen, linked: linkedGenerator, avoid, drawn: drawnRoute, start: routeStart, takeClosedOpener } = explore;
  const { setMarking: setAvoidMarking, marking: avoidMarking } = avoid;
  const closeGenerator = explore.close;

  // Read once, on mount. A change by hand takes the link's layer out of the
  // address, so a remount (List and back) keeps the hand's choice instead of
  // applying the link again.
  const [layerParam, setLayerParam] = useUrlParam("layer");
  const [linkedLayer] = useState<MapLayer | null>(() => parseMapLayer(layerParam));
  const [layer, setLayer] = useState<MapLayer>(() => (linkedGenerator ? "districts" : initialMapLayer(layerParam, readStoredMapLayer())));
  useEffect(() => {
    if (linkedLayer) storeMapLayer(linkedLayer);
  }, [linkedLayer]);

  const [linkedQuartier, setLinkedQuartier] = useState<string | null>(() => (linkedGenerator ? null : quartierParam));

  const { routes, failed: tracksFailed, retry: retryTracks } = useClusterTracks(version, clusters[selectedIdx]?.id ?? null);

  const availableTypes = useMemo(() => {
    const present = new Set(routeMeta.map((m) => m.type));
    return ACTIVITY_TYPES.filter((ty) => present.has(ty));
  }, [routeMeta]);

  const rows = useMemo(() => areaRows(clusters, routeMeta, filters), [clusters, routeMeta, filters]);

  // Also what the sheet's button counts, under the sheet's own filters.
  const areaRuns = useCallback(
    (f: HeatFilters) => clusters[selectedIdx]?.routeIndices.filter((i) => matchesFilters(routeMeta[i], f)) ?? [],
    [clusters, selectedIdx, routeMeta],
  );
  const visibleIndices = useMemo(() => areaRuns(filters), [areaRuns, filters]);

  const handleSelectCluster = useCallback(
    (idx: number) => {
      setSelectedIdx(idx);
      if (areaParam !== null) setAreaParam(null);
    },
    [areaParam, setAreaParam],
  );

  const isFullscreen = expanded || generatorOpen;
  const districtsOn = (layer === "districts" || generatorOpen) && !!districtsArea;
  const coverageRoutes = districtsOn ? routes : NO_TRACKS;
  const toggleLayer = useCallback(() => {
    const next: MapLayer = layer === "districts" ? "heat" : "districts";
    setLayer(next);
    storeMapLayer(next);
    if (layerParam !== null) setLayerParam(null);
    setLinkedQuartier(null);
    setOpenUnitId(null);
    if (quartierParam !== null) setQuartierParam(null);
  }, [layer, layerParam, setLayerParam, quartierParam, setQuartierParam]);

  // Every run's start, whatever the filters: a quartier's distance from home
  // doesn't follow them.
  const districtsHome = useMemo(() => {
    const cluster = clusters[selectedIdx];
    if (!districtsOn || !cluster) return null;
    return medianStart(cluster.routeIndices.flatMap((i) => (coverageRoutes[i]?.[0] ? [coverageRoutes[i]![0]!] : [])));
  }, [districtsOn, clusters, selectedIdx, coverageRoutes]);

  const districts = useDistrictsCoverage({
    enabled: districtsOn,
    area: districtsArea,
    routes: coverageRoutes,
    clusterIndices: clusters[selectedIdx]?.routeIndices ?? NO_RUNS,
    visibleIndices,
    routeMeta,
    home: districtsHome,
  });
  const { area: districtsFile, coverage: districtsCoverage, status: districtsStatus } = districts;

  // Adjusted while rendering, as React has state follow state.
  if (linkedQuartier !== null && districtsOn && districtsStatus === "ready" && districtsCoverage) {
    setLinkedQuartier(null);
    if (districtsCoverage.units.some((u) => u.id === linkedQuartier)) setOpenUnitId(linkedQuartier);
  }
  const openUnit = (districtsOn && !generatorOpen && openUnitId && districtsCoverage?.units.find((u) => u.id === openUnitId)) || null;
  const sheetOpen = openUnit !== null;
  const nextUnit = (districtsOn && districtsCoverage?.nextId && districtsCoverage.units.find((u) => u.id === districtsCoverage.nextId)) || null;
  const closeQuartier = useCallback(() => {
    setOpenUnitId(null);
    if (quartierParam !== null) setQuartierParam(null);
  }, [quartierParam, setQuartierParam]);

  const nextCardRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const onPlanRun = districtsArea ? explore.planRun : undefined;

  const generatorUnitId = generator?.unitId ?? null;
  const target = useMemo(
    () => (generatorOpen ? generatorUnit(districtsFile, districtsCoverage, generatorUnitId) : null),
    [generatorOpen, districtsFile, districtsCoverage, generatorUnitId],
  );

  const districtsState = useMemo(
    () => ({
      area: districtsFile,
      coverage: districtsCoverage,
      visible: true,
      selectedId: openUnit?.id ?? null,
      // The generator names its quartier alone; none until it is known.
      labelOnly: generatorOpen ? (target?.id ?? "") : null,
    }),
    [districtsFile, districtsCoverage, openUnit?.id, generatorOpen, target?.id],
  );
  const districtsOverlay = useDistrictsOverlay(districtsState, districtsOn);

  // Home is drawn here only, never sent anywhere.
  const startPoint = routeStart.origin;
  const avoidCircles = useMemo(() => avoid.spots.map(circleOf), [avoid.spots]);
  const routeDrawing = useMemo<RouteDrawing | null>(() => {
    if (!generatorOpen) return null;
    if (drawnRoute) {
      return { coordinates: drawnRoute.candidate.coordinates, newSteps: drawnRoute.newSteps, from: startPoint ?? districtsHome, avoid: avoidCircles };
    }
    return startPoint || avoidCircles.length ? { coordinates: [], newSteps: [], from: startPoint, avoid: avoidCircles } : null;
  }, [generatorOpen, drawnRoute, districtsHome, startPoint, avoidCircles]);
  const routeOverlay = useRouteOverlay(routeDrawing, generatorOpen);
  const overlay = useMemo(() => combineOverlays(districtsOverlay, routeOverlay), [districtsOverlay, routeOverlay]);

  const territory = useMemo(() => {
    const cluster = clusters[selectedIdx];
    return cluster ? computeAreaTerritory(cluster, routeMeta, routes, filters) : null;
  }, [clusters, selectedIdx, routeMeta, routes, filters]);

  // At the distance the card's sentence states.
  const ring = useMemo<HomeRing | null>(
    () => (territory ? { center: territory.home, radiusKm: reachKm(territory.medianReachKm) } : null),
    [territory],
  );

  const cardContent = useMemo<TerritoryCardContent | null>(() => {
    const s = t.pages.map.territory;
    const cluster = clusters[selectedIdx];
    if (!cluster || !territory) return null;
    // Not the coordinate label: the sentence would read "all your 0.0°N
    // 150.0°W running".
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
      headline: s.headline(territory.percentVolume, reach, selectedIdx === data.defaultClusterIdx),
      stats: [
        { label: s.runsStat, value: String(territory.routeCount) },
        { label: s.kmStat, value: formatKm(territory.km), unit: t.units.km },
        { label: s.reachStat, value: formatNumber(reachKm(territory.medianReachKm)), unit: t.units.km },
      ],
    };
  }, [clusters, selectedIdx, territory, names, filters, data.defaultClusterIdx]);

  const districtsCard = useMemo(
    () =>
      districtsOn && cardContent
        ? districtsCardContent(
            cardContent.eyebrow,
            { coverage: districtsCoverage, status: tracksFailed && !districtsCoverage ? "error" : districtsStatus },
            onPlanRun,
            tracksFailed ? retryTracks : undefined,
          )
        : null,
    [districtsOn, cardContent, districtsCoverage, districtsStatus, onPlanRun, tracksFailed, retryTracks],
  );
  const shownCard = districtsCard ?? cardContent;

  useEffect(() => {
    onContentChange?.(shownCard);
  }, [onContentChange, shownCard]);

  const districtsBbox = districtsOn && isFullscreen && !generatorOpen ? districtsArea?.bbox : undefined;
  const targetId = target?.id ?? null;
  const generatorBounds = useMemo(
    () =>
      generatorOpen && targetId
        ? unionBounds(
            unionBounds(unitBounds(districtsFile, targetId), drawnRoute ? lineBounds(drawnRoute.candidate.coordinates) : null),
            startPoint ? lineBounds([startPoint]) : null,
          )
        : null,
    [generatorOpen, targetId, districtsFile, drawnRoute, startPoint],
  );
  const fitOverride = useMemo(
    () => (generatorOpen ? generatorBounds : districtsBbox ? bboxBounds(districtsBbox) : null),
    [generatorOpen, generatorBounds, districtsBbox],
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPadding, setPanelPadding] = useState<CameraPadding | null>(null);
  const { containerRef, resize, mapRef, mapReady } = useMapRoutes(data, routes, selectedIdx, visibleIndices, ring, isFullscreen, {
    overlay,
    fitOverride,
    fitOverridePadding: generatorOpen ? (panelPadding ?? GENERATOR_PADDING) : MAP_PADDING.districtsFullscreen,
  });
  useDistrictsSync(mapRef, mapReady, districtsState);
  useRouteSync(mapRef, mapReady, routeDrawing);

  const locatedTap = avoid.located?.tap ?? 0;
  const locatedAt = avoid.located ? ([avoid.located.spot.lon, avoid.located.spot.lat] as [number, number]) : null;
  // Read by the effect, which flies once per tap: a new padding or radius alone does not fly again.
  const locatedRef = useRef({ center: locatedAt, padding: panelPadding ?? GENERATOR_PADDING });
  useLayoutEffect(() => {
    locatedRef.current = { center: locatedAt, padding: panelPadding ?? GENERATOR_PADDING };
  });
  useEffect(() => {
    const map = mapRef.current;
    const { center, padding } = locatedRef.current;
    if (!mapReady || !map || !center || locatedTap === 0) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    map.easeTo({ center, zoom: Math.max(map.getZoom(), SPOT_ZOOM), padding, duration: reduce ? 0 : QUARTIER_EASE_MS });
  }, [mapRef, mapReady, locatedTap]);

  // Measured on its layout box: its rise is a transform.
  useEffect(() => {
    if (!generatorOpen) return;
    const measure = () => {
      const box = containerRef.current?.getBoundingClientRect();
      const sheet = sheetBoxOf(panelRef.current);
      if (!box || !sheet) return;
      const padding = quartierPadding({
        mapTop: box.top,
        mapBottom: box.bottom,
        mapLeft: box.left,
        mapRight: box.right,
        sheetTop: sheet.top,
        sheetBottom: sheet.bottom,
        sheetLeft: sheet.left,
        sheetRight: sheet.right,
      });
      setPanelPadding((prev) => (samePadding(prev, padding) ? prev : padding));
    };
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (panelRef.current) observer?.observe(panelRef.current);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [generatorOpen, containerRef]);
  const generatorWasOpen = useRef(generatorOpen);
  useEffect(() => {
    if (generatorWasOpen.current === generatorOpen) return;
    generatorWasOpen.current = generatorOpen;
    if (generatorOpen) return;
    const opener = takeClosedOpener();
    // A quartier's sheet back on screen takes focus itself.
    if (sheetOpen) return;
    const back = opener?.element?.isConnected ? opener.element : opener?.fromNextCard ? nextCardRef.current : null;
    (back ?? expandRef.current)?.focus({ preventScroll: true });
  }, [generatorOpen, sheetOpen, takeClosedOpener]);

  // Not under the generator, whose panel is the sheet there.
  useDistrictsTap(
    mapRef,
    mapReady,
    (unitId) => {
      if (districtsOn && !generatorOpen) setOpenUnitId(unitId);
    },
    explore.mapPick,
  );
  useQuartierCamera(mapRef, mapReady, openUnit?.id ?? null, districtsFile);

  useSetFullscreenChromeHidden(isFullscreen);

  useEffect(() => {
    resize();
  }, [isFullscreen, resize]);

  // An open quartier sheet takes Escape itself.
  useEffect(() => {
    if (!isFullscreen || sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (avoidMarking) setAvoidMarking(false);
      else if (generatorOpen) closeGenerator();
      else setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen, sheetOpen, avoidMarking, setAvoidMarking, generatorOpen, closeGenerator]);

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

  const bottom = isFullscreen ? "bottom-[max(env(safe-area-inset-bottom),12px)]" : "bottom-3";
  const heatSummary = territory
    ? { runs: territory.routeCount, km: formatKm(territory.km), year: filters.years.length > 0 ? [...filters.years].sort().reverse().join(", ") : t.pages.map.allYears }
    : undefined;
  const filterCount = activeFilterCount(filters);
  const f = t.pages.map.filters;
  const circle = glassClass("regular", GLASS_CIRCLE);
  // The base map already credits OpenStreetMap.
  const districtCredits = useMemo<readonly MapCredit[]>(
    () => districtsFile?.runomics.sources.filter((src) => !src.label.includes("OpenStreetMap")).map((src) => ({ text: src.label, href: src.url })) ?? NO_CREDITS,
    [districtsFile],
  );
  const credits = districtsOn ? districtCredits : undefined;

  return (
    <div
      className={isFullscreen ? "fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 bg-background" : undefined}
      data-testid="heatmap"
    >
      {isFullscreen && (
        <>
          {/* What WebKit samples at the top edge, so iOS draws no blur of its
              own over the row. */}
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

      {openUnit && <QuartierSheet unit={openUnit} completeSince={completedSince?.[openUnit.id] ?? null} onClose={closeQuartier} onPlanRun={onPlanRun} />}

      <div
        className={
          isFullscreen
            ? "absolute inset-0 isolate bg-[var(--surface-2)]"
            : "relative isolate h-[360px] overflow-hidden rounded-[24px] bg-[var(--surface-2)] md:h-[560px]"
        }
        // Marked while the map moves.
        data-map-root
      >
        {/* Sized by a wrapper: MapLibre's own stylesheet makes its container
            position: relative, over any class set on it. */}
        <div className="absolute inset-0">
          <div ref={containerRef} role="img" aria-label={t.pages.map.title} className="h-full w-full" />
        </div>

        {/* Inside the map's root, beside the row's glass: over the whole root
            its tint greys the row out. */}
        {isFullscreen && (
          <div aria-hidden="true" data-testid="map-top-edge" className="map-top-edge">
            <i />
            <i />
          </div>
        )}

        {generatorOpen && districtsArea && generator && (
          <RouteGeneratorMode
            area={districtsArea}
            target={target}
            tracksReady={districtsCoverage !== null}
            tracksFailed={tracksFailed}
            onRetryTracks={retryTracks}
            distanceKm={generator.km}
            onDistanceChange={explore.setKm}
            prefs={explore.prefs}
            onPrefsChange={explore.setPrefs}
            start={routeStart}
            onStartModeChange={explore.setStartMode}
            day={explore.day}
            avoid={avoid}
            home={districtsHome}
            paceSecPerKm={generator.pace}
            plan={generator.plan}
            today={today}
            from={generator.from}
            credits={districtCredits}
            onClose={closeGenerator}
            onDrawnChange={explore.setDrawn}
            panelRef={panelRef}
          />
        )}

        {!generatorOpen && (
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
              {/* top-0, never above: in fullscreen the edge sampler, painted
                  over the row, cuts it flat. */}
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
              ref={expandRef}
              type="button"
              onClick={() => setExpanded((on) => !on)}
              aria-label={isFullscreen ? t.pages.map.exitFullscreen : t.pages.map.fullscreen}
              className={circle}
            >
              <GlassLayers />
              {isFullscreen ? <Minimize size={20} strokeWidth={2} aria-hidden="true" /> : <Maximize size={20} strokeWidth={2} aria-hidden="true" />}
            </button>
          </div>
        )}


        {!process.env.NEXT_PUBLIC_MAPTILER_TOKEN && !TEST_MAPS && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
              {t.pages.map.mapUnavailable}
            </span>
          </div>
        )}

        {tracksFailed && !generatorOpen ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div role="alert" data-testid="map-tracks-failed" className="glass-map-chip pointer-events-auto flex items-center gap-3 py-1 pl-4 pr-1 text-xs font-medium text-subtle">
              {t.pages.map.tracksFailed}
              <button type="button" onClick={retryTracks} className="hit-44 rounded-full px-3 py-1.5 font-semibold text-accent-text">
                {t.pages.error.retry}
              </button>
            </div>
          </div>
        ) : visibleIndices.length === 0 && !generatorOpen && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
              {t.pages.map.noRoutes}
            </span>
          </div>
        )}

        {/* Off under a sheet or its scrim, where they would only cost blur. */}
        {sheetOpen || generatorOpen || (filtersOpen && districtsOn) ? null : isFullscreen ? (
          // One column for both layers, so the layers button and the ⓘ never
          // move under the finger when the layer changes.
          <div className="pointer-events-none absolute inset-x-6 bottom-[max(24px,var(--safe-bottom))] z-10 flex flex-col items-end gap-2">
            {districtsArea && <LayersButton on={districtsOn} onToggle={toggleLayer} className="pointer-events-auto" />}
            {districtsOn ? (
              // Absolute, so the row keeps the ⓘ's height; 60px is the layers
              // button's 44 + 16, for a second line (French at 320 pt) to rise
              // beside it.
              <div className="relative flex w-full justify-end">
                <DistrictsLegend className="pointer-events-auto absolute bottom-0 left-0 h-auto min-h-9 max-w-[calc(100%-60px)] flex-wrap gap-y-1 rounded-[18px] py-2" />
                <MapAttribution className="pointer-events-auto" extraCredits={credits} />
              </div>
            ) : (
              <MapAttribution className="pointer-events-auto" />
            )}
            {districtsOn ? (
              // The unseen heat card holds the box, so the controls above stay
              // put with or without the next quartier's card.
              <div className="grid w-full">
                <HeatLegend space className="col-start-1 row-start-1 w-full" summary={heatSummary} />
                {nextUnit && (
                  <NextQuartierCard
                    ref={nextCardRef}
                    unit={nextUnit}
                    onOpen={setOpenUnitId}
                    onPlanRun={onPlanRun}
                    className="pointer-events-auto col-start-1 row-start-1 self-end"
                  />
                )}
              </div>
            ) : (
              <HeatLegend className="pointer-events-auto w-full" summary={heatSummary} />
            )}
          </div>
        ) : (
          <div className={`pointer-events-none absolute inset-x-3 z-10 flex flex-wrap items-end gap-x-3 gap-y-1.5 ${bottom}`}>
            {districtsOn ? <DistrictsLegend className="shrink-0" /> : <HeatLegend className="shrink-0" />}
            {districtsArea ? (
              // One flex item with the ⓘ, so a wrapping legend moves up alone.
              // -mr-0.5 lines it up with the Expand circle (10 pt in, the ⓘ 12);
              // after it in the DOM, the ⓘ's credits open over it.
              <div className="ml-auto flex flex-col items-end gap-2.5">
                <LayersButton on={districtsOn} onToggle={toggleLayer} className="pointer-events-auto -mr-0.5" />
                <MapAttribution className="pointer-events-auto" extraCredits={credits} />
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
