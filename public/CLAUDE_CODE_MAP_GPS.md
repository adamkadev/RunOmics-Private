# RunOmics — Map Template : GPS Contextualisation
## Prompt ciblé pour Claude Code (le reste est déjà implémenté)

---

## Ce qui change par rapport au DC de référence

Le DC utilise un tracé GPS **fictif** (`pts[]` hardcodé). Tu dois le remplacer par les **vraies coordonnées GPS de l'activité**, et afficher la **vraie localisation** dans le badge.

---

## 1. Données GPS disponibles dans l'activité

```typescript
// Depuis la DB/API Garmin — champs à utiliser
interface ActivityGPS {
  polyline: [number, number][]  // [[lat, lng], [lat, lng], ...]
  // ou selon ton schema :r
  laps: { records: { lat: number; lng: number; distanceM: number }[] }[]
  startLat: number
  startLng: number
  city?: string        // si dispo dans les métadonnées Garmin
  country?: string
}
```

---

## 2. Projection GPS → pixels canvas

Remplacer le `pts[]` du DC par cette fonction :

```typescript
function projectPolyline(
  coords: [number, number][],  // [[lat, lng], ...]
  W: number,
  H: number,
  padding = 0.14
): [number, number][] {
  if (coords.length === 0) return []

  const lats = coords.map(c => c[0])
  const lngs = coords.map(c => c[1])
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)

  // Ratio pour ne pas déformer le tracé
  const spanLat = maxLat - minLat || 0.001
  const spanLng = maxLng - minLng || 0.001
  const aspect  = (spanLng / spanLat) * 1.3  // correction Mercator approx

  const drawW = W * (1 - 2 * padding)
  const drawH = H * (1 - 2 * padding)

  // Caler la dimension limitante
  const scale = aspect > drawW / drawH
    ? drawW / (spanLng * (W / H) * 0.85)
    : drawH / spanLat

  const offX = (W - spanLng * scale * aspect) / 2
  const offY = (H - spanLat * scale) / 2

  return coords.map(([lat, lng]) => [
    offX + (lng - minLng) * scale * aspect,
    offY + (maxLat - lat) * scale,   // lat inversé (nord = haut)
  ])
}
```

**Usage dans `draw_map` :**
```typescript
// Avant : const pts = [[W*.22,H*.72], ...]
// Après :
const rawCoords = activity.polyline  // [[lat,lng], ...]
const pts = projectPolyline(rawCoords, W, H)
```

---

## 3. Marqueurs km le long du tracé réel

Le DC place les marqueurs à des indices fixes (3, 6, 9, 12). Avec un vrai tracé :

```typescript
function getKmMarkerPoints(
  pts: [number, number][],
  rawCoords: [number, number][],
  totalDistanceKm: number
): { pt: [number, number]; label: string }[] {
  if (pts.length < 2) return []

  // Calculer la distance cumulée en pixels
  let cumDist = 0
  const cumDistances = [0]
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i-1][0]
    const dy = pts[i][1] - pts[i-1][1]
    cumDist += Math.sqrt(dx*dx + dy*dy)
    cumDistances.push(cumDist)
  }
  const totalPixels = cumDist

  // Placer un marqueur tous les 1km (ou 2km si > 10km)
  const step = totalDistanceKm > 10 ? 2 : 1
  const markers: { pt: [number, number]; label: string }[] = []

  for (let km = step; km < Math.floor(totalDistanceKm); km += step) {
    const targetPx = (km / totalDistanceKm) * totalPixels
    // Trouver l'index le plus proche
    let idx = cumDistances.findIndex(d => d >= targetPx)
    if (idx < 0) idx = pts.length - 1
    markers.push({ pt: pts[idx], label: `${km} km` })
  }

  return markers
}
```

---

## 4. Badge de localisation réel

### Option A — Depuis les métadonnées Garmin (si disponible)
```typescript
// Certaines activités Garmin ont city/country dans les metadata
const locationLabel = activity.city
  ? `📍 ${activity.city}`
  : '📍 En cours de localisation'
```

### Option B — Reverse geocoding Nominatim (gratuit, no API key)
```typescript
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12`,
      { headers: { 'Accept-Language': 'fr', 'User-Agent': 'RunOmics/1.0' } }
    )
    const data = await res.json()
    const suburb = data.address?.suburb || data.address?.neighbourhood
    const city   = data.address?.city || data.address?.town || data.address?.village
    return suburb ? `${suburb}, ${city}` : city || 'Localisation inconnue'
  } catch {
    return 'Localisation inconnue'
  }
}

// Appeler avec le 1er point GPS de l'activité
const locationName = await reverseGeocode(activity.startLat, activity.startLng)
// → "Vincennes, Paris" ou "Montmartre, Paris" etc.
```

### Cache du reverse geocoding
```typescript
// Mettre en cache par activityId pour éviter les appels répétés
const GEOCODE_CACHE_KEY = `ro_geocode_${activity.id}`
const cached = sessionStorage.getItem(GEOCODE_CACHE_KEY)
const locationName = cached ?? await reverseGeocode(lat, lng)
if (!cached) sessionStorage.setItem(GEOCODE_CACHE_KEY, locationName)
```

---

## 5. Watermark neighbourhood (fond de carte)

Remplacer `'VINCENNES'` par le nom réel :
```typescript
// Extraire juste le quartier/ville sans l'arrondissement
const watermarkText = locationName.split(',')[0].toUpperCase()
// "Vincennes, Paris" → "VINCENNES"
// "Montmartre, Paris" → "MONTMARTRE"
```

---

## 6. Signature de la fonction finale

```typescript
async function draw_map(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  r: number, g: number, b: number,
  dark: boolean,
  activity: {
    polyline: [number, number][]
    distanceKm: number
    startLat: number
    startLng: number
    locationName?: string  // pré-chargé avant ouverture modal
  }
): Promise<void>
```

> **Important :** Pré-charger `locationName` (reverse geocoding) **avant** d'ouvrir la modal, pas pendant le rendu canvas. Stocker dans le state du composant ShareActivitySheet.

---

## 7. Simplification du tracé (performance)

Un tracé Garmin peut avoir 1000+ points. Simplifier avant projection :

```typescript
// Douglas-Peucker simplifié — garder ~150 points max
function simplifyPolyline(
  coords: [number, number][],
  maxPoints = 150
): [number, number][] {
  if (coords.length <= maxPoints) return coords
  const step = Math.ceil(coords.length / maxPoints)
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1)
}

const simplified = simplifyPolyline(activity.polyline)
const pts = projectPolyline(simplified, W, H)
```
