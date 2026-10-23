/** Garmin's "3 x 7:00" becomes "3 × 7:00"; only an x between two numbers turns, so "Max", "Xtra" and "box" stay. */
export function displayTitle(title: string): string {
  return title.replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1 × ')
}
