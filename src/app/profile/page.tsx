import { getProfileData } from '@/application/usecases/GetProfileData'
import { ProfileClient } from '@/components/profile/ProfileClient'

// Keep in sync with DATE_SENSITIVE_REVALIDATE_SECONDS in @/lib/revalidate (see
// that file for why this can't just be imported here).
export const revalidate = 3600

export default async function ProfilePage() {
  const data = await getProfileData()

  return <ProfileClient data={data} />
}
