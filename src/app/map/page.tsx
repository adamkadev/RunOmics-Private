import { redirect } from 'next/navigation'

// /map stays as a deep link to the Map view of Activities.
export default function MapPage() {
  redirect('/activities?view=map')
}
