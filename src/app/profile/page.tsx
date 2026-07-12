import { getProfileData } from '@/application/usecases/GetProfileData'
import { ProfileClient } from '@/components/profile/ProfileClient'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when the athlete Firestore collection is written.
export const revalidate = 86400

export default async function ProfilePage() {
  const data = await getProfileData()

  return <ProfileClient data={data} />
}
