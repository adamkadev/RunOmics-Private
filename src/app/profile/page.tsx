import { getProfileData } from '@/application/usecases/GetProfileData'
import { ProfileClient } from '@/components/profile/ProfileClient'

export const revalidate = 3600

export default async function ProfilePage() {
  const data = await getProfileData()

  return <ProfileClient data={data} />
}
