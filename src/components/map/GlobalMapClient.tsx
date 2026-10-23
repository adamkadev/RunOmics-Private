"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minimize, SlidersHorizontal } from "lucide-react";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { ACTIVITY_TYPES } from "@/domain/activity/types";
import { areaForCluster } from "@/domain/explore/areaForCluster";
import { medianStart } from "@/domain/explore/home";
import type { ExploreAreaRef, ScoredRoute } from "@/domain/explore/types";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatKm, formatNumber } from "@/lib/formatters";
import { removeUrlParams, useUrlParam } from "@/lib/useUrlParam";
import { MAP_PADDING, type CameraPadding, type LngLatBounds } from "@/lib/routeFrame";
import { useSetFullscreenChromeHidden } from "@/components/layout/FullscreenChromeContext";
import type { TerritoryCardContent } from "./TerritoryBand";
import { ClusterPanel } from "./ClusterPanel";
import { HeatFilterSheet } from "./HeatFilterSheet";
import { HeatLegend } from "./HeatLegend";
import { MapAttribution, type MapCredit } from "@/components/ui/MapAttribution";
import { GlassLayers, GLASS_CIRCLE, glassClass } from "@/components/ui/GlassSurface";
import { useMapRoutes, type HomeRing } from "./useMapRoutes";
import { LayersButton } from "@/components/explore/LayersButton";
import { DistrictsLegend } from "@/components/explore/DistrictsLegend";
import { useDistrictsCoverage } from "@/components/explore/useDistrictsCoverage";
import { districtsCardContent } from "@/components/explore/districtsCard";
import { useDistrictsOverlay, useDistrictsSync } from "@/components/explore/useDistrictsOverlay";
import { initialMapLayer, parseMapLayer, readStoredMapLayer, storeMapLayer, type MapLayer } from "@/components/explore/mapLayer";
import { NextQuartierCard } from "@/components/explore/NextQuartierCard";
import { QuartierSheet } from "@/components/explore/QuartierSheet";
import { useDistrictsTap, useQuartierCamera } from "@/components/explore/useQuartierMap";
import { parseExploreRoute } from "@/components/explore/exploreHref";
import { RouteGeneratorMode } from "@/components/explore/RouteGeneratorMode";
import {
  generatorPlan,
  generatorTarget,
  lineBounds,
  medianOf,
  unionBounds,
  type ExplorePlan,
  type GeneratorTarget,
} from "@/components/explore/routeGenerator";
import type { RouteDrawing } from "@/components/explore/routeLayer";
import { combineOverlays, useRouteOverlay, useRouteSync } from "@/components/explore/useRouteOverlay";
import { quartierPadding, sheetBoxOf, unitBounds } from "@/components/explore/quartierCamera";
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
  /** The planned sessions to come (trimmed), for the route generator: today's, or the one a Plan link names. */
  explorePlans?: readonly ExplorePlan[];
  /** 'YYYY-MM-DD' on this device: which plan is today's. */
  today?: string | null;
}

const NO_AREAS: readonly ExploreAreaRef[] = [];
const NO_RUNS: readonly number[] = [];
const NO_CREDITS: readonly MapCredit[] = [];
const NO_PLANS: readonly ExplorePlan[] = [];

/** What a generator link brings into the address; closing the generator takes them all out. */
const EXPLORE_PARAMS = ["explore", "quartier", "km", "pace", "date", "from"] as const;

/** The route generator, open: what it plans, and the map it closes back to. */
interface GeneratorState extends GeneratorTarget {
  /** The session it plans for - the linked day's, or today's - shown as its plan row; null for none. */
  plan: ExplorePlan | null;
  /** Expanded, and a quartier's sheet open, when "Plan a run" opened it; null from a link (the map card). */
  returnTo: { expanded: boolean; unitId: string | null } | null;
  /** What had focus when "Plan a run" opened it (the button tapped), for focus to go back to; null from a link. */
  opener: GeneratorOpener | null;
}

interface GeneratorOpener {
  element: HTMLElement | null;
  /** The expanded map's card's button, which closes with the card: its new one takes focus instead. */
  fromNextCard: boolean;
}

/**
 * Until the panel is measured: the room it leaves on a phone (it stands
 * about 430 pt tall), clear of the top row.
 */
const GENERATOR_PADDING: CameraPadding = { top: 72, right: 24, bottom: 460, left: 24 };

const samePadding = (a: CameraPadding | null, b: CameraPadding | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left);

/** An area's [minLon, minLat, maxLon, maxLat] as a box to fit. */
const bboxBounds = ([minLon, minLat, maxLon, maxLat]: readonly [number, number, number, number]): LngLatBounds => ({ minLon, minLat, maxLon, maxLat });

export function GlobalMapClient({ data, onContentChange, exploreAreas = NO_AREAS, explorePlans = NO_PLANS, today = null }: Props) {
  const { clusters, routeMeta } = data;
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  // Any number of types and years (Heatmap Filters 1c), set in the sheet.
  const [filters, setFilters] = useState<HeatFilters>(NO_HEAT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Expanded by hand; the route generator expands the map too (isFullscreen, below).
  const [expanded, setExpanded] = useState(false);
  const [names, setNames] = useState<string[]>(() => clusters.map(coordLabel));

  // The athlete's usual run in the area on screen: the generator's distance
  // and pace when no plan gives them.
  const medianKm = useMemo(() => medianOf(routeMeta, clusters[selectedIdx]?.routeIndices ?? NO_RUNS, (m) => m.distanceKm), [routeMeta, clusters, selectedIdx]);
  const medianPace = useMemo(() => medianOf(routeMeta, clusters[selectedIdx]?.routeIndices ?? NO_RUNS, (m) => m.paceSecPerKm), [routeMeta, clusters, selectedIdx]);

  // The route generator (S3) a link opens - Plan's "Find a route":
  // `?explore=route`, its quartier, distance, pace and origin, read once on
  // mount like the layer, and only where the home area has Districts.
  const [exploreParam] = useUrlParam("explore");
  const [kmParam] = useUrlParam("km");
  const [paceParam] = useUrlParam("pace");
  const [fromParam] = useUrlParam("from");
  const [dateParam] = useUrlParam("date");
  const [quartierParam, setQuartierParam] = useUrlParam("quartier");
  const [generator, setGenerator] = useState<GeneratorState | null>(() => {
    const link = parseExploreRoute({ explore: exploreParam, quartier: quartierParam, km: kmParam, pace: paceParam, date: dateParam, from: fromParam });
    const home = clusters[data.defaultClusterIdx];
    if (!link || !home || exploreAreas.length === 0 || !areaForCluster(exploreAreas, home)) return null;
    // The session the link is for (Plan sends its day), else today's.
    const plan = generatorPlan(explorePlans, link, today);
    return { ...generatorTarget(link, { plan, medianKm, medianPace }), plan, returnTo: null, opener: null };
  });
  const linkedGenerator = generator !== null;

  // Heat or Districts (Explore): the last choice, unless the link asks for
  // one - read once, when the map mounts, and remembered from then on. Never
  // written on load; a change by hand takes the link's layer out of the
  // address, so a remount (List and back, Back to this entry) keeps the hand's
  // choice instead of applying the link again. A generator link opens on
  // Districts and, closed, leaves this map there - but remembers nothing:
  // only a hand's toggle or a `layer=` link (Progress) changes the layer the
  // map opens on next time (Heat by default).
  const [layerParam, setLayerParam] = useUrlParam("layer");
  const [linkedLayer] = useState<MapLayer | null>(() => parseMapLayer(layerParam));
  const [layer, setLayer] = useState<MapLayer>(() => (linkedGenerator ? "districts" : initialMapLayer(layerParam, readStoredMapLayer())));
  useEffect(() => {
    if (linkedLayer) storeMapLayer(linkedLayer);
  }, [linkedLayer]);

  // A quartier's sheet (S2): the one tapped, or the link's. The link's
  // `?quartier=` is read once, like its layer, and opens that sheet once the
  // coverage is in; an id the area doesn't hold is let go. Closing the sheet
  // or changing the layer by hand takes it out of the address. A generator
  // link's quartier is the generator's, not a sheet's.
  const [linkedQuartier, setLinkedQuartier] = useState<string | null>(() => (linkedGenerator ? null : quartierParam));
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);

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
  // The generator: expanded, on Districts, over its own controls.
  const generatorOpen = generator !== null && !!districtsArea;
  const isFullscreen = expanded || generatorOpen;
  const districtsOn = (layer === "districts" || generatorOpen) && !!districtsArea;
  const toggleLayer = useCallback(() => {
    const next: MapLayer = layer === "districts" ? "heat" : "districts";
    setLayer(next);
    storeMapLayer(next);
    if (layerParam !== null) setLayerParam(null);
    setLinkedQuartier(null);
    setOpenUnitId(null);
    if (quartierParam !== null) setQuartierParam(null);
  }, [layer, layerParam, setLayerParam, quartierParam, setQuartierParam]);

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
  const { area: districtsFile, coverage: districtsCoverage, status: districtsStatus } = districts;

  // The link's quartier, once there is coverage to show it with (adjusted
  // while rendering, as React has state follow state): read once, then let
  // go whether the area holds it or not.
  if (linkedQuartier !== null && districtsOn && districtsStatus === "ready" && districtsCoverage) {
    setLinkedQuartier(null);
    if (districtsCoverage.units.some((u) => u.id === linkedQuartier)) setOpenUnitId(linkedQuartier);
  }
  const openUnit = (districtsOn && !generatorOpen && openUnitId && districtsCoverage?.units.find((u) => u.id === openUnitId)) || null;
  const sheetOpen = openUnit !== null;
  const nextUnit = (districtsOn && districtsCoverage?.nextId && districtsCoverage.units.find((u) => u.id === districtsCoverage.nextId)) || null;
  // Closed by hand: the selection goes, and a link's quartier leaves the address.
  const closeQuartier = useCallback(() => {
    setOpenUnitId(null);
    if (quartierParam !== null) setQuartierParam(null);
  }, [quartierParam, setQuartierParam]);

  // "Plan a run" - the Districts card's, the expanded map's next-quartier
  // card's, a quartier sheet's: the generator, on that quartier, sized to
  // today's plan (or the usual run here). Closed, it gives back the map it
  // was opened from, sheet and all.
  // What had focus when the generator opened (the button tapped) goes with
  // it, for focus to go back to when it closes - the panel takes it meanwhile.
  const nextCardRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const planRun = useCallback(
    (unitId: string) => {
      const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      const opener = { element: active, fromNextCard: !!active?.closest("[data-testid='next-quartier-card']") };
      const plan = generatorPlan(explorePlans, null, today);
      setGenerator({ ...generatorTarget(null, { unitId, plan, medianKm, medianPace }), plan, returnTo: { expanded, unitId: openUnitId }, opener });
      setOpenUnitId(null);
    },
    [explorePlans, today, medianKm, medianPace, expanded, openUnitId],
  );
  const onPlanRun = districtsArea ? planRun : undefined;
  const [routePrefs, setRoutePrefs] = useState({ avoidBusyRoads: true, newStreetsFirst: true });
  const [drawnRoute, setDrawnRoute] = useState<ScoredRoute | null>(null);
  // The closed generator's opener, until the map it gives back has rendered.
  const closedOpener = useRef<GeneratorOpener | null>(null);
  const closeGenerator = useCallback(() => {
    const back = generator?.returnTo ?? null;
    closedOpener.current = generator?.opener ?? null;
    setGenerator(null);
    setDrawnRoute(null);
    if (back) {
      setExpanded(back.expanded);
      setOpenUnitId(back.unitId);
    }
    // A link's generator: its parameters leave the address, as a sheet's do.
    if (exploreParam !== null) removeUrlParams(EXPLORE_PARAMS);
  }, [generator, exploreParam]);
  const setRouteKm = useCallback((km: number) => setGenerator((g) => (g ? { ...g, km } : g)), []);

  // The generator's quartier: the one asked for, where the area holds it;
  // else (none asked, or an id the area doesn't know) the next quartier - or,
  // all complete, the least explored.
  const generatorUnitId = generator?.unitId ?? null;
  const target = useMemo(() => {
    if (!generatorOpen || !districtsFile) return null;
    const asked = generatorUnitId ? districtsFile.features.find((f) => f.properties.id === generatorUnitId) : undefined;
    if (asked) return { id: asked.properties.id, name: asked.properties.name };
    if (!districtsCoverage) return null;
    const units = districtsCoverage.units;
    const next = units.find((u) => u.id === districtsCoverage.nextId) ?? [...units].sort((a, b) => a.pct - b.pct)[0];
    return next ? { id: next.id, name: next.name } : null;
  }, [generatorOpen, districtsFile, districtsCoverage, generatorUnitId]);

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

  // The loop on the map, from home (drawn here only, never sent anywhere) to its start.
  const routeDrawing = useMemo<RouteDrawing | null>(
    () => (generatorOpen && drawnRoute ? { coordinates: drawnRoute.candidate.coordinates, newSteps: drawnRoute.newSteps, home: districtsHome } : null),
    [generatorOpen, drawnRoute, districtsHome],
  );
  const routeOverlay = useRouteOverlay(routeDrawing, generatorOpen);
  const overlay = useMemo(() => combineOverlays(districtsOverlay, routeOverlay), [districtsOverlay, routeOverlay]);

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

  // Expanded, Districts fits every quartier of the area (S1), clear of its
  // card and legend; the heat keeps its own frame. The generator fits its
  // quartier and the loop, in the room its panel leaves (measured below).
  const districtsBbox = districtsOn && isFullscreen && !generatorOpen ? districtsArea?.bbox : undefined;
  const targetId = target?.id ?? null;
  const generatorBounds = useMemo(
    () => (generatorOpen && targetId ? unionBounds(unitBounds(districtsFile, targetId), drawnRoute ? lineBounds(drawnRoute.candidate.coordinates) : null) : null),
    [generatorOpen, targetId, districtsFile, drawnRoute],
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

  // The room the generator's panel leaves over the map: measured on its
  // layout box (its rise is a transform), again whenever it changes height -
  // the plan row, the options opened, an error line.
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
  // Closed, the generator gives focus back to what opened it: the button,
  // or - gone with the generator open, a new one now - the expanded map's
  // card's; else (a link) the expand button. A quartier's sheet back on
  // screen takes focus itself.
  const generatorWasOpen = useRef(generatorOpen);
  useEffect(() => {
    if (generatorWasOpen.current === generatorOpen) return;
    generatorWasOpen.current = generatorOpen;
    if (generatorOpen) return;
    const opener = closedOpener.current;
    closedOpener.current = null;
    if (sheetOpen) return;
    const back = opener?.element?.isConnected ? opener.element : opener?.fromNextCard ? nextCardRef.current : null;
    (back ?? expandRef.current)?.focus({ preventScroll: true });
  }, [generatorOpen, sheetOpen]);

  // A tap on a quartier opens its sheet - not under the generator, whose panel is the sheet there.
  useDistrictsTap(mapRef, mapReady, (unitId) => {
    if (districtsOn && !generatorOpen) setOpenUnitId(unitId);
  });
  useQuartierCamera(mapRef, mapReady, openUnit?.id ?? null, districtsFile);

  useSetFullscreenChromeHidden(isFullscreen);

  useEffect(() => {
    resize();
  }, [isFullscreen, resize]);

  // Escape leaves fullscreen - unless a quartier's sheet is open: then it
  // closes the sheet alone. In the generator it closes the generator.
  useEffect(() => {
    if (!isFullscreen || sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (generatorOpen) closeGenerator();
      else setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen, sheetOpen, generatorOpen, closeGenerator]);

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
  // In Districts the ⓘ also names where the quartiers come from (the base
  // map already credits OpenStreetMap).
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

      {openUnit && <QuartierSheet unit={openUnit} onClose={closeQuartier} onPlanRun={onPlanRun} />}

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

        {/* The route generator (S3): its own top row, ⓘ and panel, in place
            of the filter row and the controls at the foot. */}
        {generatorOpen && districtsArea && generator && (
          <RouteGeneratorMode
            area={districtsArea}
            target={target}
            tracksReady={districtsCoverage !== null}
            distanceKm={generator.km}
            onDistanceChange={setRouteKm}
            prefs={routePrefs}
            onPrefsChange={setRoutePrefs}
            paceSecPerKm={generator.pace}
            plan={generator.plan}
            today={today}
            from={generator.from}
            credits={districtCredits}
            onClose={closeGenerator}
            onDrawnChange={setDrawnRoute}
            panelRef={panelRef}
          />
        )}

        {/* The filter row (Heatmap Filters 1b, Oct 2026): the location pill,
            one Filters circle for type and year, and fullscreen - three 44 pt
            glass controls that fit any phone, never scrolled, never cut. Over
            the map, in the map card or in fullscreen (Liquid Glass v3, §6.10,
            §7.8). */}
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


        {!process.env.NEXT_PUBLIC_MAPTILER_TOKEN && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
              {t.pages.map.mapUnavailable}
            </span>
          </div>
        )}

        {visibleIndices.length === 0 && !generatorOpen && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="glass-map-chip px-4 py-2 text-xs font-medium text-subtle">
              {t.pages.map.noRoutes}
            </span>
          </div>
        )}

        {/* The scale bottom left, the credits' ⓘ bottom right (3.0): both
            always on the map, in the page and in fullscreen alike - and off
            it while a quartier's sheet is open (S2), or in Districts the
            filters' (the heat keeps its own): under the sheet or its scrim
            they would only cost blur. */}
        {sheetOpen || generatorOpen || (filtersOpen && districtsOn) ? null : isFullscreen ? (
          // The legend card, 24 pt from the edges (Liquid Glass v3, §6.10).
          // Expanded Districts (S1) keeps this column, so the layers button
          // and the ⓘ never move under the finger when the layer changes.
          <div className="pointer-events-none absolute inset-x-6 bottom-[max(24px,var(--safe-bottom))] z-10 flex flex-col items-end gap-2">
            {/* The layers button above the ⓘ, in the same right-hand column. */}
            {districtsArea && <LayersButton on={districtsOn} onToggle={toggleLayer} className="pointer-events-auto" />}
            {districtsOn ? (
              // S1: the solid legend bottom left, its foot level with the
              // ⓘ's. Taller than the ⓘ, it stands up into the gap, so the row
              // keeps the ⓘ's height. Too long for the room beside the ⓘ
              // (French at 320 pt), it takes a second line upward, rather
              // than run under the ⓘ - its width kept 16 pt short of the
              // layers button (44 pt) that its second line rises beside.
              <div className="relative flex w-full justify-end">
                <DistrictsLegend className="pointer-events-auto absolute bottom-0 left-0 h-auto min-h-9 max-w-[calc(100%-60px)] flex-wrap gap-y-1 rounded-[18px] py-2" />
                <MapAttribution className="pointer-events-auto" extraCredits={credits} />
              </div>
            ) : (
              <MapAttribution className="pointer-events-auto" />
            )}
            {districtsOn ? (
              // S1: the next quartier's card in the heat card's box (drawn by
              // nothing), at its foot. No taller than the heat card, it never
              // grows the box - card or none (loading, all complete), the
              // controls above stay put.
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
              // Explore's layers button (V1/V2) 10 pt above the ⓘ, in one
              // flex item with it: a legend that wraps to its own line (a long
              // one on a narrow phone) moves up alone, never under the button.
              // Its right edge lines up with the Expand circle's (10 pt in;
              // the ⓘ is 12). After it in the DOM, the ⓘ's credits open over it.
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
