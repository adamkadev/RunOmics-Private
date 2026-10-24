const SPARSE_SERIES_MAX = 6

export function lineInterpolation(count: number): 'monotone' | 'linear' {
  return count > SPARSE_SERIES_MAX ? 'monotone' : 'linear'
}
