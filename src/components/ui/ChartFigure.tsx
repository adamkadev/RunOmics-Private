/**
 * Accessible wrapper for Recharts charts. Recharts renders plain SVG with no
 * semantics of its own - a screen reader either announces nothing or reads
 * scattered tick/tooltip text nodes piecemeal. This exposes the whole chart
 * as a single `img`-role element with one summarizing sentence (the
 * WCAG "text alternative for complex images" pattern), and hides the SVG
 * itself from assistive tech so it isn't also traversed node-by-node.
 */
export function ChartFigure({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={summary}>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}
