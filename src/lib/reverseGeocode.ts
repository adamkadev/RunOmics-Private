import { t } from "@/i18n";

const TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CACHE_VERSION = "v3";

const GEOCODE_LANGUAGE = t.locale.split("-")[0];

type GeoFeature = {
  text: string;
  place_type?: string[];
  context?: Array<{ id: string; text: string }>;
};

/** "street" tells apart two routes that start in the same town. */
export type GeocodeGrain = "place" | "street";

export async function reverseGeocode(
  lon: number,
  lat: number,
  token: string,
  grain: GeocodeGrain = "place",
): Promise<string | null> {
  const key = `reverse_geocode:${CACHE_VERSION}:${grain}:${lon.toFixed(4)},${lat.toFixed(4)}`;

  const cached = readCache(key);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lon.toFixed(4)},${lat.toFixed(4)}.json?key=${token}&language=${GEOCODE_LANGUAGE}`,
    );
    if (!res.ok) return writeCache(key, null);

    const json = await res.json();
    const features: GeoFeature[] = json.features ?? [];
    if (!features.length) return writeCache(key, null);

    const name = grain === "street" ? extractStreet(features) : extractName(features);
    if (!name) return writeCache(key, name);

    return writeCache(key, await applyOverride(name));
  } catch {
    return null;
  }
}

const overrides = new Map<string, Promise<string>>();

function applyOverride(name: string): Promise<string> {
  const cached = overrides.get(name);
  if (cached) return cached;

  const pending = fetch(`/api/location-override?name=${encodeURIComponent(name)}`)
    .then((res) => (res.ok ? (res.json() as Promise<{ name: string | null }>) : null))
    .then((json) => json?.name ?? name)
    .catch(() => name);

  overrides.set(name, pending);
  return pending;
}

function readCache(key: string): string | null | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const { ts, value } = JSON.parse(raw) as { ts: number; value: string | null };
    return Date.now() - ts < TTL_MS ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: string | null): string | null {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch {}
  return value;
}

function extractStreet(features: GeoFeature[]): string | null {
  for (const type of ["street", "address", "poi"]) {
    const match = features.find((f) => f.place_type?.includes(type));
    if (match) return match.text;
  }
  return extractName(features);
}

function extractName(features: GeoFeature[]): string | null {
  let local: string | null = null;
  for (const type of ["municipality", "locality"]) {
    const match = features.find((f) => f.place_type?.includes(type));
    if (match) {
      local = match.text;
      break;
    }
  }

  const ctx = features[0]?.context ?? [];

  return (
    local ??
    ctx.find((c) => c.id.startsWith("region."))?.text ??
    ctx.find((c) => c.id.startsWith("county."))?.text ??
    features[0]?.text ??
    null
  );
}

/** What a landmark may be: a park, a forest, a wood or a protected area, as MapTiler names its categories. */
export const GREEN_CATEGORIES = new Set([
  "park", "forest", "wood", "garden", "nature_reserve", "nature reserve", "national_park", "protected area",
]);

type PoiFeature = { text?: string; center?: [number, number]; properties?: { categories?: string[] } };

/** The park nearest a point: at a share card's zoom the tiles name no park. */
export async function nearbyPark(lon: number, lat: number, token: string): Promise<{ name: string; at: [number, number] } | null> {
  const key = `nearby_park:${CACHE_VERSION}:${lon.toFixed(4)},${lat.toFixed(4)}`;
  const cached = readCache(key);
  if (cached !== undefined) return cached ? (JSON.parse(cached) as { name: string; at: [number, number] }) : null;
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lon.toFixed(4)},${lat.toFixed(4)}.json?key=${token}&types=poi&limit=10&language=${GEOCODE_LANGUAGE}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: PoiFeature[] };
    const park = (json.features ?? []).find(
      (f) => f.text && f.center && f.properties?.categories?.some((c) => GREEN_CATEGORIES.has(c)),
    );
    const found = park ? { name: park.text!, at: park.center! } : null;
    writeCache(key, found ? JSON.stringify(found) : null);
    return found;
  } catch {
    return null;
  }
}

export type GeocodedFeature = { text: string; placeType: string; categories: string[]; center: [number, number] | null };

/** Every area MapTiler holds at a point, quarter to country, landforms included; `decimals` sets how much it is told. */
export async function geocodeAreas(lon: number, lat: number, token: string, decimals = 4): Promise<GeocodedFeature[]> {
  const key = `geocode_areas:${CACHE_VERSION}:${lon.toFixed(decimals)},${lat.toFixed(decimals)}`;
  const cached = readCache(key);
  if (cached) return JSON.parse(cached) as GeocodedFeature[];
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lon.toFixed(decimals)},${lat.toFixed(decimals)}.json?key=${token}&language=${GEOCODE_LANGUAGE}`,
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: (PoiFeature & { place_type?: string[] })[] };
    const features = (json.features ?? [])
      .filter((f) => f.text)
      .map((f) => ({ text: f.text!, placeType: f.place_type?.[0] ?? "", categories: f.properties?.categories ?? [], center: f.center ?? null }));
    writeCache(key, JSON.stringify(features));
    return features;
  } catch {
    return [];
  }
}

/** A run's start is often a home: its town is asked for at about 110 m, enough to tell which side of a border it is. */
export const START_DECIMALS = 3;
const TOWN_TYPES = new Set(["municipality", "joint_municipality"]);

/** The town a run starts in, as the Activity page and the share card both name it. */
export async function townAt(lon: number, lat: number, token: string): Promise<string | null> {
  return (await geocodeAreas(lon, lat, token, START_DECIMALS)).find((f) => TOWN_TYPES.has(f.placeType))?.text ?? null;
}

/** West, south, east, north. */
export type GeoBox = readonly [number, number, number, number];

/** The tiles carry a place of worship only at zoom 15 and never say which is a cathedral; the geocoder's category does. */
export async function cathedralsIn(box: GeoBox, token: string): Promise<{ name: string; at: [number, number] }[]> {
  const bbox = box.map((v) => v.toFixed(3)).join(",");
  const key = `cathedrals:${CACHE_VERSION}:${bbox}`;
  const cached = readCache(key);
  if (cached) return JSON.parse(cached) as { name: string; at: [number, number] }[];
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/cathedral.json?key=${token}&types=poi&bbox=${bbox}&limit=10&language=${GEOCODE_LANGUAGE}`,
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: PoiFeature[] };
    const found = (json.features ?? [])
      .filter((f) => f.text && f.center && f.properties?.categories?.includes("cathedral"))
      .map((f) => ({ name: f.text!, at: f.center! }));
    writeCache(key, JSON.stringify(found));
    return found;
  } catch {
    return [];
  }
}
