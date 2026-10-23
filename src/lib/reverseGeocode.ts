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
