import { t } from "@/i18n";

const TTL_MS = 1000 * 60 * 60 * 24 * 30;
// Bumped because entries cached before language-locking would carry
// MapTiler's default-language names, not t.locale's.
const CACHE_VERSION = "v3";

// MapTiler expects an ISO 639-1 code (e.g. 'en', 'fr'), while t.locale is a
// BCP 47 tag (e.g. 'en-US', 'fr-FR'). Keeps the dropdown in sync with the
// map, which is localized the same way in maptiler.ts.
const GEOCODE_LANGUAGE = t.locale.split("-")[0];

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
      `https://api.maptiler.com/geocoding/${lon.toFixed(4)},${lat.toFixed(4)}.json?key=${token}&language=${GEOCODE_LANGUAGE}`,
    );
    if (!res.ok) return writeCache(key, null);

    const json = await res.json();
    const features: GeoFeature[] = json.features ?? [];
    if (!features.length) return writeCache(key, null);

    const name = extractName(features);
    if (!name) return writeCache(key, name);

    return writeCache(key, await applyOverride(name));
  } catch {
    return null;
  }
}

// MapTiler sometimes resolves a cluster center to a small commune/street rather than
// the recognizable city it belongs to. The override table is part of the private
// dataset and stays server-side, hence one lookup per name instead of fetching the
// mapping. Add an entry to the data repository's location-overrides.json when a new
// location shows up wrong in the map dropdown.
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
