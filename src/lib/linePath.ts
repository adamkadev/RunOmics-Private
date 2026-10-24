/** A missing value is stepped over, so a week without a workout doesn't cut the line in two. */
export function linePath(values: (number | null)[], min: number, max: number, w: number, h: number): string {
  const n = values.length
  const range = max - min || 1
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v === null) return
    const x = n <= 1 ? w / 2 : (i / (n - 1)) * w
    const y = h - ((v - min) / range) * h
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    pen = true
  })
  return d
}
