/** Module state, not a ref: a page remounted by Back reads it while rendering, before the shell restores its scroll. */
let pop = false

export function notePopNavigation(): void {
  pop = true
}

export function popNavigationHandled(): void {
  pop = false
}

export function isPopNavigation(): boolean {
  return pop
}
