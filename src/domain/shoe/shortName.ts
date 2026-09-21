const LINE_PREFIXES = ['adizero', 'air zoom', 'air', 'zoom', 'zoomx', 'fresh foam', 'gel', 'cloud', 'wave']

export function shortShoeName(name: string, brand?: string): string {
  let short = name.trim()

  const prefixes = [brand?.toLowerCase(), ...LINE_PREFIXES].filter((p): p is string => !!p)
  let stripped = true
  while (stripped) {
    stripped = false
    for (const prefix of prefixes) {
      if (short.toLowerCase().startsWith(prefix + ' ') && short.length > prefix.length + 1) {
        short = short.slice(prefix.length + 1).trim()
        stripped = true
      }
    }
  }

  return short
}
