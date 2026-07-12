import { redirect } from 'next/navigation'

// Milestones merged into /records (segmented control) - keep this route as a
// redirect so old links/bookmarks still land somewhere.
export default function MilestonesPage() {
  redirect('/records')
}
