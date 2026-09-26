/**
 * A title as the app prints it (v4.3): "3 × 7:00", never Garmin's "3 x 7:00".
 * Only an x between a count and a number turns into ×, so "Max", "Xtra" and
 * "box" stay as they are.
 */
export function displayTitle(title: string): string {
  return title.replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1 × ')
}
