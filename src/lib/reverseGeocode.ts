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

    return writeCache(key, extractName(features));
  } catch {
    return null;
  }
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

// Only the "urban" EPCI tiers below are reliably named after one dominant
// city (they're reserved by law for large conurbations). Smaller tiers
// (communautés d'agglomération / de communes) often carry an invented
// territorial name instead, so we deliberately leave those alone.
const EPCI_PREFIXES = [
  /^eurom[ée]tropole (?:de|d')\s*/i,
  /^m[ée]tropole (?:europ[ée]enne )?(?:de|du|d')\s*/i,
  /^communaut[ée] urbaine (?:de|du|d')\s*/i,
];
const EPCI_SUFFIXES = [/\s+m[ée]tropole$/i];
const EPCI_GRAND_PREFIX = /^grand\s+/i;

function cityFromEpciName(raw: string): string | null {
  const original = raw.trim();
  let name = original;

  for (const re of EPCI_PREFIXES) {
    if (re.test(name)) {
      name = name.replace(re, "").trim();
      break;
    }
  }
  for (const re of EPCI_SUFFIXES) {
    if (re.test(name)) {
      name = name.replace(re, "").trim();
      break;
    }
  }
  if (name === original) return null;

  name = name.replace(EPCI_GRAND_PREFIX, "").trim();
  return name || null;
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
  const epci = ctx.find((c) => c.id.startsWith("joint_municipality."));
  const city = epci ? cityFromEpciName(epci.text) : null;

  return (
    city ??
    local ??
    ctx.find((c) => c.id.startsWith("region."))?.text ??
    ctx.find((c) => c.id.startsWith("county."))?.text ??
    features[0]?.text ??
    null
  );
}
