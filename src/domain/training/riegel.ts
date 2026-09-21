export function riegel(sourceSeconds: number, sourceKm: number, targetKm: number): number {
  return Math.round(sourceSeconds * Math.pow(targetKm / sourceKm, 1.06))
}

export function bestSourceFromMap(
  bestByKey: Map<string, number>,
  targetKey: string,
  kmByKey: Record<string, number>,
  targetKm: number,
): { seconds: number; sourceKm: number } | null {
  let best: { seconds: number; sourceKm: number; ratio: number } | null = null
  for (const [key, seconds] of bestByKey) {
    const sourceKm = kmByKey[key]
    if (key === targetKey || sourceKm === undefined) continue
    const ratio = Math.abs(Math.log(targetKm / sourceKm))
    if (best === null || ratio < best.ratio) best = { seconds, sourceKm, ratio }
  }
  return best ? { seconds: best.seconds, sourceKm: best.sourceKm } : null
}
