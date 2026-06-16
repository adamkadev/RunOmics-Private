// Tolerant JSON extraction: providers occasionally wrap JSON in prose or code
// fences despite instructions. Pull the outermost object/array and parse it.
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.search(/[[{]/)
    const end = Math.max(trimmed.lastIndexOf(']'), trimmed.lastIndexOf('}'))
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
