import { redirect } from 'next/navigation'

// The heatmap is the Map view of Activities (design review, Oct 2026); /map
// stays as a deep link to it.
export default function MapPage() {
  redirect('/activities?view=map')
}
