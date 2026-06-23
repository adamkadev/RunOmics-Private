/**
 * Living background behind the liquid glass surfaces: a tinted canvas gradient
 * with two slow radial blobs. Rendered once, fixed at z-index -10 so glass
 * cards blur it through their backdrop-filter. Frozen under
 * `prefers-reduced-motion` via the global rule in globals.css.
 */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
    </div>
  )
}
