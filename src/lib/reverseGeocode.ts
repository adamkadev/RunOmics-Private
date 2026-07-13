const TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CACHE_VERSION = "v2";

type GeoFeature = {
  text: string;
  place_type?: string[];
  context?: Array<{ id: string; text: string }>;
};

export async function reverseGeocode(
  lon: number,
  lat: number,
  token: string,
): Promise<string | null> {
  const key = `reverse_geocode:${CACHE_VERSION}:${lon.toFixed(4)},${lat.toFixed(4)}`;

  const cached = readCache(key);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lon.toFixed(4)},${lat.toFixed(4)}.json?key=${token}`,
    );
    if (!res.ok) return writeCache(key, null);

    const json = await res.json();
    const features: GeoFeature[] = json.features ?? [];
    if (!features.length) return writeCache(key, null);

    const name = extractName(features);
    if (!name) return writeCache(key, name);

    const overrides = await getNameOverrides();
    return writeCache(key, overrides[name] ?? name);
  } catch {
    return null;
  }
}

// MapTiler sometimes resolves a cluster center to a small commune/street rather than
// the recognizable city it belongs to. Add an entry to public/data/location-overrides.json
// when a new location shows up wrong in the map dropdown.
let overridesPromise: Promise<Record<string, string>> | null = null;

function getNameOverrides(): Promise<Record<string, string>> {
  if (!overridesPromise) {
    overridesPromise = fetch("/data/location-overrides.json")
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  return overridesPromise;
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
