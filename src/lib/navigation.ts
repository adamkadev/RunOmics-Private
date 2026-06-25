const NO_GLOBAL_TOP_BAR_BASES = ['/profile', '/settings']

/**
 * Profile and Settings manage their own header entirely (no global RunOmics
 * top bar with brand/theme toggle/profile shortcut) since they're already
 * reached via that shortcut or show the user's own identity. Every other
 * page - including activity detail/compare and the "More" menu destinations -
 * keeps the global top bar.
 */
export function hasGlobalTopBar(pathname: string): boolean {
  return !NO_GLOBAL_TOP_BAR_BASES.some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

const PAGE_AURORA_BASES = ['/goals', '/records', '/shoes', '/settings', '/analytics'] as const

/**
 * Goals/Records/Shoes/Settings get a fixed two-tone aurora (Wave 3 DA) instead
 * of following the user's accent color, to give each screen its own identity.
 */
export function getPageAuroraKey(pathname: string): (typeof PAGE_AURORA_BASES)[number] | undefined {
  return PAGE_AURORA_BASES.find((base) => pathname === base || pathname.startsWith(`${base}/`))
}
