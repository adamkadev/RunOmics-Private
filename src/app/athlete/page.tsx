import { getAthleteFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { AthleteClient } from '@/components/profile/AthleteClient'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the athlete Firestore collection is written.
export const revalidate = 86400

export default async function AthletePage() {
  const athlete = await getAthleteFromFirestore()

  return <AthleteClient athlete={athlete} />
}
