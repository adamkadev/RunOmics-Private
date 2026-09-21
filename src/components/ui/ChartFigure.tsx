export function ChartFigure({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={summary}>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}
