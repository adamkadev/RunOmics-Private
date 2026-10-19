export interface SessionHrTarget {
  capBpm: number | null
  zone: number | null
}

export function hrZoneCapBpm(zone: number | null | undefined, bounds: readonly number[] | null | undefined): number | null {
  if (!zone || !bounds || bounds.length < 5 || zone >= 5) return null
  const next = bounds[zone]
  return next === undefined ? null : next - 1
}

export function sessionHrCapBpm(
  hr: SessionHrTarget | null | undefined,
  bounds: readonly number[] | null | undefined,
): number | null {
  if (!hr) return null
  return hr.capBpm ?? hrZoneCapBpm(hr.zone, bounds)
}
